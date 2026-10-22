import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { enquiryInputSchema } from "@sd/shared";

const url = process.env.TEST_DATABASE_URL;
const TAG = `Zzqenq${Date.now()}`;
const day = 86_400_000;

describe.skipIf(!url)("listing enquiry delivery (real database)", () => {
  const db = new PrismaClient({ datasources: { db: { url: url ?? "" } } });
  let enquiryService: typeof import("./service.js");
  let adminInbox: typeof import("../admin/inbox.js");
  let organisationId: string | null = null;
  let enquiryId: string | null = null;

  beforeAll(async () => {
    vi.stubEnv("ENQUIRY_EMAIL_VERIFICATION", "true");
    enquiryService = await import("./service.js");
    adminInbox = await import("../admin/inbox.js");
  });

  afterAll(async () => {
    if (enquiryId) {
      await db.notificationOutbox.deleteMany({ where: { dedupeKey: { contains: enquiryId } } });
      await db.enquiry.deleteMany({ where: { id: enquiryId } });
    }
    if (organisationId) await db.organisation.deleteMany({ where: { id: organisationId } });
    await db.$disconnect();
    vi.unstubAllEnvs();
  });

  it("stores a profile enquiry in the admin inbox before email confirmation, then delivers it after confirmation", async () => {
    const now = Date.now();
    const organisation = await db.organisation.create({
      data: {
        name: `${TAG} Business`,
        status: "ACTIVE",
        profileReviewStatus: "APPROVED",
        notificationEmail: "business@example.test",
        subscriptionPeriods: { create: { startsAt: new Date(now - day), endsAt: new Date(now + day) } },
        distributors: {
          create: {
            name: `${TAG} Business`,
            slug: `${TAG.toLowerCase()}-business`,
            summary: "A test distributor accepting business enquiries.",
            description: "This temporary test profile is used to verify the enquiry workflow from form submission to the admin inbox.",
            location: "Kathmandu, Nepal",
            status: "APPROVED",
            publicationEnabled: true,
          },
        },
      },
      include: { distributors: true },
    });
    organisationId = organisation.id;
    const distributor = organisation.distributors[0]!;
    const input = enquiryInputSchema.parse({
      distributorSlug: distributor.slug,
      name: `${TAG} Buyer`,
      email: "buyer@example.test",
      phone: "+9779800000000",
      location: "Pokhara",
      message: "I would like to discuss distribution opportunities for your products.",
      consent: true,
      idempotencyKey: randomUUID(),
    });

    const submitted = await enquiryService.submitEnquiry(input);
    expect(submitted).toMatchObject({ status: "PENDING_VERIFICATION", requiresEmailVerification: true });
    expect(submitted.reference).toMatch(/^ENQ-/);

    const pending = await adminInbox.listEnquiries({ status: "PENDING_VERIFICATION", distributorId: distributor.id, page: 1 });
    expect(pending.pagination.total).toBe(1);
    expect(pending.data[0]).toMatchObject({ reference: submitted.reference, status: "PENDING_VERIFICATION", senderName: input.name });
    enquiryId = pending.data[0]!.id;

    const verificationMail = await db.notificationOutbox.findUniqueOrThrow({ where: { dedupeKey: `enquiry-verify:${enquiryId}:1` } });
    const token = (verificationMail.payload as { token: string }).token;
    expect(token).toBeTruthy();

    await enquiryService.verifyEnquiry(token);
    const confirmed = await adminInbox.listEnquiries({ status: "NEW", distributorId: distributor.id, page: 1 });
    expect(confirmed.pagination.total).toBe(1);
    expect(confirmed.data[0]).toMatchObject({ id: enquiryId, status: "NEW", senderName: input.name });

    const deliveries = await db.notificationOutbox.findMany({ where: { dedupeKey: { contains: enquiryId } } });
    expect(deliveries.map((row) => row.template).sort()).toEqual(["enquiry-brand", "enquiry-confirmation", "enquiry-verify"]);
  });
});
