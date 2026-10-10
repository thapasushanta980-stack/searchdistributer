import {
  BUSINESS_TYPE_LABELS,
  DEFAULT_PAGE_SIZE,
  searchToQueryString,
  type DistributorCardDTO,
  type DistributorDetailDTO,
  type DistributorSearchParams,
  type HeadSpec,
  type SiteConfigDTO,
} from "@sd/shared";
import { truncate } from "@/lib/utils";

export interface Crumb {
  name: string;
  /** Path, e.g. "/distributors". */
  path: string;
}

export const abs = (site: SiteConfigDTO, path: string) => `${site.siteUrl}${path === "/" ? "" : path}`;

export function breadcrumbLd(site: SiteConfigDTO, crumbs: Crumb[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: abs(site, c.path),
    })),
  };
}

export const organizationLd = (site: SiteConfigDTO) => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  name: site.siteName,
  url: site.siteUrl,
  logo: `${site.siteUrl}/favicon.svg`,
  ...(site.supportEmail ? { email: site.supportEmail } : {}),
});

export const websiteLd = (site: SiteConfigDTO) => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: site.siteName,
  url: site.siteUrl,
  potentialAction: {
    "@type": "SearchAction",
    target: { "@type": "EntryPoint", urlTemplate: `${site.siteUrl}/distributors?keyword={search_term_string}` },
    "query-input": "required name=search_term_string",
  },
});

export const faqLd = (items: ReadonlyArray<{ q: string; a: string }>) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: items.map((i) => ({ "@type": "Question", name: i.q, acceptedAnswer: { "@type": "Answer", text: i.a } })),
});

export const itemListLd = (site: SiteConfigDTO, name: string, items: DistributorCardDTO[], offset = 0) => ({
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name,
  mainEntity: {
    "@type": "ItemList",
    itemListElement: items.map((d, i) => ({
      "@type": "ListItem",
      position: offset + i + 1,
      url: abs(site, `/distributors/${d.slug}`),
      name: d.name,
    })),
  },
});

export const personLd = (site: SiteConfigDTO) =>
  site.editor
    ? {
        "@context": "https://schema.org",
        "@type": "Person",
        name: site.editor.name,
        ...(site.editor.role ? { jobTitle: site.editor.role } : {}),
        description: site.editor.bio,
        worksFor: { "@type": "Organization", name: site.siteName },
      }
    : null;

export function distributorLd(site: SiteConfigDTO, d: DistributorDetailDTO) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${abs(site, `/distributors/${d.slug}`)}#organization`,
    name: d.name,
    url: abs(site, `/distributors/${d.slug}`),
    description: d.summary,
    ...(d.logoUrl ? { logo: d.logoUrl } : {}),
    ...(d.website ? { sameAs: [d.website] } : {}),
    ...(d.foundedYear ? { foundingDate: String(d.foundedYear) } : {}),
    address: {
      "@type": "PostalAddress",
      ...(d.location ? { addressLocality: d.location.split(",")[0]?.trim() } : {}),
      ...(d.country ? { addressCountry: d.country } : {}),
    },
    ...(d.territories.length ? { areaServed: d.territories } : {}),
  };
}

/* ------------------------------------------------------------------ */
/* Indexing policy for search result pages                             */
/* ------------------------------------------------------------------ */

/**
 * Filtered / keyword searches are useful to people but thin and near-infinite for crawlers:
 * mark them noindex,follow and point the canonical at the unfiltered page.
 * Plain pagination (?page=N) stays indexable so deeper profiles remain discoverable.
 */
export function hasRefinement(p: DistributorSearchParams): boolean {
  return Boolean(
    p.keyword ||
      p.category.length ||
      p.subcategory.length ||
      p.location ||
      p.coverage.length ||
      p.businessType.length ||
      p.verified ||
      p.reviewed ||
      p.investmentMin !== undefined ||
      p.investmentMax !== undefined ||
      p.sort !== "relevance" ||
      p.limit !== DEFAULT_PAGE_SIZE,
  );
}

export function paginationCanonical(site: SiteConfigDTO, basePath: string, page: number): string {
  const qs = page > 1 ? `?${searchToQueryString({ page })}` : "";
  return `${abs(site, basePath)}${qs}`;
}

export function profileTitle(d: DistributorDetailDTO): string {
  const type = BUSINESS_TYPE_LABELS[d.businessType];
  const full = `${d.name} – ${type} in ${d.location}`;
  return truncate(full, 58) + " | Search Distributors";
}

export function profileDescription(d: DistributorDetailDTO): string {
  const bits = [d.summary];
  if (d.specialties.length) bits.push(`Specialties: ${d.specialties.slice(0, 3).join(", ")}.`);
  return truncate(bits.join(" "), 158);
}

export function notFoundSpec(site: SiteConfigDTO, path: string): HeadSpec {
  return {
    title: "Page not found | Search Distributors",
    description: "The page you were looking for is not available.",
    canonical: abs(site, path),
    robots: "noindex,nofollow",
    status: 404,
  };
}
