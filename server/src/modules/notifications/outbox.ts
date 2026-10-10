import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../../db.js";
import { logger } from "../../logger.js";
import { sendMail } from "./mailer.js";
import { renderTemplate } from "./templates.js";

type Tx = PrismaClient | Prisma.TransactionClient;
const MAX_ATTEMPTS = 6;

/** Queue a notification inside the caller's transaction. Duplicate dedupeKeys are ignored. */
export async function enqueue(
  tx: Tx,
  input: { dedupeKey: string; template: string; toEmail: string; payload: Record<string, string | undefined> },
): Promise<void> {
  await tx.notificationOutbox.upsert({
    where: { dedupeKey: input.dedupeKey },
    create: { ...input, payload: input.payload as Prisma.InputJsonValue },
    update: {},
  });
}

interface Claimed {
  id: string;
  template: string;
  toEmail: string;
  payload: Record<string, string>;
  attempts: number;
}

export async function processOutbox(batch = 10): Promise<number> {
  // Claim rows atomically so concurrent workers never double-send.
  const claimed = await prisma.$queryRaw<Claimed[]>`
    UPDATE "notification_outbox" SET "attempts" = "attempts" + 1, "nextAttemptAt" = now() + interval '2 minutes'
    WHERE "id" IN (
      SELECT "id" FROM "notification_outbox"
      WHERE "status" = 'PENDING' AND "nextAttemptAt" <= now() AND "attempts" < ${MAX_ATTEMPTS}
      ORDER BY "createdAt" ASC
      LIMIT ${batch}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING "id", "template", "toEmail", "payload", "attempts"`;

  for (const row of claimed) {
    try {
      await sendMail(renderTemplate(row.template, row.toEmail, row.payload));
      await prisma.notificationOutbox.update({ where: { id: row.id }, data: { status: "SENT", sentAt: new Date(), lastError: null } });
    } catch (err) {
      const message = (err as Error).message;
      const exhausted = row.attempts >= MAX_ATTEMPTS;
      logger.error(`notification send failed outbox=${row.id} template=${row.template} attempts=${row.attempts}: ${message}`);
      await prisma.notificationOutbox.update({
        where: { id: row.id },
        data: {
          status: exhausted ? "FAILED" : "PENDING",
          lastError: message.slice(0, 500),
          nextAttemptAt: new Date(Date.now() + Math.min(60, 2 ** row.attempts) * 60_000),
        },
      });
    }
  }
  return claimed.length;
}

export function startOutboxWorker(): () => void {
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await processOutbox();
    } catch (err) {
      logger.error(`outbox worker error: ${(err as Error).message}`);
    } finally {
      running = false;
    }
  }, 5_000);
  timer.unref();
  return () => clearInterval(timer);
}
