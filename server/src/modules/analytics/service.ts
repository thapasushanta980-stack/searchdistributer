import { createHash } from "node:crypto";
import { Prisma, type AnalyticsEventType } from "@prisma/client";
import type { Request } from "express";
import type { AnalyticsDTO, AnalyticsKpi, AnalyticsRange, CategoryDTO } from "@sd/shared";
import { config } from "../../config.js";
import { prisma } from "../../db.js";
import { logger } from "../../logger.js";
import { getCategoryTree } from "../categories/service.js";

/* ----------------------------- Recording --------------------------- */

const BOT_UA = /bot|crawl|spider|slurp|facebookexternalhit|embedly|preview|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python-requests|httpclient|go-http/i;

export function isBot(req: Request): boolean {
  const ua = req.get("user-agent") ?? "";
  return !ua || BOT_UA.test(ua);
}

/**
 * Anonymous visitor id: a hash of a server secret, today's date, the IP and the user agent.
 * It is the same all day (so unique visitors can be counted) and different tomorrow (so nobody can be followed).
 * The IP itself is never stored.
 */
export function visitorHash(req: Request, now = new Date()): string {
  const day = now.toISOString().slice(0, 10);
  return createHash("sha256")
    .update(`${config.DATABASE_URL}|${day}|${req.ip ?? ""}|${req.get("user-agent") ?? ""}`)
    .digest("hex")
    .slice(0, 16);
}

const deviceOf = (req: Request) => (/mobi|android|iphone|ipad/i.test(req.get("user-agent") ?? "") ? "mobile" : "desktop");

/** Cloudflare's visitor country; XX = unknown, T1 = Tor. */
function countryOf(req: Request): string | null {
  const c = (req.get("cf-ipcountry") ?? "").toUpperCase();
  return /^[A-Z]{2}$/.test(c) && c !== "XX" && c !== "T1" ? c : null;
}

/** Lower-case, collapse spaces, trim: "  Tea  Leaves" and "tea leaves" count as one search. */
export const normalise = (v: string | null | undefined, max = 80) => {
  const s = (v ?? "").toLowerCase().replace(/\s+/g, " ").trim().slice(0, max);
  return s || null;
};

export interface EventData {
  type: AnalyticsEventType;
  scope?: string | null;
  query?: string | null;
  location?: string | null;
  categorySlug?: string | null;
  resultCount?: number | null;
  distributorId?: string | null;
  productId?: string | null;
}

/** Fire-and-forget: analytics must never slow down or break the request that triggered it. */
export function recordEvent(req: Request, e: EventData): void {
  if (isBot(req)) return;
  prisma.analyticsEvent
    .create({
      data: {
        type: e.type,
        visitor: visitorHash(req),
        scope: e.scope ?? null,
        query: normalise(e.query),
        location: normalise(e.location),
        categorySlug: e.categorySlug ?? null,
        resultCount: e.resultCount ?? null,
        distributorId: e.distributorId ?? null,
        productId: e.productId ?? null,
        country: countryOf(req),
        device: deviceOf(req),
      },
    })
    .catch((err) => logger.warn(`analytics event dropped: ${(err as Error).message}`));
}

/** Raw events are kept ~13 months, enough for year-on-year comparisons. */
export async function purgeOldEvents(now = new Date()) {
  const cutoff = new Date(now.getTime() - 400 * 86_400_000);
  await prisma.analyticsEvent.deleteMany({ where: { createdAt: { lt: cutoff } } });
}

export function startAnalyticsPurge(intervalMs = 24 * 60 * 60 * 1000): () => void {
  const timer = setInterval(() => void purgeOldEvents().catch(() => undefined), intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}

/* ----------------------------- Reporting --------------------------- */

const n = (v: bigint | number | null | undefined) => Number(v ?? 0);

/**
 * The analytics report for the last `range` days (ending now), with the previous period of the same length
 * for comparison. Days and hours are in the site's timezone.
 */
export async function getAnalytics(range: AnalyticsRange, now = new Date()): Promise<AnalyticsDTO> {
  const tz = config.SITE_TIMEZONE;
  const from = new Date(now.getTime() - range * 86_400_000);
  const prevFrom = new Date(from.getTime() - range * 86_400_000);
  const inRange = Prisma.sql`e."createdAt" >= ${from} AND e."createdAt" < ${now}`;
  const contactTypes = Prisma.sql`('WHATSAPP_CLICK', 'ENQUIRY')`;

  const kpiRows = (start: Date, end: Date) => prisma.$queryRaw<
    Array<{ visitors: bigint; searches: bigint; zero: bigint; views: bigint; whatsapp: bigint; enquiries: bigint; leads: bigint }>
  >`
    SELECT COUNT(DISTINCT e."visitor") AS visitors,
           COUNT(*) FILTER (WHERE e."type" = 'SEARCH') AS searches,
           COUNT(*) FILTER (WHERE e."type" = 'SEARCH' AND e."resultCount" = 0) AS zero,
           COUNT(*) FILTER (WHERE e."type" = 'LISTING_VIEW') AS views,
           COUNT(*) FILTER (WHERE e."type" = 'WHATSAPP_CLICK') AS whatsapp,
           COUNT(*) FILTER (WHERE e."type" = 'ENQUIRY') AS enquiries,
           COUNT(*) FILTER (WHERE e."type" = 'LEAD') AS leads
    FROM "analytics_events" e
    WHERE e."createdAt" >= ${start} AND e."createdAt" < ${end}`;

  const [cur, prev, daily, heat, topSearches, unmet, locations, catRows, listingRows, devices, countries, tree] = await Promise.all([
    kpiRows(from, now),
    kpiRows(prevFrom, from),
    prisma.$queryRaw<Array<{ day: string; visitors: bigint; searches: bigint; views: bigint; contacts: bigint }>>`
      SELECT to_char(date_trunc('day', e."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${tz}), 'YYYY-MM-DD') AS day,
             COUNT(DISTINCT e."visitor") AS visitors,
             COUNT(*) FILTER (WHERE e."type" = 'SEARCH') AS searches,
             COUNT(*) FILTER (WHERE e."type" = 'LISTING_VIEW') AS views,
             COUNT(*) FILTER (WHERE e."type" IN ${contactTypes}) AS contacts
      FROM "analytics_events" e WHERE ${inRange}
      GROUP BY 1 ORDER BY 1`,
    prisma.$queryRaw<Array<{ dow: number; hour: number; count: bigint }>>`
      SELECT EXTRACT(DOW FROM e."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${tz})::int AS dow,
             EXTRACT(HOUR FROM e."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${tz})::int AS hour,
             COUNT(*) AS count
      FROM "analytics_events" e WHERE ${inRange}
      GROUP BY 1, 2`,
    prisma.$queryRaw<Array<{ query: string; count: bigint; avg: number | null; zero: bigint }>>`
      SELECT e."query", COUNT(*) AS count, AVG(e."resultCount")::float AS avg, COUNT(*) FILTER (WHERE e."resultCount" = 0) AS zero
      FROM "analytics_events" e WHERE ${inRange} AND e."type" = 'SEARCH' AND e."query" IS NOT NULL
      GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 25`,
    prisma.$queryRaw<Array<{ query: string; location: string | null; count: bigint; last: Date }>>`
      SELECT e."query", MODE() WITHIN GROUP (ORDER BY e."location") AS location, COUNT(*) AS count, MAX(e."createdAt") AS last
      FROM "analytics_events" e WHERE ${inRange} AND e."type" = 'SEARCH' AND e."query" IS NOT NULL
      GROUP BY 1 HAVING MAX(e."resultCount") = 0
      ORDER BY 3 DESC, 4 DESC LIMIT 25`,
    prisma.$queryRaw<Array<{ location: string; count: bigint }>>`
      SELECT e."location", COUNT(*) AS count
      FROM "analytics_events" e WHERE ${inRange} AND e."type" = 'SEARCH' AND e."location" IS NOT NULL
      GROUP BY 1 ORDER BY 2 DESC LIMIT 15`,
    prisma.$queryRaw<Array<{ slug: string; searches: bigint; views: bigint; contacts: bigint }>>`
      SELECT e."categorySlug" AS slug,
             COUNT(*) FILTER (WHERE e."type" = 'SEARCH') AS searches,
             COUNT(*) FILTER (WHERE e."type" IN ('CATEGORY_VIEW', 'LISTING_VIEW', 'PRODUCT_VIEW')) AS views,
             COUNT(*) FILTER (WHERE e."type" IN ${contactTypes}) AS contacts
      FROM "analytics_events" e WHERE ${inRange} AND e."categorySlug" IS NOT NULL
      GROUP BY 1`,
    prisma.$queryRaw<Array<{ id: string; name: string | null; slug: string | null; views: bigint; whatsapp: bigint; enquiries: bigint }>>`
      SELECT e."distributorId" AS id, d."name", d."slug",
             COUNT(*) FILTER (WHERE e."type" = 'LISTING_VIEW') AS views,
             COUNT(*) FILTER (WHERE e."type" = 'WHATSAPP_CLICK') AS whatsapp,
             COUNT(*) FILTER (WHERE e."type" = 'ENQUIRY') AS enquiries
      FROM "analytics_events" e LEFT JOIN "distributors" d ON d."id" = e."distributorId"
      WHERE ${inRange} AND e."distributorId" IS NOT NULL
      GROUP BY 1, 2, 3 ORDER BY 4 DESC, 5 DESC LIMIT 15`,
    prisma.$queryRaw<Array<{ device: string; count: bigint }>>`
      SELECT COALESCE(e."device", 'unknown') AS device, COUNT(DISTINCT e."visitor") AS count
      FROM "analytics_events" e WHERE ${inRange} GROUP BY 1 ORDER BY 2 DESC`,
    prisma.$queryRaw<Array<{ country: string; count: bigint }>>`
      SELECT e."country", COUNT(DISTINCT e."visitor") AS count
      FROM "analytics_events" e WHERE ${inRange} AND e."country" IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 10`,
    getCategoryTree(),
  ]);

  const kpi = (c: number, p: number): AnalyticsKpi => ({ current: c, previous: p });
  const ratio = (a: number, b: number) => (b ? a / b : 0);
  const [c] = cur;
  const [p] = prev;

  // Every day in range, including quiet ones, so the trend line never skips.
  const byDay = new Map(daily.map((d) => [d.day, d]));
  const fmtDay = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
  const days: AnalyticsDTO["daily"] = [];
  for (let i = range - 1; i >= 0; i--) {
    const date = fmtDay.format(new Date(now.getTime() - i * 86_400_000));
    const r = byDay.get(date);
    days.push({ date, visitors: n(r?.visitors), searches: n(r?.searches), listingViews: n(r?.views), contacts: n(r?.contacts) });
  }

  // Categories: every node of the tree, with its parent's name, demand from events and supply from live listings.
  const flat: Array<{ node: CategoryDTO; parent: CategoryDTO | null }> = tree.flatMap((root) => [{ node: root, parent: null }, ...root.children.map((ch) => ({ node: ch, parent: root }))]);
  const demand = new Map(catRows.map((r) => [r.slug, r]));
  const categories: AnalyticsDTO["categories"] = flat
    .map(({ node, parent }) => {
      const d = demand.get(node.slug);
      return { slug: node.slug, name: node.name, parentName: parent?.name ?? null, searches: n(d?.searches), views: n(d?.views), contacts: n(d?.contacts), liveListings: node.distributorCount };
    })
    .sort((a, b) => b.searches + b.views - (a.searches + a.views) || a.name.localeCompare(b.name));

  return {
    range,
    timezone: tz,
    kpis: {
      visitors: kpi(n(c?.visitors), n(p?.visitors)),
      searches: kpi(n(c?.searches), n(p?.searches)),
      zeroResultRate: kpi(ratio(n(c?.zero), n(c?.searches)), ratio(n(p?.zero), n(p?.searches))),
      listingViews: kpi(n(c?.views), n(p?.views)),
      whatsappClicks: kpi(n(c?.whatsapp), n(p?.whatsapp)),
      enquiries: kpi(n(c?.enquiries), n(p?.enquiries)),
      contactRate: kpi(ratio(n(c?.whatsapp) + n(c?.enquiries), n(c?.views)), ratio(n(p?.whatsapp) + n(p?.enquiries), n(p?.views))),
      newLeads: kpi(n(c?.leads), n(p?.leads)),
    },
    daily: days,
    heatmap: heat.map((h) => ({ dow: h.dow, hour: h.hour, count: n(h.count) })),
    topSearches: topSearches.map((s) => ({ query: s.query, count: n(s.count), avgResults: Math.round((s.avg ?? 0) * 10) / 10, zeroResults: n(s.zero) })),
    unmetSearches: unmet.map((u) => ({ query: u.query, location: u.location, count: n(u.count), lastAt: u.last.toISOString() })),
    topLocations: locations.map((l) => ({ location: l.location, count: n(l.count) })),
    categories,
    topListings: listingRows.map((l) => ({ id: l.id, name: l.name ?? "Deleted listing", slug: l.slug, views: n(l.views), whatsapp: n(l.whatsapp), enquiries: n(l.enquiries) })),
    devices: devices.map((d) => ({ device: d.device, count: n(d.count) })),
    countries: countries.map((x) => ({ country: x.country, count: n(x.count) })),
  };
}
