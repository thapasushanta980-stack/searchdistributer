import { Prisma } from "@prisma/client";
import type { ProductDetailDTO, ProductListItemDTO, ProductListResponse, ProductSearchParams } from "@sd/shared";
import { prisma } from "../../db.js";
import { contains } from "../../lib/sql.js";
import { eligibleDistributorSql, eligibleProductSql } from "../distributors/eligibility.js";
import { getEligibleId } from "../distributors/service.js";
import { isFeaturedNow, toCard } from "../distributors/mappers.js";

const PAGE_SIZE = 24;

const listInclude = {
  category: { select: { slug: true, name: true } },
  distributor: { select: { slug: true, name: true, location: true } },
} as const;

type ListRow = Prisma.ProductGetPayload<{ include: typeof listInclude }>;

function toItem(p: ListRow): ProductListItemDTO {
  return {
    id: p.id,
    slug: p.slug,
    publicSlug: p.publicSlug,
    name: p.name,
    description: p.description,
    packaging: p.packaging,
    priceLabel: p.priceLabel,
    category: p.category ? { slug: p.category.slug, name: p.category.name } : null,
    distributor: p.distributor,
  };
}

export async function listProducts(params: ProductSearchParams): Promise<ProductListResponse> {
  const page = Math.max(1, Math.min(1000, Math.floor(params.page) || 1));
  const filters: Prisma.Sql[] = [eligibleProductSql(), eligibleDistributorSql()];
  for (const token of (params.keyword ?? "").split(/\s+/).filter(Boolean).slice(0, 6)) {
    const like = contains(token);
    filters.push(Prisma.sql`(pr."name" ILIKE ${like} OR pr."description" ILIKE ${like} OR d."name" ILIKE ${like} OR c."name" ILIKE ${like})`);
  }
  if (params.category) {
    filters.push(Prisma.sql`(c."slug" = ${params.category} OR c."parentId" IN (SELECT "id" FROM "categories" WHERE "slug" = ${params.category}))`);
  }
  const base = Prisma.sql`
    FROM "products" pr
    JOIN "distributors" d ON d."id" = pr."distributorId"
    JOIN "organisations" o ON o."id" = d."organisationId"
    LEFT JOIN "categories" c ON c."id" = pr."categoryId"
    WHERE ${Prisma.join(filters, " AND ")}`;
  const [rows, count] = await Promise.all([
    prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT pr."id" ${base} ORDER BY lower(pr."name") ASC, pr."id" ASC
      LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}`),
    prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`SELECT COUNT(*)::bigint AS total ${base}`),
  ]);
  const total = Number(count[0]?.total ?? 0);
  const ids = rows.map((r) => r.id);
  const records = ids.length ? await prisma.product.findMany({ where: { id: { in: ids } }, include: listInclude }) : [];
  const byId = new Map(records.map((r) => [r.id, r]));
  return {
    data: ids.flatMap((id) => (byId.has(id) ? [toItem(byId.get(id)!)] : [])),
    pagination: { page, limit: PAGE_SIZE, total, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) },
  };
}

export async function getProductBySlug(publicSlug: string): Promise<ProductDetailDTO | null> {
  const p = await prisma.product.findFirst({
    where: { publicSlug, status: "APPROVED", publicationEnabled: true },
    include: { ...listInclude, distributor: { include: { category: { select: { slug: true, name: true } }, _count: { select: { products: { where: { status: "APPROVED", publicationEnabled: true } } } }, products: { where: { status: "APPROVED", publicationEnabled: true }, select: { name: true }, orderBy: { name: "asc" }, take: 3 } } } },
  });
  // The parent listing must also be publicly eligible (subscription, review, demo gate).
  if (!p || !(await getEligibleId(p.distributor.slug))) return null;
  const related = await prisma.product.findMany({
    where: { distributorId: p.distributorId, id: { not: p.id }, status: "APPROVED", publicationEnabled: true },
    include: listInclude,
    orderBy: { name: "asc" },
    take: 4,
  });
  const d = p.distributor;
  return {
    id: p.id,
    slug: p.slug,
    publicSlug: p.publicSlug,
    name: p.name,
    description: p.description,
    packaging: p.packaging,
    priceLabel: p.priceLabel,
    category: p.category ? { slug: p.category.slug, name: p.category.name } : null,
    distributor: toCard(d, isFeaturedNow(d), d._count.products, d.products.map((x) => x.name)),
    related: related.map(toItem),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export async function listPublicProductSlugs(): Promise<Array<{ publicSlug: string; updatedAt: Date }>> {
  return prisma.$queryRaw<Array<{ publicSlug: string; updatedAt: Date }>>(Prisma.sql`
    SELECT pr."publicSlug", pr."updatedAt"
    FROM "products" pr
    JOIN "distributors" d ON d."id" = pr."distributorId"
    JOIN "organisations" o ON o."id" = d."organisationId"
    WHERE ${eligibleProductSql()} AND ${eligibleDistributorSql()}
    ORDER BY pr."publicSlug" ASC LIMIT 50000`);
}
