import { Prisma } from "@prisma/client";
import type {
  DistributorCardDTO,
  DistributorDetailDTO,
  DistributorListResponse,
  DistributorSearchParams,
  FacetsResponse,
  SuggestResponse,
} from "@sd/shared";
import { config } from "../../config.js";
import { prisma } from "../../db.js";
import { TtlCache } from "../../lib/ttlCache.js";
import { contains, startsWith } from "../../lib/sql.js";
import { eligibleDistributorSql, eligibleProductSql } from "./eligibility.js";
import { isFeaturedNow, toCard, toProduct } from "./mappers.js";

const MAX_TOKENS = 6;

/** Build the WHERE clause for a search. Every user value is bound as a parameter. */
function buildFilters(p: DistributorSearchParams): Prisma.Sql[] {
  const where: Prisma.Sql[] = [];

  const tokens = (p.keyword ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, MAX_TOKENS);
  for (const token of tokens) {
    const like = contains(token);
    where.push(Prisma.sql`(
      d."name" ILIKE ${like}
      OR d."summary" ILIKE ${like}
      OR d."description" ILIKE ${like}
      OR d."location" ILIKE ${like}
      OR array_to_string(d."specialties", ' ') ILIKE ${like}
      OR c."name" ILIKE ${like}
      OR EXISTS (
        SELECT 1 FROM "products" pr
        WHERE pr."distributorId" = d."id" AND ${eligibleProductSql()} AND pr."name" ILIKE ${like}
      )
    )`);
  }

  if (p.category.length) {
    where.push(Prisma.sql`(
      c."slug" = ANY(${p.category})
      OR c."parentId" IN (SELECT "id" FROM "categories" WHERE "slug" = ANY(${p.category}))
    )`);
  }
  if (p.subcategory.length) where.push(Prisma.sql`c."slug" = ANY(${p.subcategory})`);

  if (p.location) {
    const like = contains(p.location);
    where.push(Prisma.sql`(
      d."location" ILIKE ${like} OR d."city" ILIKE ${like} OR d."country" ILIKE ${like}
      OR array_to_string(d."territories", ' ') ILIKE ${like}
    )`);
  }
  if (p.coverage.length) where.push(Prisma.sql`d."coverage"::text = ANY(${p.coverage})`);
  if (p.businessType.length) where.push(Prisma.sql`d."businessType"::text = ANY(${p.businessType})`);

  if (p.verified) where.push(Prisma.sql`d."verificationStatus" = 'VERIFIED'`);
  else if (p.reviewed) where.push(Prisma.sql`d."verificationStatus" IN ('PROFILE_REVIEWED', 'VERIFIED')`);

  // Investment: keep listings whose [min, max] overlaps the requested range. Unknown values never match.
  if (p.investmentMin !== undefined || p.investmentMax !== undefined) {
    where.push(Prisma.sql`COALESCE(d."investmentMin", d."investmentMax") IS NOT NULL`);
    if (p.investmentMin !== undefined) {
      where.push(Prisma.sql`COALESCE(d."investmentMax", d."investmentMin") >= ${p.investmentMin}`);
    }
    if (p.investmentMax !== undefined) {
      where.push(Prisma.sql`COALESCE(d."investmentMin", d."investmentMax") <= ${p.investmentMax}`);
    }
  }
  return where;
}

function relevanceSql(keyword: string | undefined): Prisma.Sql {
  const boost = Prisma.sql`(CASE d."verificationStatus" WHEN 'VERIFIED' THEN 3 WHEN 'PROFILE_REVIEWED' THEN 1 ELSE 0 END)
    + (CASE WHEN d."isFeatured" AND (d."featuredUntil" IS NULL OR d."featuredUntil" > now()) THEN 2 ELSE 0 END)`;
  if (!keyword) return boost;
  const phrase = keyword.trim();
  return Prisma.sql`(
    (CASE
      WHEN lower(d."name") = lower(${phrase}) THEN 100
      WHEN d."name" ILIKE ${startsWith(phrase)} THEN 60
      WHEN d."name" ILIKE ${contains(phrase)} THEN 40
      ELSE 0 END)
    + (CASE WHEN array_to_string(d."specialties", ' ') ILIKE ${contains(phrase)} OR c."name" ILIKE ${contains(phrase)} THEN 15 ELSE 0 END)
    + (CASE WHEN d."summary" ILIKE ${contains(phrase)} THEN 6 ELSE 0 END)
    + (CASE WHEN EXISTS (
        SELECT 1 FROM "products" pr
        WHERE pr."distributorId" = d."id" AND ${eligibleProductSql()} AND pr."name" ILIKE ${contains(phrase)}
      ) THEN 10 ELSE 0 END)
    + ${boost}
  )`;
}

function orderSql(p: DistributorSearchParams): Prisma.Sql {
  switch (p.sort) {
    case "newest":
      return Prisma.sql`d."createdAt" DESC, d."id" ASC`;
    case "name":
      return Prisma.sql`lower(d."name") ASC, d."id" ASC`;
    default:
      return Prisma.sql`"score" DESC, lower(d."name") ASC, d."id" ASC`;
  }
}

const FROM = Prisma.sql`
  FROM "distributors" d
  JOIN "organisations" o ON o."id" = d."organisationId"
  LEFT JOIN "categories" c ON c."id" = d."categoryId"
`;

export async function searchDistributors(p: DistributorSearchParams): Promise<DistributorListResponse> {
  const now = new Date();
  const where = [eligibleDistributorSql(now), ...buildFilters(p)];
  const whereSql = Prisma.join(where, " AND ");
  const offset = (p.page - 1) * p.limit;

  const [rows, countRows] = await Promise.all([
    prisma.$queryRaw<Array<{ id: string }>>`
      SELECT d."id", ${relevanceSql(p.keyword)} AS "score"
      ${FROM}
      WHERE ${whereSql}
      ORDER BY ${orderSql(p)}
      LIMIT ${p.limit} OFFSET ${offset}`,
    prisma.$queryRaw<Array<{ total: bigint }>>`SELECT COUNT(*)::bigint AS total ${FROM} WHERE ${whereSql}`,
  ]);

  const total = Number(countRows[0]?.total ?? 0);
  const ids = rows.map((r) => r.id);
  const records = ids.length
    ? await prisma.distributor.findMany({ where: { id: { in: ids } }, include: { category: { select: { slug: true, name: true } }, _count: { select: { products: { where: { status: "APPROVED", publicationEnabled: true } } } }, products: { where: { status: "APPROVED", publicationEnabled: true }, select: { name: true }, orderBy: { name: "asc" }, take: 3 } } })
    : [];
  const byId = new Map(records.map((r) => [r.id, r]));
  const data = ids.flatMap((id) => {
    const r = byId.get(id);
    return r ? [toCard(r, isFeaturedNow(r, now), r._count.products, r.products.map((p) => p.name))] : [];
  });

  return {
    data,
    pagination: { page: p.page, limit: p.limit, total, totalPages: Math.max(1, Math.ceil(total / p.limit)) },
  };
}

export async function getEligibleId(slug: string): Promise<{ id: string; organisationId: string; name: string } | null> {
  const rows = await prisma.$queryRaw<Array<{ id: string; organisationId: string; name: string }>>`
    SELECT d."id", d."organisationId", d."name" ${FROM}
    WHERE d."slug" = ${slug} AND ${eligibleDistributorSql()}
    LIMIT 1`;
  return rows[0] ?? null;
}

export async function getDistributorBySlug(slug: string): Promise<DistributorDetailDTO | null> {
  const hit = await getEligibleId(slug);
  if (!hit) return null;
  const now = new Date();
  const d = await prisma.distributor.findUnique({
    where: { id: hit.id },
    include: {
      category: { select: { slug: true, name: true } },
      _count: { select: { products: { where: { status: "APPROVED", publicationEnabled: true } } } },
      products: {
        where: { status: "APPROVED", publicationEnabled: true },
        include: { category: { select: { slug: true, name: true } } },
        orderBy: { name: "asc" },
        take: 60,
      },
    },
  });
  if (!d) return null;

  let related: DistributorCardDTO[] = [];
  if (d.category) {
    const res = await searchDistributors({
      category: [d.category.slug],
      subcategory: [],
      coverage: [],
      businessType: [],
      verified: false,
      reviewed: false,
      sort: "newest",
      page: 1,
      limit: 4,
    });
    related = res.data.filter((r) => r.id !== d.id).slice(0, 3);
  }

  return {
    ...toCard(d, isFeaturedNow(d, now), d._count.products, d.products.slice(0, 3).map((p) => p.name)),
    description: d.description,
    website: d.website,
    contactPerson: d.contactPerson,
    territories: d.territories,
    distributorshipInfo: d.distributorshipInfo,
    minimumOrder: d.minimumOrder,
    supportOffered: d.supportOffered,
    foundedYear: d.foundedYear,
    products: d.products.map(toProduct),
    related,
    updatedAt: d.updatedAt.toISOString(),
  };
}

const featuredCache = new TtlCache<DistributorCardDTO[]>(30_000);
const facetsCache = new TtlCache<FacetsResponse>(60_000);

export function getFeatured(): Promise<DistributorCardDTO[]> {
  return featuredCache.get("featured", async () => {
    const now = new Date();
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT d."id" ${FROM}
      WHERE ${eligibleDistributorSql(now)}
        AND d."isFeatured" = true AND (d."featuredUntil" IS NULL OR d."featuredUntil" > ${now})
      ORDER BY d."updatedAt" DESC
      LIMIT 4`;
    if (!rows.length) return [];
    const records = await prisma.distributor.findMany({
      where: { id: { in: rows.map((r) => r.id) } },
      include: { category: { select: { slug: true, name: true } }, _count: { select: { products: { where: { status: "APPROVED", publicationEnabled: true } } } }, products: { where: { status: "APPROVED", publicationEnabled: true }, select: { name: true }, orderBy: { name: "asc" }, take: 3 } },
    });
    return records.map((r) => toCard(r, true, r._count.products, r.products.map((p) => p.name)));
  });
}

export function getFacets(): Promise<FacetsResponse> {
  return facetsCache.get("facets", async () => {
    const rows = await prisma.$queryRaw<Array<{ lo: number | null; hi: number | null; total: bigint; currency: string | null }>>`
      SELECT MIN(COALESCE(d."investmentMin", d."investmentMax")) AS lo,
             MAX(COALESCE(d."investmentMax", d."investmentMin")) AS hi,
             COUNT(*)::bigint AS total,
             MODE() WITHIN GROUP (ORDER BY d."investmentCurrency") AS currency
      ${FROM}
      WHERE ${eligibleDistributorSql()}`;
    const r = rows[0];
    const total = Number(r?.total ?? 0);
    if (!r || r.lo === null || r.hi === null) return { investment: null, total };
    return { investment: { min: r.lo, max: Math.max(r.hi, r.lo + 1), currency: r.currency ?? config.DEFAULT_CURRENCY }, total };
  });
}

/** Typeahead: eligible companies, categories and locations that match the typed text. */
export async function suggest(q: string): Promise<SuggestResponse> {
  const text = q.trim().slice(0, 80);
  if (text.length < 2) return { data: [] };
  const like = contains(text);
  const prefix = startsWith(text);

  const [companies, categories, locations] = await Promise.all([
    prisma.$queryRaw<Array<{ name: string; slug: string }>>`
      SELECT d."name", d."slug" ${FROM}
      WHERE ${eligibleDistributorSql()} AND d."name" ILIKE ${like}
      ORDER BY (d."name" ILIKE ${prefix}) DESC, lower(d."name") ASC
      LIMIT 4`,
    prisma.$queryRaw<Array<{ name: string; slug: string }>>`
      SELECT c."name", c."slug" FROM "categories" c
      WHERE c."isHidden" = false AND c."name" ILIKE ${like}
      ORDER BY (c."name" ILIKE ${prefix}) DESC, c."sortOrder" ASC
      LIMIT 3`,
    prisma.$queryRaw<Array<{ location: string }>>`
      SELECT DISTINCT d."location" ${FROM}
      WHERE ${eligibleDistributorSql()} AND d."location" ILIKE ${like}
      LIMIT 3`,
  ]);

  return {
    data: [
      ...categories.map((c) => ({ type: "category" as const, label: `${c.name} distributors`, value: c.name, href: `/categories/${c.slug}` })),
      ...companies.map((c) => ({ type: "distributor" as const, label: c.name, value: c.name, href: `/distributors/${c.slug}` })),
      ...locations.map((l) => ({ type: "location" as const, label: l.location, value: l.location })),
    ],
  };
}

/** Slugs of every public profile, for the sitemap. */
export async function listPublicSlugs(): Promise<Array<{ slug: string; updatedAt: Date }>> {
  return prisma.$queryRaw<Array<{ slug: string; updatedAt: Date }>>`
    SELECT d."slug", d."updatedAt" ${FROM}
    WHERE ${eligibleDistributorSql()}
    ORDER BY d."slug" ASC
    LIMIT 50000`;
}
