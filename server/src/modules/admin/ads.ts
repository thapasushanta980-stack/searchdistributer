import type { Prisma } from "@prisma/client";
import { ADMIN_PAGE_SIZE, type AdminAdAction, type AdminAdDTO, type AdminAdInput, type AdminPage, type AdPlacement, type AdStatus } from "@sd/shared";
import { prisma } from "../../db.js";
import { HttpError } from "../../lib/errors.js";
import { eligibleWhere } from "../ads/service.js";
import { audit } from "./audit.js";
import type { Actor } from "./inbox.js";

type AdRow = Prisma.AdCampaignGetPayload<object>;

const toAd = (a: AdRow, live: Set<string>): AdminAdDTO => ({
  id: a.id,
  placement: a.placement,
  advertiserName: a.advertiserName,
  headline: a.headline,
  description: a.description,
  ctaLabel: a.ctaLabel,
  destinationUrl: a.destinationUrl,
  imageUrl: a.imageUrl,
  imageAlt: a.imageAlt,
  startsAt: a.startsAt.toISOString(),
  endsAt: a.endsAt.toISOString(),
  weight: a.weight,
  paymentVerified: a.paymentVerified,
  internalNotes: a.internalNotes,
  status: a.status,
  impressions: a.impressions,
  clicks: a.clicks,
  isLive: live.has(a.id),
  createdAt: a.createdAt.toISOString(),
  updatedAt: a.updatedAt.toISOString(),
});

/** Ids among `ids` that the public site would show right now (same rule as the site itself). */
async function liveIds(ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const rows = await prisma.adCampaign.findMany({ where: { AND: [{ id: { in: ids } }, eligibleWhere(new Date())] }, select: { id: true } });
  return new Set(rows.map((r) => r.id));
}

const fields = (i: AdminAdInput) => ({
  placement: i.placement,
  advertiserName: i.advertiserName,
  headline: i.headline,
  description: i.description,
  ctaLabel: i.ctaLabel,
  destinationUrl: i.destinationUrl,
  imageUrl: i.imageUrl,
  imageAlt: i.imageAlt,
  startsAt: new Date(i.startsAt),
  endsAt: new Date(i.endsAt),
  weight: i.weight,
  paymentVerified: i.paymentVerified,
  internalNotes: i.internalNotes,
});

export async function listAds(f: { status?: AdStatus; placement?: AdPlacement; q?: string; page: number }): Promise<AdminPage<AdminAdDTO>> {
  const where: Prisma.AdCampaignWhereInput = {
    ...(f.status ? { status: f.status } : {}),
    ...(f.placement ? { placement: f.placement } : {}),
    ...(f.q ? { OR: [{ advertiserName: { contains: f.q, mode: "insensitive" } }, { headline: { contains: f.q, mode: "insensitive" } }] } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.adCampaign.findMany({ where, orderBy: { createdAt: "desc" }, skip: (f.page - 1) * ADMIN_PAGE_SIZE, take: ADMIN_PAGE_SIZE }),
    prisma.adCampaign.count({ where }),
  ]);
  const live = await liveIds(rows.map((r) => r.id));
  return { data: rows.map((r) => toAd(r, live)), pagination: { page: f.page, limit: ADMIN_PAGE_SIZE, total, totalPages: Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE)) } };
}

export async function getAd(id: string): Promise<AdminAdDTO> {
  const a = await prisma.adCampaign.findUnique({ where: { id } });
  if (!a) throw new HttpError(404, "NOT_FOUND", "Campaign not found.");
  return toAd(a, await liveIds([id]));
}

/** New campaigns start as drafts; approving is a separate, audited step. */
export async function createAd(input: AdminAdInput, actor: Actor): Promise<AdminAdDTO> {
  const a = await prisma.$transaction(async (tx) => {
    const created = await tx.adCampaign.create({ data: { ...fields(input), status: "DRAFT" } });
    if (input.fromLeadId) await tx.lead.updateMany({ where: { id: input.fromLeadId, type: "ADVERTISING" }, data: { status: "CONVERTED" } });
    await audit({ adminId: actor.id, action: "ad.create", entityType: "AdCampaign", entityId: created.id, meta: { advertiser: created.advertiserName, placement: created.placement, fromLeadId: input.fromLeadId ?? null }, ip: actor.ip }, tx);
    return created;
  });
  return getAd(a.id);
}

export async function updateAd(id: string, input: AdminAdInput, actor: Actor): Promise<AdminAdDTO> {
  await prisma.$transaction(async (tx) => {
    const current = await tx.adCampaign.findUnique({ where: { id }, select: { id: true } });
    if (!current) throw new HttpError(404, "NOT_FOUND", "Campaign not found.");
    await tx.adCampaign.update({ where: { id }, data: fields(input) });
    await audit({ adminId: actor.id, action: "ad.update", entityType: "AdCampaign", entityId: id, meta: { advertiser: input.advertiserName, paymentVerified: input.paymentVerified }, ip: actor.ip }, tx);
  });
  return getAd(id);
}

const TRANSITIONS: Record<AdminAdAction["action"], { from: AdStatus[]; to: AdStatus }> = {
  APPROVE: { from: ["DRAFT", "PENDING_REVIEW", "REJECTED"], to: "APPROVED" },
  REJECT: { from: ["DRAFT", "PENDING_REVIEW"], to: "REJECTED" },
  PAUSE: { from: ["APPROVED"], to: "PAUSED" },
  RESUME: { from: ["PAUSED"], to: "APPROVED" },
};

export async function actOnAd(id: string, a: AdminAdAction, actor: Actor): Promise<AdminAdDTO> {
  await prisma.$transaction(async (tx) => {
    const current = await tx.adCampaign.findUnique({ where: { id }, select: { status: true } });
    if (!current) throw new HttpError(404, "NOT_FOUND", "Campaign not found.");
    const t = TRANSITIONS[a.action];
    if (!t.from.includes(current.status)) throw new HttpError(409, "INVALID_TRANSITION", `A ${current.status.toLowerCase().replace("_", " ")} campaign can't be ${a.action.toLowerCase()}d.`);
    await tx.adCampaign.update({ where: { id }, data: { status: t.to } });
    await audit({ adminId: actor.id, action: `ad.${a.action.toLowerCase()}`, entityType: "AdCampaign", entityId: id, meta: { from: current.status, to: t.to, reason: a.reason ?? null }, ip: actor.ip }, tx);
  });
  return getAd(id);
}

export async function deleteAd(id: string, actor: Actor) {
  await prisma.$transaction(async (tx) => {
    const a = await tx.adCampaign.findUnique({ where: { id }, select: { advertiserName: true, impressions: true, clicks: true } });
    if (!a) throw new HttpError(404, "NOT_FOUND", "Campaign not found.");
    await tx.adCampaign.delete({ where: { id } });
    await audit({ adminId: actor.id, action: "ad.delete", entityType: "AdCampaign", entityId: id, meta: { advertiser: a.advertiserName, impressions: a.impressions, clicks: a.clicks }, ip: actor.ip }, tx);
  });
}
