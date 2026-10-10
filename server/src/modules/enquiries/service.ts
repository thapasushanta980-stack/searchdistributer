import { createHash, randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import type { z } from "zod";
import type { enquiryInputSchema, EnquiryResponse } from "@sd/shared";
import { config } from "../../config.js";
import { prisma } from "../../db.js";
import { HttpError } from "../../lib/errors.js";
import { makeReference } from "../../lib/reference.js";
import { getEligibleId } from "../distributors/service.js";
import { enqueue } from "../notifications/outbox.js";

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_VERIFICATION_SENDS = 3;

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const newToken = () => randomBytes(32).toString("base64url");

type EnquiryInput = z.output<typeof enquiryInputSchema>;

const unavailable = () =>
  new HttpError(409, "LISTING_UNAVAILABLE", "This listing is no longer accepting enquiries. Your message has not been sent.");

export async function submitEnquiry(input: EnquiryInput): Promise<EnquiryResponse> {
  // Idempotent: replays of the same key return the original reference without creating another record.
  const existing = await prisma.enquiry.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) return toResponse(existing.reference, existing.status);

  // The recipient is resolved from the published record on the server; the client never supplies an organisation.
  const target = await getEligibleId(input.distributorSlug);
  if (!target) throw unavailable();

  const verify = config.ENQUIRY_EMAIL_VERIFICATION;
  const token = verify ? newToken() : null;

  try {
    const created = await prisma.$transaction(async (tx) => {
      const enquiry = await tx.enquiry.create({
        data: {
          reference: makeReference("ENQ"),
          organisationId: target.organisationId,
          distributorId: target.id,
          idempotencyKey: input.idempotencyKey,
          senderName: input.name,
          senderEmail: input.email,
          senderPhone: input.phone,
          senderLocation: input.location,
          message: input.message,
          consentAt: new Date(),
          status: verify ? "PENDING_VERIFICATION" : "NEW",
          verificationTokenHash: token ? sha256(token) : null,
          verificationExpiresAt: token ? new Date(Date.now() + TOKEN_TTL_MS) : null,
          verificationSends: verify ? 1 : 0,
          verifiedAt: verify ? null : new Date(),
        },
      });
      if (token) {
        await enqueue(tx, {
          dedupeKey: `enquiry-verify:${enquiry.id}:1`,
          template: "enquiry-verify",
          toEmail: input.email,
          payload: { token, reference: enquiry.reference, senderName: input.name, distributorName: target.name },
        });
      } else {
        await queueDelivery(tx, enquiry.id);
      }
      return enquiry;
    });
    return toResponse(created.reference, created.status);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const again = await prisma.enquiry.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (again) return toResponse(again.reference, again.status);
    }
    throw err;
  }
}

/** Notify the brand (and confirm to the sender) once the enquiry is deliverable. */
async function queueDelivery(tx: Prisma.TransactionClient, enquiryId: string): Promise<void> {
  const e = await tx.enquiry.findUniqueOrThrow({
    where: { id: enquiryId },
    include: { organisation: { select: { notificationEmail: true } }, distributor: { select: { name: true } } },
  });
  if (e.organisation.notificationEmail) {
    await enqueue(tx, {
      dedupeKey: `enquiry-brand:${e.id}`,
      template: "enquiry-brand",
      toEmail: e.organisation.notificationEmail,
      payload: {
        reference: e.reference,
        distributorName: e.distributor.name,
        senderName: e.senderName,
        senderEmail: e.senderEmail,
        senderPhone: e.senderPhone ?? undefined,
        senderLocation: e.senderLocation,
        message: e.message,
      },
    });
  }
  await enqueue(tx, {
    dedupeKey: `enquiry-confirmation:${e.id}`,
    template: "enquiry-confirmation",
    toEmail: e.senderEmail,
    payload: { reference: e.reference, senderName: e.senderName, distributorName: e.distributor.name },
  });
}

export async function verifyEnquiry(token: string): Promise<{ reference: string; distributorName: string }> {
  const enquiry = await prisma.enquiry.findUnique({
    where: { verificationTokenHash: sha256(token) },
    include: { distributor: { select: { name: true, slug: true } } },
  });
  if (!enquiry) {
    throw new HttpError(400, "INVALID_TOKEN", "This confirmation link is not valid. If you copied it, check that the whole link was included.");
  }
  // Re-opening an already-used link is harmless: report the same success instead of an error.
  if (enquiry.status !== "PENDING_VERIFICATION") return { reference: enquiry.reference, distributorName: enquiry.distributor.name };
  if (!enquiry.verificationExpiresAt || enquiry.verificationExpiresAt < new Date()) {
    throw new HttpError(410, "TOKEN_EXPIRED", "This confirmation link has expired.");
  }
  if (!(await getEligibleId(enquiry.distributor.slug))) throw unavailable();

  await prisma.$transaction(async (tx) => {
    // Conditional update makes concurrent clicks safe: only one flips the status.
    const res = await tx.enquiry.updateMany({
      where: { id: enquiry.id, status: "PENDING_VERIFICATION" },
      data: { status: "NEW", verifiedAt: new Date() },
    });
    if (res.count === 1) await queueDelivery(tx, enquiry.id);
  });
  return { reference: enquiry.reference, distributorName: enquiry.distributor.name };
}

export async function resendVerification(reference: string, email: string): Promise<void> {
  const e = await prisma.enquiry.findUnique({ where: { reference }, include: { distributor: { select: { name: true } } } });
  // Identical outcome whether or not the pair matches: never confirm that an address submitted an enquiry.
  if (!e || e.senderEmail !== email.trim().toLowerCase() || e.status !== "PENDING_VERIFICATION") return;
  if (e.verificationSends >= MAX_VERIFICATION_SENDS) {
    throw new HttpError(429, "RESEND_LIMIT", "The maximum number of confirmation emails has been sent for this enquiry.");
  }
  const token = newToken();
  const n = e.verificationSends + 1;
  await prisma.$transaction(async (tx) => {
    await tx.enquiry.update({
      where: { id: e.id },
      data: { verificationTokenHash: sha256(token), verificationExpiresAt: new Date(Date.now() + TOKEN_TTL_MS), verificationSends: n },
    });
    await enqueue(tx, {
      dedupeKey: `enquiry-verify:${e.id}:${n}`,
      template: "enquiry-verify",
      toEmail: e.senderEmail,
      payload: { token, reference: e.reference, senderName: e.senderName, distributorName: e.distributor.name },
    });
  });
}

function toResponse(reference: string, status: string): EnquiryResponse {
  const pending = status === "PENDING_VERIFICATION";
  return { reference, status: pending ? "PENDING_VERIFICATION" : "NEW", requiresEmailVerification: pending };
}
