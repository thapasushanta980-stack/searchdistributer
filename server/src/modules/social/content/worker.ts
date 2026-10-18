import { config } from "../../../config.js";
import { prisma } from "../../../db.js";
import { logger } from "../../../logger.js";
import { CONTENT_ACTION, pickNextTopic, postTopic } from "./nurvexa.js";

const CHECK_MS = 15 * 60_000;
const MIN_GAP_MS = 20 * 3_600_000;
const NPT_OFFSET_MS = (5 * 60 + 45) * 60_000;

const nepalHour = () => new Date(Date.now() + NPT_OFFSET_MS).getUTCHours();

/** Post at most one carousel per day, once the Nepal-time hour has passed. Every attempt is audited, so failures are not retried in a loop. */
export async function runNurvexaOnce(): Promise<boolean> {
  if (config.NURVEXA_POST_MODE === "off" || nepalHour() < config.NURVEXA_POST_HOUR) return false;
  const last = await prisma.auditLog.findFirst({ where: { action: CONTENT_ACTION }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
  if (last && Date.now() - last.createdAt.getTime() < MIN_GAP_MS) return false;
  const topic = await pickNextTopic();
  try {
    await postTopic(topic, config.NURVEXA_POST_MODE);
  } catch (err) {
    logger.error({ err, topic: topic.id }, "Nurvexa post failed");
    await prisma.auditLog.create({ data: { action: CONTENT_ACTION, entityType: "content", entityId: topic.id, meta: { failed: true, error: String((err as Error).message).slice(0, 300) } } });
  }
  return true;
}

export function startNurvexaWorker(): () => void {
  if (config.NURVEXA_POST_MODE === "off" || !config.ZERNIO_API_KEY || !config.ZERNIO_TIKTOK_ACCOUNT_ID) return () => {};
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await runNurvexaOnce();
    } catch (err) {
      logger.error({ err }, "Nurvexa worker tick failed");
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => void tick(), CHECK_MS);
  timer.unref();
  void tick();
  logger.info(`Nurvexa carousel worker on (${config.NURVEXA_POST_MODE}, daily after ${config.NURVEXA_POST_HOUR}:00 NPT)`);
  return () => clearInterval(timer);
}
