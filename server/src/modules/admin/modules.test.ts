/**
 * Integration tests for the admin modules (inbox, enquiries, requirements, listings, products, ads) against a real Postgres.
 * Like public-eligibility.test.ts they run only when TEST_DATABASE_URL points at a migrated, disposable database.
 */
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminAdInputSchema, adminListingInputSchema, adminProductInputSchema, distributorSearchSchema } from "@sd/shared";

const url = process.env.TEST_DATABASE_URL;
const TAG = "Zzqxadmin";
const day = 86_400_000;

describe.skipIf(!url)("admin modules (real database)", () => {
  const db = new PrismaClient({ datasources: { db: { url: url ?? "" } } });
  let inbox: typeof import("./inbox.js");
  let listings: typeof import("./listings.js");
  let ads: typeof import("./ads.js");
  let stats: typeof import("./service.js");
  let pub: typeof import("../distributors/service.js");
  let pubProducts: typeof import("../products/service.js");
  let pubAds: typeof import("../ads/service.js");
  let actor: { id: string; ip: string };

  const listingInput = (over: Record<string, unknown> = {}) =>
    adminListingInputSchema.parse({
      name: `${TAG} Himalayan Foods`,
      businessType: "DISTRIBUTOR",
      summary: "Packaged food distribution across the valley.",
      description: "We distribute packaged foods and beverages to retailers across Kathmandu valley.",
      location: "Kathmandu, Nepal",
      coverage: "NATIONAL",
      verificationStatus: "NONE",
      ...over,
    });
  const status = async (p: Promise<unknown>) => p.then(() => 200, (e: { status?: number }) => e.status ?? 500);

  async function cleanup() {
    const orgs = await db.organisation.findMany({ where: { name: { startsWith: TAG } }, select: { id: true } });
    const ids = orgs.map((o) => o.id);
    await db.enquiry.deleteMany({ where: { organisationId: { in: ids } } });
    await db.organisation.deleteMany({ where: { id: { in: ids } } });
    await db.lead.deleteMany({ where: { name: { startsWith: TAG } } });
    await db.requirement.deleteMany({ where: { title: { startsWith: TAG } } });
    await db.adCampaign.deleteMany({ where: { advertiserName: { startsWith: TAG } } });
    await db.adminUser.deleteMany({ where: { email: `${TAG.toLowerCase()}@example.com` } });
  }

  beforeAll(async () => {
    inbox = await import("./inbox.js");
    listings = await import("./listings.js");
    ads = await import("./ads.js");
    stats = await import("./service.js");
    pub = await import("../distributors/service.js");
    pubProducts = await import("../products/service.js");
    pubAds = await import("../ads/service.js");
    await cleanup();
    const admin = await db.adminUser.create({ data: { email: `${TAG.toLowerCase()}@example.com`, name: TAG, passwordHash: "x", role: "SUPER_ADMIN" } });
    actor = { id: admin.id, ip: "198.51.100.7" };
  });
  afterAll(async () => {
    await cleanup();
    await db.$disconnect();
  });

  it("works a lead: status, notes, audit trail and delete", async () => {
    const lead = await db.lead.create({
      data: { reference: `REG-${Date.now()}`, type: "BUSINESS_REGISTRATION", idempotencyKey: `${TAG}-${Date.now()}`, name: `${TAG} Ram`, email: "ram@example.com", message: "Please list us", consentAt: new Date() },
    });
    expect((await inbox.listLeads({ status: "NEW", q: TAG, page: 1 })).data.map((l) => l.id)).toContain(lead.id);

    const updated = await inbox.updateLead(lead.id, { status: "CONTACTED", notes: "Called on Monday" }, actor);
    expect(updated).toMatchObject({ status: "CONTACTED", notes: "Called on Monday" });
    const trail = await db.auditLog.findMany({ where: { entityId: lead.id } });
    expect(trail.map((a) => a.action)).toContain("lead.update");
    expect(trail[0]?.ip).toBe("198.51.100.7");

    await inbox.deleteLead(lead.id, actor);
    expect(await db.lead.findUnique({ where: { id: lead.id } })).toBeNull();
    expect(await status(inbox.deleteLead(lead.id, actor))).toBe(404);
  });

  it("takes a listing from draft to live on the public site, then off again", async () => {
    const lead = await db.lead.create({
      data: { reference: `REG-${Date.now()}b`, type: "BUSINESS_REGISTRATION", idempotencyKey: `${TAG}-${Date.now()}b`, name: `${TAG} Sita`, email: "sita@example.com", message: "List us", consentAt: new Date() },
    });
    const created = await listings.createListing({ ...listingInput(), fromLeadId: lead.id }, actor);
    expect(created.status).toBe("DRAFT");
    expect(created.visibility.isPublic).toBe(false);
    expect((await db.lead.findUnique({ where: { id: lead.id } }))?.status).toBe("CONVERTED");

    // Can't publish without a listing period.
    expect(await status(listings.actOnListing(created.id, { action: "PUBLISH" }, actor))).toBe(409);

    const until = new Date(Date.now() + 30 * day).toISOString();
    const saved = await listings.updateListing(created.id, listingInput({ listedUntil: until }), actor);
    expect(saved.listedUntil).toBe(until);
    expect(saved.visibility.subscriptionActive).toBe(true);

    const live = await listings.actOnListing(created.id, { action: "PUBLISH" }, actor);
    expect(live.visibility).toMatchObject({ approved: true, published: true, profileApproved: true, isPublic: true });
    expect(await pub.getDistributorBySlug(created.slug)).not.toBeNull();
    const found = await pub.searchDistributors(distributorSearchSchema.parse({ keyword: TAG }));
    expect(found.data.map((d) => d.slug)).toContain(created.slug);

    // A published product shows publicly under a live listing.
    const product = await listings.createProduct(created.id, adminProductInputSchema.parse({ name: "Instant Noodles", published: true }), actor);
    expect(product.publicSlug).toBe(`${created.slug}-instant-noodles`);
    expect(await pubProducts.getProductBySlug(product.publicSlug)).not.toBeNull();
    const hidden = await listings.updateProduct(created.id, product.id, adminProductInputSchema.parse({ name: "Instant Noodles", published: false }), actor);
    expect(hidden.published).toBe(false);
    expect(await pubProducts.getProductBySlug(product.publicSlug)).toBeNull();

    const paused = await listings.actOnListing(created.id, { action: "PAUSE" }, actor);
    expect(paused.visibility.isPublic).toBe(false);
    expect(await pub.getDistributorBySlug(created.slug)).toBeNull();

    // An expired listing period takes it off the site even when approved and published.
    await listings.actOnListing(created.id, { action: "PUBLISH" }, actor);
    await listings.updateListing(created.id, listingInput({ listedUntil: new Date(Date.now() - day).toISOString() }), actor);
    expect((await listings.getListing(created.id)).visibility.isPublic).toBe(false);
    expect(await pub.getDistributorBySlug(created.slug)).toBeNull();
  });

  it("gives listings with the same name distinct web addresses", async () => {
    const a = await listings.createListing(listingInput({ name: `${TAG} Twin Traders` }), actor);
    const b = await listings.createListing(listingInput({ name: `${TAG} Twin Traders` }), actor);
    expect(a.slug).not.toBe(b.slug);
    expect(b.slug).toBe(`${a.slug}-2`);
  });

  it("deletes a listing together with its products, enquiries and organisation", async () => {
    const l = await listings.createListing(listingInput({ name: `${TAG} Gone Soon` }), actor);
    await listings.createProduct(l.id, adminProductInputSchema.parse({ name: "Tea" }), actor);
    const d = await db.distributor.findUniqueOrThrow({ where: { id: l.id } });
    await db.enquiry.create({
      data: {
        reference: `ENQ-${Date.now()}`,
        organisationId: d.organisationId,
        distributorId: d.id,
        idempotencyKey: `${TAG}-enq-${Date.now()}`,
        senderName: "Buyer",
        senderEmail: "buyer@example.com",
        senderLocation: "Pokhara",
        message: "Interested",
        consentAt: new Date(),
      },
    });
    await listings.deleteListing(l.id, actor);
    expect(await db.distributor.findUnique({ where: { id: l.id } })).toBeNull();
    expect(await db.product.count({ where: { distributorId: l.id } })).toBe(0);
    expect(await db.enquiry.count({ where: { distributorId: l.id } })).toBe(0);
    expect(await db.organisation.findUnique({ where: { id: d.organisationId } })).toBeNull();
  });

  it("only lets confirmed enquiries be worked, and flags spam", async () => {
    const l = await listings.createListing(listingInput({ name: `${TAG} Enquiry Target` }), actor);
    const d = await db.distributor.findUniqueOrThrow({ where: { id: l.id } });
    const e = await db.enquiry.create({
      data: {
        reference: `ENQ-${Date.now()}c`,
        organisationId: d.organisationId,
        distributorId: d.id,
        idempotencyKey: `${TAG}-enq-${Date.now()}c`,
        senderName: "Buyer",
        senderEmail: "buyer@example.com",
        senderLocation: "Pokhara",
        message: "Interested",
        consentAt: new Date(),
      },
    });
    expect(await status(inbox.updateEnquiry(e.id, { status: "CONTACTED" }, actor))).toBe(409);
    expect((await inbox.updateEnquiry(e.id, { spamFlag: true }, actor)).spamFlag).toBe(true);
    await db.enquiry.update({ where: { id: e.id }, data: { status: "NEW" } });
    expect((await inbox.updateEnquiry(e.id, { status: "CONTACTED" }, actor)).status).toBe("CONTACTED");
    expect((await inbox.listEnquiries({ distributorId: d.id, page: 1 })).data).toHaveLength(1);
    await inbox.deleteEnquiry(e.id, actor);
    expect(await db.enquiry.findUnique({ where: { id: e.id } })).toBeNull();
  });

  it("closes, reopens and deletes requirements with their responses", async () => {
    const r = await db.requirement.create({
      data: {
        reference: `REQ-${Date.now()}`,
        slug: `zzqx-req-${Date.now()}`,
        idempotencyKey: `${TAG}-req-${Date.now()}`,
        kind: "DISTRIBUTOR",
        title: `${TAG} Need a distributor`,
        description: "Looking for a distributor in Pokhara.",
        preferredLocation: "Pokhara",
        contactName: "Hari",
        contactEmail: "hari@example.com",
        contactPhone: "9800000000",
        contactLocation: "Pokhara",
        consentAt: new Date(),
        status: "PENDING_REVIEW",
        responses: { create: { reference: `RES-${Date.now()}`, idempotencyKey: `${TAG}-res-${Date.now()}`, senderName: "Supplier", senderEmail: "s@example.com", senderLocation: "Butwal", message: "We can help", consentAt: new Date() } },
      },
    });
    expect(await status(inbox.setRequirementStatus(r.id, "CLOSED", actor))).toBe(409); // still pending
    await stats.decideRequirement(r.id, { decision: "APPROVE" }, actor);
    expect((await inbox.setRequirementStatus(r.id, "CLOSED", actor)).status).toBe("CLOSED");
    expect((await inbox.setRequirementStatus(r.id, "APPROVED", actor)).status).toBe("APPROVED");
    expect(await inbox.listRequirementResponses(r.id)).toHaveLength(1);
    const listed = await stats.listRequirements("APPROVED", 1);
    expect(listed.data.find((x) => x.id === r.id)?.responseCount).toBe(1);
    await inbox.deleteRequirement(r.id, actor);
    expect(await db.requirementResponse.count({ where: { requirementId: r.id } })).toBe(0);
  });

  it("runs an ad only when approved, paid and in its dates", async () => {
    const input = adminAdInputSchema.parse({
      placement: "HOME_HERO_BANNER",
      advertiserName: `${TAG} Advertiser`,
      headline: "Grow with us",
      destinationUrl: "https://example.com/offer",
      startsAt: new Date(Date.now() - day).toISOString(),
      endsAt: new Date(Date.now() + 7 * day).toISOString(),
    });
    const draft = await ads.createAd(input, actor);
    expect(draft).toMatchObject({ status: "DRAFT", isLive: false });

    const approved = await ads.actOnAd(draft.id, { action: "APPROVE" }, actor);
    expect(approved.isLive).toBe(false); // not paid yet
    const paid = await ads.updateAd(draft.id, { ...input, paymentVerified: true }, actor);
    expect(paid.isLive).toBe(true);
    expect((await pubAds.listActiveAds("HOME_HERO_BANNER")).map((a) => a.id)).toContain(draft.id);

    expect(await status(ads.actOnAd(draft.id, { action: "RESUME" }, actor))).toBe(409);
    expect((await ads.actOnAd(draft.id, { action: "PAUSE" }, actor)).isLive).toBe(false);
    expect((await ads.actOnAd(draft.id, { action: "RESUME" }, actor)).isLive).toBe(true);

    await ads.deleteAd(draft.id, actor);
    expect(await db.adCampaign.findUnique({ where: { id: draft.id } })).toBeNull();
  });

  it("reports the new dashboard counts", async () => {
    const s = await stats.getStats();
    for (const k of ["leadsNew", "enquiriesNew", "adsLive", "listingsLive"] as const) expect(typeof s[k]).toBe("number");
  });
});
