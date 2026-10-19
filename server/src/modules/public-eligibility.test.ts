/**
 * Integration tests for the rules that decide what is PUBLIC: distributor eligibility, requirement moderation and ad serving.
 * They need a real Postgres (raw SQL + pg_trgm), so they only run when TEST_DATABASE_URL is set to a migrated, disposable database:
 *   TEST_DATABASE_URL=postgresql://distributor:distributor@localhost:5433/sd_test?schema=public npm test -w server
 */
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { distributorSearchSchema } from "@sd/shared";

const url = process.env.TEST_DATABASE_URL;
const TAG = "Zzqxtest";
const day = 86_400_000;

describe.skipIf(!url)("public eligibility (real database)", () => {
  const db = new PrismaClient({ datasources: { db: { url: url ?? "" } } });
  let svc: typeof import("./distributors/service.js");
  let reqSvc: typeof import("./requirements/service.js");
  let adSvc: typeof import("./ads/service.js");

  const slugs: Record<string, string> = {};

  async function listing(key: string, o: { org?: Record<string, unknown>; dist?: Record<string, unknown>; sub?: "live" | "expired" | "future" | "none" }) {
    const now = Date.now();
    const slug = `t-elig-${key}`;
    slugs[key] = slug;
    const sub = o.sub ?? "live";
    const period =
      sub === "live" ? { startsAt: new Date(now - day), endsAt: new Date(now + day) }
      : sub === "expired" ? { startsAt: new Date(now - 3 * day), endsAt: new Date(now - day) }
      : sub === "future" ? { startsAt: new Date(now + day), endsAt: new Date(now + 3 * day) }
      : null;
    await db.organisation.create({
      data: {
        name: `${TAG} org ${key}`,
        status: "ACTIVE",
        profileReviewStatus: "APPROVED",
        ...o.org,
        subscriptionPeriods: period ? { create: period } : undefined,
        distributors: {
          create: {
            name: `${TAG} ${key}`,
            slug,
            summary: `${TAG} summary`,
            description: `${TAG} description`,
            location: "Kathmandu, Nepal",
            status: "APPROVED",
            publicationEnabled: true,
            ...o.dist,
          },
        },
      },
    });
  }

  beforeAll(async () => {
    svc = await import("./distributors/service.js");
    reqSvc = await import("./requirements/service.js");
    adSvc = await import("./ads/service.js");
    await cleanup();

    await listing("ok", {});
    await listing("draft", { dist: { status: "DRAFT" } });
    await listing("submitted", { dist: { status: "SUBMITTED" } });
    await listing("rejected", { dist: { status: "REJECTED" } });
    await listing("paused", { dist: { status: "PAUSED" } });
    await listing("archived", { dist: { status: "ARCHIVED" } });
    await listing("disabled", { dist: { publicationEnabled: false } });
    await listing("suspended-org", { org: { status: "SUSPENDED" } });
    await listing("profile-draft", { org: { profileReviewStatus: "DRAFT" } });
    await listing("profile-rejected", { org: { profileReviewStatus: "REJECTED" } });
    await listing("sub-expired", { sub: "expired" });
    await listing("sub-future", { sub: "future" });
    await listing("sub-none", { sub: "none" });
    await listing("demo", { dist: { isDemo: true } });

    const base = { reference: "", idempotencyKey: "", kind: "DISTRIBUTOR" as const, title: `${TAG} wanted`, description: "d", preferredLocation: "Nepal", contactName: "n", contactEmail: "e@example.test", contactPhone: "1", contactLocation: "Nepal", consentAt: new Date() };
    for (const [key, status, isDemo] of [["approved", "APPROVED", false], ["pending", "PENDING_REVIEW", false], ["rejected", "REJECTED", false], ["closed", "CLOSED", false], ["demo", "APPROVED", true]] as const) {
      await db.requirement.create({ data: { ...base, reference: `T-REQ-${key}`, idempotencyKey: `t-req-${key}`, slug: `t-req-${key}`, status, isDemo } });
    }

    const ad = { placement: "HOME_FOOTER_BANNER" as const, advertiserName: TAG, destinationUrl: "https://example.test/", startsAt: new Date(Date.now() - day), endsAt: new Date(Date.now() + day) };
    const ads: Array<[string, Record<string, unknown>]> = [
      ["live", { status: "APPROVED", paymentVerified: true }],
      ["pending", { status: "PENDING_REVIEW", paymentVerified: true }],
      ["draft", { status: "DRAFT", paymentVerified: true }],
      ["rejected", { status: "REJECTED", paymentVerified: true }],
      ["paused", { status: "PAUSED", paymentVerified: true }],
      ["unpaid", { status: "APPROVED", paymentVerified: false }],
      ["expired", { status: "APPROVED", paymentVerified: true, startsAt: new Date(Date.now() - 3 * day), endsAt: new Date(Date.now() - day) }],
      ["future", { status: "APPROVED", paymentVerified: true, startsAt: new Date(Date.now() + day), endsAt: new Date(Date.now() + 3 * day) }],
      ["js-url", { status: "APPROVED", paymentVerified: true, destinationUrl: "javascript:alert(1)" }],
      ["demo", { status: "APPROVED", paymentVerified: true, isDemo: true }],
    ];
    for (const [key, o] of ads) await db.adCampaign.create({ data: { ...ad, headline: `${TAG} ad ${key}`, ...o } });
  });

  async function cleanup() {
    await db.organisation.deleteMany({ where: { name: { startsWith: TAG } } });
    await db.requirement.deleteMany({ where: { slug: { startsWith: "t-req-" } } });
    await db.adCampaign.deleteMany({ where: { advertiserName: TAG } });
  }
  afterAll(async () => {
    await cleanup();
    await db.$disconnect();
  });

  it("shows a listing only when listing, organisation and subscription are all in order", async () => {
    expect(await svc.getDistributorBySlug(slugs.ok!)).not.toBeNull();
    for (const key of Object.keys(slugs).filter((k) => k !== "ok")) {
      expect(await svc.getDistributorBySlug(slugs[key]!), `${key} must not be public`).toBeNull();
    }
  });

  it("search returns only the eligible listing", async () => {
    const res = await svc.searchDistributors(distributorSearchSchema.parse({ keyword: TAG, limit: 48 }));
    expect(res.data.map((d) => d.slug)).toEqual([slugs.ok]);
  });

  it("the sitemap slug list contains only the eligible listing", async () => {
    const list = (await svc.listPublicSlugs()).map((s) => s.slug).filter((s) => s.startsWith("t-elig-"));
    expect(list).toEqual([slugs.ok]);
  });

  it("an enquiry target resolves only for an eligible listing", async () => {
    expect(await svc.getEligibleId(slugs.ok!)).not.toBeNull();
    expect(await svc.getEligibleId(slugs["sub-expired"]!)).toBeNull();
    expect(await svc.getEligibleId(slugs.paused!)).toBeNull();
  });

  it("a listing disappears the moment its subscription ends (no job needed)", async () => {
    await db.subscriptionPeriod.updateMany({ where: { organisation: { name: `${TAG} org ok` } }, data: { endsAt: new Date(Date.now() - 1000) } });
    expect(await svc.getDistributorBySlug(slugs.ok!)).toBeNull();
    await db.subscriptionPeriod.updateMany({ where: { organisation: { name: `${TAG} org ok` } }, data: { endsAt: new Date(Date.now() + day) } });
    expect(await svc.getDistributorBySlug(slugs.ok!)).not.toBeNull();
  });

  it("shows only approved, non-demo requirements", async () => {
    expect(await reqSvc.getRequirement("t-req-approved")).not.toBeNull();
    for (const key of ["pending", "rejected", "closed", "demo"]) expect(await reqSvc.getRequirement(`t-req-${key}`), key).toBeNull();
    const slugsListed = (await reqSvc.listPublicRequirementSlugs()).map((r) => r.slug).filter((s) => s.startsWith("t-req-"));
    expect(slugsListed).toEqual(["t-req-approved"]);
  });

  it("serves only approved, paid, in-window ads with a safe destination", async () => {
    const shown = (await adSvc.listActiveAds("HOME_FOOTER_BANNER")).map((a) => a.headline).filter((h) => h.startsWith(TAG));
    expect(shown).toEqual([`${TAG} ad live`]);
  });

  it("does not count impressions or clicks for ads that are not live", async () => {
    const dead = await db.adCampaign.findFirstOrThrow({ where: { headline: `${TAG} ad unpaid` } });
    expect(await adSvc.recordImpression(dead.id)).toBe(false);
    expect(await adSvc.recordClick(dead.id)).toBeNull();
    const live = await db.adCampaign.findFirstOrThrow({ where: { headline: `${TAG} ad live` } });
    expect(await adSvc.recordImpression(live.id)).toBe(true);
    expect((await db.adCampaign.findUniqueOrThrow({ where: { id: live.id } })).impressions).toBe(1);
  });

  it("safeDestination blocks dangerous URLs", () => {
    for (const bad of ["javascript:alert(1)", "data:text/html,x", "//evil.test", "ftp://x.test", "not a url"]) expect(adSvc.safeDestination(bad), bad).toBeNull();
    expect(adSvc.safeDestination("/pricing")).toBe("/pricing");
    expect(adSvc.safeDestination("https://example.test/a")).toBe("https://example.test/a");
  });
});
