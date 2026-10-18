import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import type { CategoryDTO, HeadSpec } from "@sd/shared";
import { Breadcrumbs } from "@/components/layout/Layout";
import { CtaSection } from "@/components/distributors/Hero";
import { ResultsSection } from "@/components/distributors/ResultsSection";
import { useApi, useSite } from "@/lib/context";
import { categoriesQuery, distributorsQuery } from "@/lib/queries";
import { useSearchState } from "@/lib/useSearchState";
import { PageHead } from "@/seo/head";
import { abs, breadcrumbLd, hasRefinement, itemListLd, paginationCanonical } from "@/seo/builders";
import { NotFoundPage } from "./NotFoundPage";

export function findCategory(tree: CategoryDTO[], slug: string): { category: CategoryDTO; parent: CategoryDTO | null } | null {
  for (const root of tree) {
    if (root.slug === slug) return { category: root, parent: null };
    const child = root.children.find((c) => c.slug === slug);
    if (child) return { category: child, parent: root };
  }
  return null;
}

export function CategoriesPage() {
  const api = useApi();
  const site = useSite();
  const { data: tree = [] } = useQuery(categoriesQuery(api));
  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Categories", path: "/categories" },
  ];
  const spec: HeadSpec = {
    title: "Distributor Categories | Search Distributors",
    description: "Browse distributors, wholesalers and suppliers by product category, from food and beverage to pharmaceuticals, electronics and agriculture.",
    canonical: abs(site, "/categories"),
    robots: "index,follow",
    jsonLd: [breadcrumbLd(site, crumbs)],
  };
  return (
    <>
      <PageHead spec={spec} site={site} />
      <div className="container-page py-10 sm:py-14">
        <Breadcrumbs items={[{ name: "Home", to: "/" }, { name: "Categories" }]} />
        <h1 className="mt-6 text-3xl sm:text-4xl">Browse distributors by category</h1>
        <p className="mt-3 max-w-2xl text-slate-600">Counts show businesses that are currently listed and accepting enquiries.</p>
        {tree.length === 0 ? (
          <p className="mt-10 rounded-card border border-dashed border-line-strong bg-surface p-10 text-center text-muted">No categories are available yet.</p>
        ) : (
          <ul className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-3 sm:mt-10 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
            {tree.map((c) => (
              <li key={c.slug} className="rounded-card border border-line bg-surface p-4 shadow-card transition-[box-shadow,transform] sm:p-6 duration-200 hover:-translate-y-1 hover:shadow-card-hover">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="min-w-0 text-lg sm:text-xl">
                    <Link to={`/categories/${c.slug}`} className="inline-flex min-h-11 items-center gap-2 hover:text-primary sm:min-h-0">
                      <span className="truncate">{c.name}</span>
                      <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary-dark tabular-nums">{c.distributorCount}</span>
                    </Link>
                  </h2>
                  <Link to={`/categories/${c.slug}`} aria-label={`Browse all ${c.name}`} className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full border border-line-strong px-3 text-xs font-semibold text-slate-700 hover:border-primary/50 hover:text-primary sm:hidden">
                    Browse All <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </div>
                {c.description && <p className="mt-2 text-sm text-muted">{c.description}</p>}
                {c.children.length > 0 && (
                  <ul className="mt-2 border-t border-line pt-2 sm:mt-4 sm:space-y-1.5 sm:pt-4">
                    {c.children.map((ch) => (
                      <li key={ch.slug}>
                        <Link to={`/categories/${ch.slug}`} className="group flex min-h-11 items-center justify-between rounded-lg px-1 text-sm sm:min-h-0 sm:py-1 text-slate-700 hover:text-primary">
                          <span>{ch.name}</span>
                          <span className="flex items-center gap-1 text-xs text-muted tabular-nums">
                            {ch.distributorCount}
                            <ArrowRight className="h-3.5 w-3.5 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" aria-hidden />
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <CtaSection />
    </>
  );
}

export function CategoryPage() {
  const { slug = "" } = useParams();
  const api = useApi();
  const site = useSite();
  const { params } = useSearchState();
  const { data: tree = [], isPending } = useQuery(categoriesQuery(api));
  const found = findCategory(tree, slug);
  const { data: list } = useQuery({ ...distributorsQuery(api, { ...params, category: [slug] }), enabled: !!found });

  if (!found) {
    if (isPending) return <div className="container-page py-20" aria-busy="true" />;
    return <NotFoundPage />;
  }
  const { category, parent } = found;
  const refined = hasRefinement({ ...params, category: [] });
  const thin = category.distributorCount === 0;
  const base = `/categories/${category.slug}`;
  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Categories", path: "/categories" },
    ...(parent ? [{ name: parent.name, path: `/categories/${parent.slug}` }] : []),
    { name: category.name, path: base },
  ];
  const spec: HeadSpec = {
    title: `${category.name} Distributors${params.page > 1 ? ` – Page ${params.page}` : ""} | Search Distributors`,
    description: category.description
      ? `${category.description} Compare ${category.name.toLowerCase()} distributors and send enquiries.`
      : `Find ${category.name.toLowerCase()} distributors, wholesalers and suppliers. Compare company profiles and send enquiries.`,
    canonical: refined ? abs(site, base) : paginationCanonical(site, base, params.page),
    robots: refined || thin ? "noindex,follow" : "index,follow",
    jsonLd: [breadcrumbLd(site, crumbs), ...(list && !refined ? [itemListLd(site, `${category.name} distributors`, list.data, (list.pagination.page - 1) * list.pagination.limit)] : [])],
  };

  return (
    <>
      <PageHead spec={spec} site={site} />
      <div className="border-b border-line bg-white">
        <div className="container-page py-8 sm:py-10">
          <Breadcrumbs items={[{ name: "Home", to: "/" }, { name: "Categories", to: "/categories" }, ...(parent ? [{ name: parent.name, to: `/categories/${parent.slug}` }] : []), { name: category.name }]} />
          <h1 className="mt-5 text-3xl sm:text-4xl">{category.name} distributors</h1>
          {category.description && <p className="mt-3 max-w-2xl text-slate-600">{category.description}</p>}
          {category.children.length > 0 && (
            <ul className="scrollbar-none relative -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:mt-5 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0" aria-label="Subcategories">
              {category.children.map((ch) => (
                <li key={ch.slug} className="shrink-0">
                  <Link to={`/categories/${ch.slug}`} className="inline-flex whitespace-nowrap rounded-full border border-line-strong bg-white px-3.5 py-1.5 text-sm font-medium text-slate-700 hover:border-primary/50 hover:bg-primary-soft hover:text-primary-dark">
                    {ch.name} <span className="ml-1.5 text-xs text-muted tabular-nums">{ch.distributorCount}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <ResultsSection lockedCategory={category.slug} basePath={base} />
      <CtaSection />
    </>
  );
}
