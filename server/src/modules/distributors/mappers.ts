import type { Category, Distributor, Product } from "@prisma/client";
import type { DistributorCardDTO, ProductDTO } from "@sd/shared";

type WithCategory = Distributor & { category: Pick<Category, "slug" | "name"> | null };

export function toCard(d: WithCategory, featuredNow = false, productCount = 0, productPreview: string[] = []): DistributorCardDTO {
  return {
    id: d.id,
    slug: d.slug,
    name: d.name,
    logoUrl: d.logoUrl,
    summary: d.summary,
    category: d.category ? { slug: d.category.slug, name: d.category.name } : null,
    location: d.location,
    country: d.country,
    businessType: d.businessType,
    coverage: d.coverage,
    verificationStatus: d.verificationStatus,
    specialties: d.specialties.slice(0, 6),
    isFeatured: featuredNow,
    isDemo: d.isDemo,
    investmentMin: d.investmentMin,
    investmentMax: d.investmentMax,
    investmentCurrency: d.investmentCurrency,
    productCount,
    productPreview,
    createdAt: d.createdAt.toISOString(),
  };
}

export function isFeaturedNow(d: Pick<Distributor, "isFeatured" | "featuredUntil">, now = new Date()): boolean {
  return d.isFeatured && (!d.featuredUntil || d.featuredUntil > now);
}

export function toProduct(p: Product & { category: Pick<Category, "slug" | "name"> | null }): ProductDTO {
  return {
    id: p.id,
    slug: p.slug,
    publicSlug: p.publicSlug,
    name: p.name,
    description: p.description,
    category: p.category ? { slug: p.category.slug, name: p.category.name } : null,
    packaging: p.packaging,
    priceLabel: p.priceLabel,
  };
}
