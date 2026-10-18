import { Prisma } from "@prisma/client";
import type { CategoryDTO } from "@sd/shared";
import { prisma } from "../../db.js";
import { TtlCache } from "../../lib/ttlCache.js";
import { eligibleDistributorSql } from "../distributors/eligibility.js";

const cache = new TtlCache<CategoryDTO[]>(30_000);

/** Call after an admin changes anything that affects category counts or visibility. */
export const clearCategoryCache = () => cache.clear();

/** Category hierarchy with the number of publicly discoverable distributors per node. */
export function getCategoryTree(): Promise<CategoryDTO[]> {
  return cache.get("tree", async () => {
    const [cats, counts] = await Promise.all([
      prisma.category.findMany({ where: { isHidden: false }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
      prisma.$queryRaw<Array<{ categoryId: string; n: bigint }>>(Prisma.sql`
        SELECT d."categoryId", COUNT(*)::bigint AS n
        FROM "distributors" d JOIN "organisations" o ON o."id" = d."organisationId"
        WHERE d."categoryId" IS NOT NULL AND ${eligibleDistributorSql()}
        GROUP BY d."categoryId"`),
    ]);
    const own = new Map(counts.map((c) => [c.categoryId, Number(c.n)]));
    const nodes = new Map<string, CategoryDTO>(
      cats.map((c) => [
        c.id,
        {
          id: c.id,
          slug: c.slug,
          name: c.name,
          description: c.description,
          parentId: c.parentId,
          distributorCount: own.get(c.id) ?? 0,
          children: [],
        },
      ]),
    );
    const roots: CategoryDTO[] = [];
    for (const node of nodes.values()) {
      const parent = node.parentId ? nodes.get(node.parentId) : undefined;
      if (parent) {
        parent.children.push(node);
        parent.distributorCount += node.distributorCount;
      } else {
        roots.push(node);
      }
    }
    return roots;
  });
}

export async function getCategoryBySlug(slug: string): Promise<CategoryDTO | null> {
  const tree = await getCategoryTree();
  for (const root of tree) {
    if (root.slug === slug) return root;
    const child = root.children.find((c) => c.slug === slug);
    if (child) return child;
  }
  return null;
}
