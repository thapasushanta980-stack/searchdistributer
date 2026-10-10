import type { AdPlacementCode, Prisma } from "@prisma/client";
import type { AdDTO } from "@sd/shared";
import { config } from "../../config.js";
import { prisma } from "../../db.js";

const MAX_PER_SLOT = 4;

/** Only absolute http(s) URLs or site-relative paths. Blocks javascript:, data: and protocol-relative URLs. */
export function safeDestination(raw: string): string | null {
  const url = raw.trim();
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Eligibility, evaluated against the current time on every request (a delayed scheduler can never keep an ad live):
 * approved creative + verified payment + inside [startsAt, endsAt) + advertiser still publishable.
 */
function eligibleWhere(now: Date): Prisma.AdCampaignWhereInput {
  return {
    status: "APPROVED",
    paymentVerified: true,
    startsAt: { lte: now },
    endsAt: { gt: now },
    ...(config.SHOW_DEMO_DATA ? {} : { isDemo: false }),
    OR: [
      { organisationId: null },
      { organisation: { status: "ACTIVE", subscriptionPeriods: { some: { startsAt: { lte: now }, endsAt: { gt: now } } } } },
    ],
  };
}

/** Weighted random order: higher weight tends to rank first, every campaign still gets a turn. */
function weightedOrder<T extends { weight: number }>(rows: T[]): T[] {
  return rows
    .map((r) => ({ r, k: Math.pow(Math.random(), 1 / Math.max(1, r.weight)) }))
    .sort((a, b) => b.k - a.k)
    .map((x) => x.r);
}

export async function listActiveAds(placement: AdPlacementCode): Promise<AdDTO[]> {
  const now = new Date();
  const rows = await prisma.adCampaign.findMany({ where: { AND: [{ placement }, eligibleWhere(now)] }, take: 20 });
  const out: AdDTO[] = [];
  for (const r of weightedOrder(rows)) {
    if (!safeDestination(r.destinationUrl)) continue;
    out.push({
      id: r.id,
      placement: r.placement,
      advertiser: r.advertiserName,
      headline: r.headline,
      description: r.description,
      ctaLabel: r.ctaLabel,
      imageUrl: r.imageUrl,
      imageAlt: r.imageAlt,
      // Clicks go through our redirect so they can be counted.
      href: `/api/v1/ads/${r.id}/click`,
      isDemo: r.isDemo,
    });
    if (out.length >= MAX_PER_SLOT) break;
  }
  return out;
}

/** Counts an impression only for a currently eligible campaign. Returns false if unknown or no longer eligible. */
export async function recordImpression(id: string): Promise<boolean> {
  const res = await prisma.adCampaign.updateMany({ where: { AND: [{ id }, eligibleWhere(new Date())] }, data: { impressions: { increment: 1 } } });
  return res.count === 1;
}

/** Counts the click and returns the validated destination, or null if the campaign is not live. */
export async function recordClick(id: string, count = true): Promise<string | null> {
  const row = await prisma.adCampaign.findFirst({ where: { AND: [{ id }, eligibleWhere(new Date())] }, select: { destinationUrl: true } });
  const dest = row ? safeDestination(row.destinationUrl) : null;
  if (!dest) return null;
  if (count) await prisma.adCampaign.updateMany({ where: { id }, data: { clicks: { increment: 1 } } });
  return dest;
}
