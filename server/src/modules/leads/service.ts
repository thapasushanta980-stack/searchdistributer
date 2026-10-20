import { Prisma } from "@prisma/client";
import type { z } from "zod";
import type { leadInputSchema, LeadResponse } from "@sd/shared";
import { config } from "../../config.js";
import { prisma } from "../../db.js";
import { makeReference } from "../../lib/reference.js";
import { enqueue } from "../notifications/outbox.js";

type LeadInput = z.output<typeof leadInputSchema>;
const PREFIX = { BUSINESS_REGISTRATION: "REG", REQUIREMENT: "REQ", CONTACT: "MSG" } as const;

export async function submitLead(input: LeadInput): Promise<LeadResponse> {
  // Honeypot: report success so bots learn nothing, but store nothing.
  if (input.website) return { reference: makeReference(PREFIX[input.type]) };

  const existing = await prisma.lead.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) return { reference: existing.reference };

  try {
    const lead = await prisma.$transaction(async (tx) => {
      const created = await tx.lead.create({
        data: {
          reference: makeReference(PREFIX[input.type]),
          type: input.type,
          idempotencyKey: input.idempotencyKey,
          name: input.name,
          companyName: input.companyName,
          email: input.email,
          phone: input.phone,
          categorySlug: input.categorySlug,
          location: input.location,
          message: input.message,
          consentAt: new Date(),
        },
      });
      if (config.SUPPORT_EMAIL) {
        await enqueue(tx, {
          dedupeKey: `lead:${created.id}`,
          template: "lead-internal",
          toEmail: config.SUPPORT_EMAIL,
          payload: {
            type: created.type,
            reference: created.reference,
            name: created.name,
            email: created.email ?? undefined,
            phone: created.phone ?? undefined,
            companyName: created.companyName ?? undefined,
            categorySlug: created.categorySlug ?? undefined,
            location: created.location ?? undefined,
            message: created.message,
          },
        });
      }
      return created;
    });
    return { reference: lead.reference };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const again = await prisma.lead.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (again) return { reference: again.reference };
    }
    throw err;
  }
}
