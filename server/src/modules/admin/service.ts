import type { AdminAuditDTO, AdminRequirementDTO, AdminStatsDTO, ModerationDecision } from "@sd/shared";
import { prisma } from "../../db.js";
import { HttpError } from "../../lib/errors.js";
import { audit } from "./audit.js";

export async function getStats(): Promise<AdminStatsDTO> {
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const [requirementsPending, listingsPending, productsPending, adsPending, enquiriesAwaitingVerification, outboxFailed, leadsLast7Days] = await Promise.all([
    prisma.requirement.count({ where: { status: "PENDING_REVIEW" } }),
    prisma.distributor.count({ where: { status: "SUBMITTED" } }),
    prisma.product.count({ where: { status: "SUBMITTED" } }),
    prisma.adCampaign.count({ where: { status: "PENDING_REVIEW" } }),
    prisma.enquiry.count({ where: { status: "PENDING_VERIFICATION" } }),
    prisma.notificationOutbox.count({ where: { status: "FAILED" } }),
    prisma.lead.count({ where: { createdAt: { gte: weekAgo } } }),
  ]);
  return { requirementsPending, listingsPending, productsPending, adsPending, enquiriesAwaitingVerification, outboxFailed, leadsLast7Days };
}

export async function listRequirements(status: AdminRequirementDTO["status"], page: number, limit = 20) {
  const where = { status };
  const [rows, total] = await Promise.all([
    prisma.requirement.findMany({ where, include: { category: { select: { slug: true, name: true } } }, orderBy: { createdAt: "asc" }, skip: (page - 1) * limit, take: limit }),
    prisma.requirement.count({ where }),
  ]);
  const data: AdminRequirementDTO[] = rows.map((r) => ({
    id: r.id,
    reference: r.reference,
    slug: r.slug,
    kind: r.kind,
    title: r.title,
    description: r.description,
    status: r.status,
    category: r.category,
    contactName: r.contactName,
    contactEmail: r.contactEmail,
    contactPhone: r.contactPhone,
    companyName: r.companyName,
    createdAt: r.createdAt.toISOString(),
  }));
  return { data, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } };
}

/** Moderation pattern for every queue: only PENDING items can be decided, and the decision and its audit row commit together. */
export async function decideRequirement(id: string, d: ModerationDecision, actor: { id: string; ip?: string }) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.requirement.findUnique({ where: { id }, select: { status: true } });
    if (!current) throw new HttpError(404, "NOT_FOUND", "Requirement not found.");
    if (current.status !== "PENDING_REVIEW") throw new HttpError(409, "ALREADY_DECIDED", `This requirement is already ${current.status.toLowerCase().replace("_", " ")}.`);
    const next = d.decision === "APPROVE" ? "APPROVED" : "REJECTED";
    await tx.requirement.update({ where: { id }, data: { status: next } });
    await audit({ adminId: actor.id, action: `requirement.${d.decision.toLowerCase()}`, entityType: "Requirement", entityId: id, meta: { from: current.status, to: next, reason: d.reason ?? null }, ip: actor.ip }, tx);
    return { id, status: next };
  });
}

export async function listAudit(page: number, limit = 50): Promise<{ data: AdminAuditDTO[]; total: number }> {
  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({ include: { admin: { select: { name: true, email: true } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
    prisma.auditLog.count(),
  ]);
  return { total, data: rows.map((r) => ({ id: r.id, action: r.action, entityType: r.entityType, entityId: r.entityId, meta: r.meta, admin: r.admin, createdAt: r.createdAt.toISOString() })) };
}
