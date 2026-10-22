import type { Prisma } from "@prisma/client";
import {
  ADMIN_PAGE_SIZE,
  type AdminEnquiryDTO,
  type AdminEnquiryUpdate,
  type AdminLeadDTO,
  type AdminLeadUpdate,
  type AdminPage,
  type AdminRequirementResponseDTO,
  type EnquiryStatus,
  type LeadStatus,
  type LeadType,
} from "@sd/shared";
import { prisma } from "../../db.js";
import { HttpError } from "../../lib/errors.js";
import { audit } from "./audit.js";

export interface Actor {
  id: string;
  ip?: string;
}

const page = <T>(data: T[], pageNo: number, total: number): AdminPage<T> => ({
  data,
  pagination: { page: pageNo, limit: ADMIN_PAGE_SIZE, total, totalPages: Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE)) },
});

/** Case-insensitive match on any of the given text columns. */
const searchOr = (q: string | undefined, fields: string[]) =>
  q ? { OR: fields.map((f) => ({ [f]: { contains: q, mode: "insensitive" as const } })) } : {};

/* ------------------------------ Leads ------------------------------ */

type LeadRow = Prisma.LeadGetPayload<object>;
const toLead = (l: LeadRow): AdminLeadDTO => ({
  id: l.id,
  reference: l.reference,
  type: l.type,
  registrationSide: l.registrationSide === "BRAND" || l.registrationSide === "DISTRIBUTOR" ? l.registrationSide : null,
  adPlacement: l.adPlacement as AdminLeadDTO["adPlacement"],
  status: l.status,
  name: l.name,
  companyName: l.companyName,
  email: l.email,
  phone: l.phone,
  categorySlug: l.categorySlug,
  location: l.location,
  message: l.message,
  notes: l.notes,
  createdAt: l.createdAt.toISOString(),
  updatedAt: l.updatedAt.toISOString(),
});

export async function listLeads(f: { status?: LeadStatus; type?: LeadType; q?: string; page: number }) {
  const where: Prisma.LeadWhereInput = {
    ...(f.status ? { status: f.status } : {}),
    ...(f.type ? { type: f.type } : {}),
    ...searchOr(f.q, ["name", "companyName", "email", "reference", "message"]),
  };
  const [rows, total] = await Promise.all([
    prisma.lead.findMany({ where, orderBy: { createdAt: "desc" }, skip: (f.page - 1) * ADMIN_PAGE_SIZE, take: ADMIN_PAGE_SIZE }),
    prisma.lead.count({ where }),
  ]);
  return page(rows.map(toLead), f.page, total);
}

export async function getLead(id: string) {
  const l = await prisma.lead.findUnique({ where: { id } });
  if (!l) throw new HttpError(404, "NOT_FOUND", "Lead not found.");
  return toLead(l);
}

export async function updateLead(id: string, input: AdminLeadUpdate, actor: Actor) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.lead.findUnique({ where: { id }, select: { status: true } });
    if (!current) throw new HttpError(404, "NOT_FOUND", "Lead not found.");
    const updated = await tx.lead.update({ where: { id }, data: { ...(input.status ? { status: input.status } : {}), ...(input.notes !== undefined ? { notes: input.notes } : {}) } });
    await audit({ adminId: actor.id, action: "lead.update", entityType: "Lead", entityId: id, meta: { from: current.status, to: updated.status, notesChanged: input.notes !== undefined }, ip: actor.ip }, tx);
    return toLead(updated);
  });
}

export async function deleteLead(id: string, actor: Actor) {
  await prisma.$transaction(async (tx) => {
    const l = await tx.lead.findUnique({ where: { id }, select: { reference: true, type: true } });
    if (!l) throw new HttpError(404, "NOT_FOUND", "Lead not found.");
    await tx.lead.delete({ where: { id } });
    await audit({ adminId: actor.id, action: "lead.delete", entityType: "Lead", entityId: id, meta: { reference: l.reference, type: l.type }, ip: actor.ip }, tx);
  });
}

/* ---------------------------- Enquiries ---------------------------- */

const enquiryInclude = { distributor: { select: { id: true, name: true, slug: true } } } as const;
type EnquiryRow = Prisma.EnquiryGetPayload<{ include: typeof enquiryInclude }>;
const toEnquiry = (e: EnquiryRow): AdminEnquiryDTO => ({
  id: e.id,
  reference: e.reference,
  status: e.status,
  spamFlag: e.spamFlag,
  senderName: e.senderName,
  senderEmail: e.senderEmail,
  senderPhone: e.senderPhone,
  senderLocation: e.senderLocation,
  message: e.message,
  distributor: e.distributor,
  createdAt: e.createdAt.toISOString(),
  verifiedAt: e.verifiedAt?.toISOString() ?? null,
});

export async function listEnquiries(f: { status?: EnquiryStatus; spam?: boolean; distributorId?: string; q?: string; page: number }) {
  const where: Prisma.EnquiryWhereInput = {
    ...(f.status ? { status: f.status } : {}),
    ...(f.spam !== undefined ? { spamFlag: f.spam } : {}),
    ...(f.distributorId ? { distributorId: f.distributorId } : {}),
    ...searchOr(f.q, ["senderName", "senderEmail", "reference", "message"]),
  };
  const [rows, total] = await Promise.all([
    prisma.enquiry.findMany({ where, include: enquiryInclude, orderBy: { createdAt: "desc" }, skip: (f.page - 1) * ADMIN_PAGE_SIZE, take: ADMIN_PAGE_SIZE }),
    prisma.enquiry.count({ where }),
  ]);
  return page(rows.map(toEnquiry), f.page, total);
}

export async function updateEnquiry(id: string, input: AdminEnquiryUpdate, actor: Actor) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.enquiry.findUnique({ where: { id }, select: { status: true, spamFlag: true } });
    if (!current) throw new HttpError(404, "NOT_FOUND", "Enquiry not found.");
    if (input.status && current.status === "PENDING_VERIFICATION") {
      throw new HttpError(409, "NOT_CONFIRMED", "The sender hasn't confirmed this enquiry yet, so it can't be worked.");
    }
    const updated = await tx.enquiry.update({
      where: { id },
      data: { ...(input.status ? { status: input.status } : {}), ...(input.spamFlag !== undefined ? { spamFlag: input.spamFlag } : {}) },
      include: enquiryInclude,
    });
    await audit({ adminId: actor.id, action: "enquiry.update", entityType: "Enquiry", entityId: id, meta: { from: current.status, to: updated.status, spam: updated.spamFlag }, ip: actor.ip }, tx);
    return toEnquiry(updated);
  });
}

export async function deleteEnquiry(id: string, actor: Actor) {
  await prisma.$transaction(async (tx) => {
    const e = await tx.enquiry.findUnique({ where: { id }, select: { reference: true } });
    if (!e) throw new HttpError(404, "NOT_FOUND", "Enquiry not found.");
    await tx.enquiry.delete({ where: { id } });
    await audit({ adminId: actor.id, action: "enquiry.delete", entityType: "Enquiry", entityId: id, meta: { reference: e.reference }, ip: actor.ip }, tx);
  });
}

/* --------------------------- Requirements -------------------------- */

export async function listRequirementResponses(requirementId: string): Promise<AdminRequirementResponseDTO[]> {
  const rows = await prisma.requirementResponse.findMany({ where: { requirementId }, orderBy: { createdAt: "desc" } });
  return rows.map((r) => ({
    id: r.id,
    reference: r.reference,
    senderName: r.senderName,
    senderEmail: r.senderEmail,
    senderPhone: r.senderPhone,
    senderLocation: r.senderLocation,
    message: r.message,
    createdAt: r.createdAt.toISOString(),
  }));
}

/** Close an approved requirement (it leaves the public site) or reopen a closed one. */
export async function setRequirementStatus(id: string, status: "APPROVED" | "CLOSED", actor: Actor) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.requirement.findUnique({ where: { id }, select: { status: true } });
    if (!current) throw new HttpError(404, "NOT_FOUND", "Requirement not found.");
    const allowed = status === "CLOSED" ? current.status === "APPROVED" : current.status === "CLOSED";
    if (!allowed) throw new HttpError(409, "INVALID_TRANSITION", status === "CLOSED" ? "Only approved requirements can be closed." : "Only closed requirements can be reopened.");
    await tx.requirement.update({ where: { id }, data: { status } });
    await audit({ adminId: actor.id, action: status === "CLOSED" ? "requirement.close" : "requirement.reopen", entityType: "Requirement", entityId: id, meta: { from: current.status, to: status }, ip: actor.ip }, tx);
    return { id, status };
  });
}

export async function deleteRequirement(id: string, actor: Actor) {
  await prisma.$transaction(async (tx) => {
    const r = await tx.requirement.findUnique({ where: { id }, select: { reference: true, status: true } });
    if (!r) throw new HttpError(404, "NOT_FOUND", "Requirement not found.");
    await tx.requirement.delete({ where: { id } }); // responses cascade
    await audit({ adminId: actor.id, action: "requirement.delete", entityType: "Requirement", entityId: id, meta: { reference: r.reference, status: r.status }, ip: actor.ip }, tx);
  });
}
