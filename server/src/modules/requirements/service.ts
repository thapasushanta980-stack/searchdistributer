import { Prisma } from "@prisma/client";
import type { z } from "zod";
import type {
  RequirementCardDTO,
  RequirementDetailDTO,
  RequirementListResponse,
  RequirementSearchParams,
  RequirementSubmitResponse,
  requirementInputSchema,
  requirementResponseSchema,
} from "@sd/shared";
import { config } from "../../config.js";
import { prisma } from "../../db.js";
import { HttpError } from "../../lib/errors.js";
import { makeReference } from "../../lib/reference.js";
import { enqueue } from "../notifications/outbox.js";

const PAGE_SIZE = 12;
const NEW_DAYS = 7;

type RequirementInput = z.output<typeof requirementInputSchema>;
type ResponseInput = z.output<typeof requirementResponseSchema>;

/** Public = approved by moderation (demo fixtures only when explicitly enabled). Never exposes contact fields. */
const publicWhere = (): Prisma.RequirementWhereInput => ({
  status: "APPROVED",
  ...(config.SHOW_DEMO_DATA ? {} : { isDemo: false }),
});

type Row = Prisma.RequirementGetPayload<{ include: { category: { select: { slug: true; name: true } } } }>;

function toCard(r: Row, now = Date.now()): RequirementCardDTO {
  return {
    id: r.id,
    slug: r.slug,
    kind: r.kind,
    title: r.title,
    summary: r.description.length > 200 ? `${r.description.slice(0, 197).trimEnd()}…` : r.description,
    category: r.category ? { slug: r.category.slug, name: r.category.name } : null,
    poster: r.companyName,
    preferredLocation: r.preferredLocation,
    budgetMin: r.budgetMin,
    budgetMax: r.budgetMax,
    budgetCurrency: r.budgetCurrency,
    experience: r.experience,
    distributionArea: r.distributionArea,
    isNew: now - r.createdAt.getTime() < NEW_DAYS * 86_400_000,
    isDemo: r.isDemo,
    createdAt: r.createdAt.toISOString(),
  };
}

const include = { category: { select: { slug: true, name: true } } } as const;

export async function searchRequirements(p: RequirementSearchParams): Promise<RequirementListResponse> {
  const and: Prisma.RequirementWhereInput[] = [publicWhere()];
  if (p.keyword) {
    for (const token of p.keyword.split(/\s+/).filter(Boolean).slice(0, 6)) {
      and.push({
        OR: [
          { title: { contains: token, mode: "insensitive" } },
          { description: { contains: token, mode: "insensitive" } },
          { preferredLocation: { contains: token, mode: "insensitive" } },
          { category: { name: { contains: token, mode: "insensitive" } } },
        ],
      });
    }
  }
  if (p.category) and.push({ category: { OR: [{ slug: p.category }, { parent: { slug: p.category } }] } });
  if (p.location) and.push({ OR: [{ preferredLocation: { contains: p.location, mode: "insensitive" } }, { distributionArea: { contains: p.location, mode: "insensitive" } }] });
  if (p.kind) and.push({ kind: p.kind });
  // "Budget at least X": keep leads whose upper budget reaches X; leads without a budget are not matched.
  if (p.budgetMin) and.push({ OR: [{ budgetMax: { gte: p.budgetMin } }, { AND: [{ budgetMax: null }, { budgetMin: { gte: p.budgetMin } }] }] });

  const where: Prisma.RequirementWhereInput = { AND: and };
  const [rows, total] = await Promise.all([
    prisma.requirement.findMany({ where, include, orderBy: [{ createdAt: "desc" }, { id: "asc" }], skip: (p.page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    prisma.requirement.count({ where }),
  ]);
  const now = Date.now();
  return { data: rows.map((r) => toCard(r, now)), pagination: { page: p.page, limit: PAGE_SIZE, total, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) } };
}

export async function getRequirement(slug: string): Promise<RequirementDetailDTO | null> {
  const r = await prisma.requirement.findFirst({ where: { AND: [publicWhere(), { slug }] }, include });
  if (!r) return null;
  const related = await prisma.requirement.findMany({
    where: { AND: [publicWhere(), { id: { not: r.id } }, r.categoryId ? { categoryId: r.categoryId } : {}] },
    include,
    orderBy: { createdAt: "desc" },
    take: 3,
  });
  const now = Date.now();
  return { ...toCard(r, now), description: r.description, warehouse: r.warehouse, additional: r.additional, related: related.map((x) => toCard(x, now)) };
}

export async function listPublicRequirementSlugs(): Promise<Array<{ slug: string; updatedAt: Date }>> {
  return prisma.requirement.findMany({ where: publicWhere(), select: { slug: true, updatedAt: true }, orderBy: { createdAt: "desc" }, take: 50000 });
}

export async function submitRequirement(input: RequirementInput): Promise<RequirementSubmitResponse> {
  if (input.website) return { reference: makeReference("REQ") }; // honeypot

  const existing = await prisma.requirement.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) return { reference: existing.reference };

  const category = input.categorySlug ? await prisma.category.findUnique({ where: { slug: input.categorySlug }, select: { id: true } }) : null;
  const reference = makeReference("REQ");
  try {
    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.requirement.create({
        data: {
          reference,
          slug: reference.toLowerCase(),
          idempotencyKey: input.idempotencyKey,
          kind: input.kind,
          categoryId: category?.id,
          title: input.title,
          description: input.description,
          budgetMin: input.budgetMin,
          budgetMax: input.budgetMax,
          budgetCurrency: input.budgetMin !== undefined || input.budgetMax !== undefined ? config.DEFAULT_CURRENCY : null,
          preferredLocation: input.preferredLocation,
          experience: input.experience,
          warehouse: input.warehouse,
          distributionArea: input.distributionArea,
          additional: input.additional,
          contactName: input.contactName,
          contactEmail: input.contactEmail,
          contactPhone: input.contactPhone,
          companyName: input.companyName,
          contactLocation: input.contactLocation,
          consentAt: new Date(),
          // Moderated before it appears publicly.
          status: "PENDING_REVIEW",
        },
      });
      if (config.SUPPORT_EMAIL) {
        await enqueue(tx, {
          dedupeKey: `requirement-review:${row.id}`,
          template: "lead-internal",
          toEmail: config.SUPPORT_EMAIL,
          payload: { type: "REQUIREMENT", reference: row.reference, name: row.contactName, email: row.contactEmail, phone: row.contactPhone, companyName: row.companyName ?? undefined, location: row.contactLocation, message: `${row.title}\n\n${row.description}` },
        });
      }
      return row;
    });
    return { reference: created.reference };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const again = await prisma.requirement.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (again) return { reference: again.reference };
    }
    throw err;
  }
}

/** A business responds to a public requirement. The poster is emailed; their contact details are never returned. */
export async function respondToRequirement(slug: string, input: ResponseInput): Promise<{ reference: string }> {
  const existing = await prisma.requirementResponse.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) return { reference: existing.reference };

  const req = await prisma.requirement.findFirst({ where: { AND: [publicWhere(), { slug }] } });
  if (!req) throw new HttpError(409, "LISTING_UNAVAILABLE", "This requirement is no longer open for enquiries. Your message has not been sent.");

  try {
    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.requirementResponse.create({
        data: {
          reference: makeReference("RSP"),
          idempotencyKey: input.idempotencyKey,
          requirementId: req.id,
          senderName: input.name,
          senderEmail: input.email,
          senderPhone: input.phone,
          senderLocation: input.location,
          message: input.message,
          consentAt: new Date(),
        },
      });
      await enqueue(tx, {
        dedupeKey: `requirement-response:${row.id}`,
        template: "requirement-response",
        toEmail: req.contactEmail,
        payload: { reference: row.reference, requirementTitle: req.title, senderName: row.senderName, senderEmail: row.senderEmail, senderPhone: row.senderPhone ?? undefined, senderLocation: row.senderLocation, message: row.message },
      });
      return row;
    });
    return { reference: created.reference };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const again = await prisma.requirementResponse.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (again) return { reference: again.reference };
    }
    throw err;
  }
}

