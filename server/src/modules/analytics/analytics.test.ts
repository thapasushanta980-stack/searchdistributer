/**
 * Analytics and the tracked WhatsApp redirect against a real Postgres (TEST_DATABASE_URL, migrated and disposable).
 */
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express from "express";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;
const TAG = "Zzqxstats";
const BROWSER = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/137.0 Safari/537.36";
const day = 86_400_000;

describe.skipIf(!url)("analytics (real database)", () => {
  const db = new PrismaClient({ datasources: { db: { url: url ?? "" } } });
  let svc: typeof import("./service.js");
  let server: Server;
  let base: string;
  let listing: { id: string; slug: string };
  const waitFor = async (fn: () => Promise<boolean>) => {
    for (let i = 0; i < 40; i++) {
      if (await fn()) return true;
      await new Promise((r) => setTimeout(r, 50));
    }
    return false;
  };

  beforeAll(async () => {
    svc = await import("./service.js");
    await db.analyticsEvent.deleteMany({});
    const org = await db.organisation.findFirst({ where: { name: `${TAG} org` } });
    if (org) await db.organisation.delete({ where: { id: org.id } });
    const cat = await db.category.findFirst({ where: { parentId: null } });
    const created = await db.organisation.create({
      data: {
        name: `${TAG} org`,
        status: "ACTIVE",
        profileReviewStatus: "APPROVED",
        subscriptionPeriods: { create: { startsAt: new Date(Date.now() - day), endsAt: new Date(Date.now() + 30 * day) } },
        distributors: {
          create: {
            name: `${TAG} Tea House`,
            slug: "zzqx-stats-tea-house",
            summary: "Tea",
            description: "Tea distributor",
            location: "Ilam",
            status: "APPROVED",
            publicationEnabled: true,
            whatsappNumber: "+977 980-0000000",
            categoryId: cat?.id,
          },
        },
      },
      include: { distributors: true },
    });
    listing = created.distributors[0]!;

    const { goRoutes } = await import("../../routes/go.js");
    const { api } = await import("../../routes/api.js");
    const app = express();
    app.use(goRoutes);
    app.use("/api/v1", express.json(), api);
    server = app.listen(0);
    await new Promise((r) => server.once("listening", r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(async () => {
    server?.close();
    await db.analyticsEvent.deleteMany({});
    await db.organisation.deleteMany({ where: { name: `${TAG} org` } });
    await db.$disconnect();
  });

  it("redirects WhatsApp clicks to the business with a credited message, and counts them", async () => {
    const res = await fetch(`${base}/go/whatsapp/${listing.slug}`, { redirect: "manual", headers: { "user-agent": BROWSER } });
    expect(res.status).toBe(302);
    const loc = new URL(res.headers.get("location")!);
    expect(loc.origin + loc.pathname).toBe("https://wa.me/9779800000000");
    expect(loc.searchParams.get("text")).toContain(`I found you on`);
    expect(loc.searchParams.get("text")).toContain(`/distributors/${listing.slug}`);
    expect(await waitFor(async () => (await db.analyticsEvent.count({ where: { type: "WHATSAPP_CLICK", distributorId: listing.id } })) === 1)).toBe(true);
  });

  it("sends unknown or WhatsApp-less listings to the listing page, uncounted", async () => {
    const res = await fetch(`${base}/go/whatsapp/no-such-listing`, { redirect: "manual", headers: { "user-agent": BROWSER } });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/distributors/no-such-listing");
  });

  it("ignores bots", async () => {
    await fetch(`${base}/go/whatsapp/${listing.slug}`, { redirect: "manual", headers: { "user-agent": "Googlebot/2.1" } });
    await fetch(`${base}/api/v1/events`, { method: "POST", headers: { "content-type": "application/json", "user-agent": "curl/8.0" }, body: JSON.stringify({ type: "CATEGORY_VIEW", categorySlug: "x" }) });
    await new Promise((r) => setTimeout(r, 200));
    expect(await db.analyticsEvent.count({ where: { type: "WHATSAPP_CLICK" } })).toBe(1);
    expect(await db.analyticsEvent.count({ where: { type: "CATEGORY_VIEW" } })).toBe(0);
  });

  it("accepts browser events, normalises searches, and drops malformed ones", async () => {
    const post = (body: unknown) => fetch(`${base}/api/v1/events`, { method: "POST", headers: { "content-type": "application/json", "user-agent": BROWSER, "cf-ipcountry": "NP" }, body: JSON.stringify(body) });
    expect((await post({ type: "SEARCH", scope: "distributors", query: "  Green   TEA ", location: "Pokhara", resultCount: 0 })).status).toBe(204);
    expect((await post({ type: "SEARCH", scope: "distributors", query: "green tea", resultCount: 0 })).status).toBe(204);
    expect((await post({ type: "SEARCH", scope: "products", query: "noodles", resultCount: 4 })).status).toBe(204);
    expect((await post({ type: "LISTING_VIEW", distributorId: listing.id })).status).toBe(204);
    expect((await post({ type: "WHATSAPP_CLICK", distributorId: listing.id })).status).toBe(204); // not allowed from the browser
    expect((await post({ type: "SEARCH", scope: "nowhere", resultCount: 1 })).status).toBe(204);
    expect(await waitFor(async () => (await db.analyticsEvent.count({ where: { type: "SEARCH" } })) === 3)).toBe(true);
    const tea = await db.analyticsEvent.findMany({ where: { query: "green tea" } });
    expect(tea).toHaveLength(2);
    expect(tea[0]).toMatchObject({ country: "NP", device: "desktop" });
    expect(tea[0]!.visitor).toHaveLength(16);
    expect(await db.analyticsEvent.count({ where: { type: "WHATSAPP_CLICK" } })).toBe(1);
  });

  it("reports KPIs, unmet demand, trends and per-listing contacts", async () => {
    const a = await svc.getAnalytics(7);
    expect(a.kpis.searches.current).toBe(3);
    expect(a.kpis.zeroResultRate.current).toBeCloseTo(2 / 3);
    expect(a.kpis.listingViews.current).toBe(1);
    expect(a.kpis.whatsappClicks.current).toBe(1);
    expect(a.kpis.contactRate.current).toBe(1);
    expect(a.kpis.visitors.current).toBe(1); // same browser, same day
    expect(a.daily).toHaveLength(7);
    expect(a.daily.reduce((s, d) => s + d.searches, 0)).toBe(3);
    expect(a.topSearches[0]).toMatchObject({ query: "green tea", count: 2, zeroResults: 2 });
    expect(a.unmetSearches.map((u) => u.query)).toEqual(["green tea"]);
    expect(a.unmetSearches[0]!.location).toBe("pokhara");
    expect(a.topLocations[0]).toEqual({ location: "pokhara", count: 1 });
    expect(a.topListings[0]).toMatchObject({ id: listing.id, views: 1, whatsapp: 1 });
    expect(a.heatmap.reduce((s, h) => s + h.count, 0)).toBe(5);
    expect(a.countries).toEqual([{ country: "NP", count: 1 }]);
    expect(a.categories.length).toBeGreaterThan(0);
  });

  it("purges events older than about 13 months", async () => {
    await db.analyticsEvent.create({ data: { type: "SEARCH", visitor: "old", createdAt: new Date(Date.now() - 401 * day) } });
    await svc.purgeOldEvents();
    expect(await db.analyticsEvent.count({ where: { visitor: "old" } })).toBe(0);
  });
});
