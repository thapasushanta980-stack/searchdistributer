import { Prisma } from "@prisma/client";
import {
  ADMIN_PAGE_SIZE,
  type AdminListingAction,
  type AdminListingDTO,
  type AdminListingInput,
  type AdminListingSummaryDTO,
  type AdminPage,
  type AdminProductDTO,
  type AdminProductInput,
  type BusinessType,
  type ListingStatus,
  type ListingVisibilityDTO,
} from "@sd/shared";
import { config } from "../../config.js";
import { prisma } from "../../db.js";
import { HttpError } from "../../lib/errors.js";
import { clearCategoryCache } from "../categories/service.js";
import { clearDistributorCaches } from "../distributors/service.js";
import { audit } from "./audit.js";
import type { Actor } from "./inbox.js";

type Tx = Prisma.TransactionClient;

export const slugify = (v: string) =>
  v
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80) || "listing";

/** First free slug: base, base-2, base-3, … */
async function freeSlug(base: string, taken: (slug: string) => Promise<boolean>): Promise<string> {
  for (let i = 1; i < 500; i++) {
    const candidate = i === 1 ? base : `${base}-${i}`;
    if (!(await taken(candidate))) return candidate;
  }
  throw new HttpError(409, "SLUG_EXHAUSTED", "Couldn't find a free web address for this name. Try a different name.");
}

/** Public pages and counts are cached briefly; drop them so an admin change shows at once. */
function refreshPublic() {
  clearDistributorCaches();
  clearCategoryCache();
}

const orgInclude = { select: { id: true, name: true, status: true, profileReviewStatus: true, notificationEmail: true, subscriptionPeriods: { select: { startsAt: true, endsAt: true } } } } as const;

type Periods = Array<{ startsAt: Date; endsAt: Date }>;
const listedUntil = (periods: Periods) => (periods.length ? new Date(Math.max(...periods.map((p) => p.endsAt.getTime()))) : null);
const subscriptionActive = (periods: Periods, now = new Date()) => periods.some((p) => p.startsAt <= now && p.endsAt > now);

function visibility(d: { status: string; publicationEnabled: boolean; isDemo: boolean }, org: { status: string; profileReviewStatus: string; subscriptionPeriods: Periods }): ListingVisibilityDTO {
  const v = {
    approved: d.status === "APPROVED",
    published: d.publicationEnabled,
    organisationActive: org.status === "ACTIVE",
    profileApproved: org.profileReviewStatus === "APPROVED",
    subscriptionActive: subscriptionActive(org.subscriptionPeriods),
  };
  return { ...v, isPublic: Object.values(v).every(Boolean) && (config.SHOW_DEMO_DATA || !d.isDemo) };
}

/** Admin-managed listings have one subscription period, from its first start until `until`. */
async function setListedUntil(tx: Tx, organisationId: string, until: string | null) {
  const existing = await tx.subscriptionPeriod.findMany({ where: { organisationId }, select: { startsAt: true } });
  await tx.subscriptionPeriod.deleteMany({ where: { organisationId } });
  if (!until) return;
  const startsAt = existing.length ? new Date(Math.min(...existing.map((p) => p.startsAt.getTime()))) : new Date();
  const endsAt = new Date(until);
  await tx.subscriptionPeriod.create({ data: { organisationId, startsAt: startsAt < endsAt ? startsAt : new Date(endsAt.getTime() - 1), endsAt } });
}

const distributorFields = (i: AdminListingInput) => ({
  name: i.name,
  businessType: i.businessType,
  summary: i.summary,
  description: i.description,
  categoryId: i.categoryId,
  location: i.location,
  city: i.city,
  country: i.country,
  coverage: i.coverage,
  territories: i.territories,
  specialties: i.specialties,
  website: i.website,
  logoUrl: i.logoUrl,
  contactPerson: i.contactPerson,
  foundedYear: i.foundedYear,
  distributorshipInfo: i.distributorshipInfo,
  minimumOrder: i.minimumOrder,
  supportOffered: i.supportOffered,
  investmentMin: i.investmentMin,
  investmentMax: i.investmentMax,
  investmentCurrency: i.investmentCurrency,
  verificationStatus: i.verificationStatus,
  isFeatured: i.isFeatured,
  featuredUntil: i.featuredUntil ? new Date(i.featuredUntil) : null,
});

/* ----------------------------- Listings ---------------------------- */

export async function listListings(f: { status?: ListingStatus; businessType?: BusinessType; live?: boolean; q?: string; page: number }): Promise<AdminPage<AdminListingSummaryDTO>> {
  const where: Prisma.DistributorWhereInput = {
    ...(f.status ? { status: f.status } : {}),
    ...(f.businessType ? { businessType: f.businessType } : {}),
    ...(f.q ? { OR: [{ name: { contains: f.q, mode: "insensitive" } }, { location: { contains: f.q, mode: "insensitive" } }, { slug: { contains: f.q, mode: "insensitive" } }] } : {}),
  };
  const include = { organisation: orgInclude, category: { select: { id: true, name: true } }, _count: { select: { products: true, enquiries: true } } } as const;
  const rows = await prisma.distributor.findMany({ where, include, orderBy: { updatedAt: "desc" } });
  const mapped = rows.map((d) => {
    const vis = visibility(d, d.organisation);
    const until = listedUntil(d.organisation.subscriptionPeriods);
    const summary: AdminListingSummaryDTO = {
      id: d.id,
      name: d.name,
      slug: d.slug,
      businessType: d.businessType,
      status: d.status,
      verificationStatus: d.verificationStatus,
      isFeatured: d.isFeatured,
      category: d.category,
      location: d.location,
      listedUntil: until?.toISOString() ?? null,
      isPublic: vis.isPublic,
      productCount: d._count.products,
      enquiryCount: d._count.enquiries,
      updatedAt: d.updatedAt.toISOString(),
    };
    return summary;
  });
  // "Live" depends on dates and the organisation, so it is filtered after mapping. Admin lists are small.
  const filtered = f.live === undefined ? mapped : mapped.filter((m) => m.isPublic === f.live);
  const start = (f.page - 1) * ADMIN_PAGE_SIZE;
  return {
    data: filtered.slice(start, start + ADMIN_PAGE_SIZE),
    pagination: { page: f.page, limit: ADMIN_PAGE_SIZE, total: filtered.length, totalPages: Math.max(1, Math.ceil(filtered.length / ADMIN_PAGE_SIZE)) },
  };
}

const toProduct = (p: Prisma.ProductGetPayload<object>): AdminProductDTO => ({
  id: p.id,
  name: p.name,
  publicSlug: p.publicSlug,
  description: p.description,
  categoryId: p.categoryId,
  packaging: p.packaging,
  priceLabel: p.priceLabel,
  published: p.status === "APPROVED" && p.publicationEnabled,
  updatedAt: p.updatedAt.toISOString(),
});

export async function getListing(id: string, db: Tx | typeof prisma = prisma): Promise<AdminListingDTO> {
  const d = await db.distributor.findUnique({
    where: { id },
    include: { organisation: orgInclude, products: { orderBy: { createdAt: "asc" } }, _count: { select: { enquiries: true } } },
  });
  if (!d) throw new HttpError(404, "NOT_FOUND", "Listing not found.");
  return {
    id: d.id,
    slug: d.slug,
    status: d.status,
    name: d.name,
    businessType: d.businessType,
    summary: d.summary,
    description: d.description,
    categoryId: d.categoryId,
    location: d.location,
    city: d.city,
    country: d.country,
    coverage: d.coverage,
    territories: d.territories,
    specialties: d.specialties,
    website: d.website,
    logoUrl: d.logoUrl,
    contactPerson: d.contactPerson,
    notificationEmail: d.organisation.notificationEmail,
    foundedYear: d.foundedYear,
    distributorshipInfo: d.distributorshipInfo,
    minimumOrder: d.minimumOrder,
    supportOffered: d.supportOffered,
    investmentMin: d.investmentMin,
    investmentMax: d.investmentMax,
    investmentCurrency: d.investmentCurrency,
    verificationStatus: d.verificationStatus,
    isFeatured: d.isFeatured,
    featuredUntil: d.featuredUntil?.toISOString() ?? null,
    listedUntil: listedUntil(d.organisation.subscriptionPeriods)?.toISOString() ?? null,
    visibility: visibility(d, d.organisation),
    products: d.products.map(toProduct),
    enquiryCount: d._count.enquiries,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  };
}

export async function createListing(input: AdminListingInput, actor: Actor): Promise<AdminListingDTO> {
  const slug = await freeSlug(slugify(input.name), async (s) => !!(await prisma.distributor.findUnique({ where: { slug: s }, select: { id: true } })));
  try {
    const id = await prisma.$transaction(async (tx) => {
      const org = await tx.organisation.create({ data: { name: input.name, notificationEmail: input.notificationEmail } });
      const d = await tx.distributor.create({ data: { ...distributorFields(input), slug, organisationId: org.id, status: "DRAFT", publicationEnabled: false } });
      await setListedUntil(tx, org.id, input.listedUntil);
      if (input.fromLeadId) {
        await tx.lead.updateMany({ where: { id: input.fromLeadId }, data: { status: "CONVERTED" } });
      }
      await audit({ adminId: actor.id, action: "listing.create", entityType: "Distributor", entityId: d.id, meta: { name: d.name, slug, fromLeadId: input.fromLeadId ?? null }, ip: actor.ip }, tx);
      return d.id;
    });
    return getListing(id);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") throw new HttpError(409, "SLUG_TAKEN", "Another listing just took this name. Save again.");
    throw err;
  }
}

export async function updateListing(id: string, input: AdminListingInput, actor: Actor): Promise<AdminListingDTO> {
  await prisma.$transaction(async (tx) => {
    const d = await tx.distributor.findUnique({ where: { id }, select: { organisationId: true } });
    if (!d) throw new HttpError(404, "NOT_FOUND", "Listing not found.");
    await tx.distributor.update({ where: { id }, data: distributorFields(input) });
    await tx.organisation.update({ where: { id: d.organisationId }, data: { name: input.name, notificationEmail: input.notificationEmail } });
    await setListedUntil(tx, d.organisationId, input.listedUntil);
    await audit({ adminId: actor.id, action: "listing.update", entityType: "Distributor", entityId: id, meta: { name: input.name, listedUntil: input.listedUntil }, ip: actor.ip }, tx);
  });
  refreshPublic();
  return getListing(id);
}

export async function actOnListing(id: string, a: AdminListingAction, actor: Actor): Promise<AdminListingDTO> {
  await prisma.$transaction(async (tx) => {
    const d = await tx.distributor.findUnique({ where: { id }, include: { organisation: orgInclude } });
    if (!d) throw new HttpError(404, "NOT_FOUND", "Listing not found.");
    if (a.action === "PUBLISH") {
      if (!subscriptionActive(d.organisation.subscriptionPeriods)) {
        throw new HttpError(409, "NO_LISTING_PERIOD", "Set a 'Listed until' date in the future and save before publishing.");
      }
      await tx.organisation.update({ where: { id: d.organisationId }, data: { status: "ACTIVE", profileReviewStatus: "APPROVED" } });
      await tx.distributor.update({ where: { id }, data: { status: "APPROVED", publicationEnabled: true } });
    } else if (a.action === "REJECT") {
      if (d.status !== "SUBMITTED") throw new HttpError(409, "INVALID_TRANSITION", "Only listings awaiting review can be rejected.");
      await tx.distributor.update({ where: { id }, data: { status: "REJECTED", publicationEnabled: false } });
    } else {
      await tx.distributor.update({ where: { id }, data: { status: a.action === "PAUSE" ? "PAUSED" : "ARCHIVED", publicationEnabled: false } });
    }
    await audit({ adminId: actor.id, action: `listing.${a.action.toLowerCase()}`, entityType: "Distributor", entityId: id, meta: { from: d.status, reason: a.reason ?? null }, ip: actor.ip }, tx);
  });
  refreshPublic();
  return getListing(id);
}

/** Removes the listing with its products and enquiries, and its organisation when nothing else uses it. */
export async function deleteListing(id: string, actor: Actor) {
  await prisma.$transaction(async (tx) => {
    const d = await tx.distributor.findUnique({ where: { id }, select: { name: true, slug: true, organisationId: true } });
    if (!d) throw new HttpError(404, "NOT_FOUND", "Listing not found.");
    const enquiries = await tx.enquiry.deleteMany({ where: { distributorId: id } });
    await tx.distributor.delete({ where: { id } }); // products cascade
    const others = await tx.distributor.count({ where: { organisationId: d.organisationId } });
    if (others === 0) {
      await tx.enquiry.deleteMany({ where: { organisationId: d.organisationId } });
      await tx.organisation.delete({ where: { id: d.organisationId } }); // subscription periods cascade; ads keep running unlinked
    }
    await audit({ adminId: actor.id, action: "listing.delete", entityType: "Distributor", entityId: id, meta: { name: d.name, slug: d.slug, enquiriesDeleted: enquiries.count }, ip: actor.ip }, tx);
  });
  refreshPublic();
}

/* ----------------------------- Products ---------------------------- */

const productFields = (i: AdminProductInput) => ({
  name: i.name,
  description: i.description,
  categoryId: i.categoryId,
  packaging: i.packaging,
  priceLabel: i.priceLabel,
  status: i.published ? ("APPROVED" as const) : ("DRAFT" as const),
  publicationEnabled: i.published,
});

export async function createProduct(distributorId: string, input: AdminProductInput, actor: Actor): Promise<AdminProductDTO> {
  const d = await prisma.distributor.findUnique({ where: { id: distributorId }, select: { slug: true, organisationId: true } });
  if (!d) throw new HttpError(404, "NOT_FOUND", "Listing not found.");
  const slug = await freeSlug(slugify(input.name), async (s) => !!(await prisma.product.findUnique({ where: { distributorId_slug: { distributorId, slug: s } }, select: { id: true } })));
  const publicSlug = await freeSlug(`${d.slug}-${slug}`.slice(0, 150), async (s) => !!(await prisma.product.findUnique({ where: { publicSlug: s }, select: { id: true } })));
  const p = await prisma.$transaction(async (tx) => {
    const created = await tx.product.create({ data: { ...productFields(input), slug, publicSlug, distributorId, organisationId: d.organisationId } });
    await audit({ adminId: actor.id, action: "product.create", entityType: "Product", entityId: created.id, meta: { name: created.name, distributorId }, ip: actor.ip }, tx);
    return created;
  });
  refreshPublic();
  return toProduct(p);
}

export async function updateProduct(distributorId: string, productId: string, input: AdminProductInput, actor: Actor): Promise<AdminProductDTO> {
  const p = await prisma.$transaction(async (tx) => {
    const current = await tx.product.findFirst({ where: { id: productId, distributorId }, select: { id: true } });
    if (!current) throw new HttpError(404, "NOT_FOUND", "Product not found.");
    const updated = await tx.product.update({ where: { id: productId }, data: productFields(input) });
    await audit({ adminId: actor.id, action: "product.update", entityType: "Product", entityId: productId, meta: { name: updated.name, published: input.published }, ip: actor.ip }, tx);
    return updated;
  });
  refreshPublic();
  return toProduct(p);
}

export async function deleteProduct(distributorId: string, productId: string, actor: Actor) {
  await prisma.$transaction(async (tx) => {
    const current = await tx.product.findFirst({ where: { id: productId, distributorId }, select: { name: true } });
    if (!current) throw new HttpError(404, "NOT_FOUND", "Product not found.");
    await tx.product.delete({ where: { id: productId } });
    await audit({ adminId: actor.id, action: "product.delete", entityType: "Product", entityId: productId, meta: { name: current.name, distributorId }, ip: actor.ip }, tx);
  });
  refreshPublic();
}
