import { useIsFetching, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { HeadSpec } from "@sd/shared";
import { AdBanner } from "@/components/ads/AdSlot";
import { Breadcrumbs } from "@/components/layout/Layout";
import { CtaSection, HeroShell, PopularChips } from "@/components/distributors/Hero";
import { ResultsSection } from "@/components/distributors/ResultsSection";
import { SearchPanel } from "@/components/distributors/SearchPanel";
import { Reveal } from "@/components/ui/reveal";
import { useApi, useSite } from "@/lib/context";
import { categoriesQuery, distributorsQuery } from "@/lib/queries";
import { useSearchState } from "@/lib/useSearchState";
import { useDebouncedValue } from "@/lib/utils";
import { PageHead } from "@/seo/head";
import { abs, breadcrumbLd, faqLd, hasRefinement, itemListLd, paginationCanonical, personLd } from "@/seo/builders";
import { DISTRIBUTOR_FAQ } from "@/seo/content";

const TITLE = "Search Distributors | Find Trusted Business Partners";
const DESCRIPTION = "Discover distributors and business partners by product, category and location. Explore company profiles and send enquiries.";

export function EditorBio() {
  const site = useSite();
  if (!site.editor) return null;
  return (
    <aside aria-label="About the editor" className="mt-8 flex items-start gap-4 rounded-card border border-line bg-surface p-5">
      <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-soft font-display text-lg font-bold text-primary-dark">
        {site.editor.name.slice(0, 1)}
      </span>
      <div>
        <p className="font-semibold text-ink">{site.editor.name}</p>
        {site.editor.role && <p className="text-sm text-muted">{site.editor.role}</p>}
        <p className="mt-1.5 text-sm text-slate-700">{site.editor.bio}</p>
      </div>
    </aside>
  );
}

export function DistributorsPage() {
  const api = useApi();
  const site = useSite();
  const { params, update } = useSearchState();
  const { data: categories = [] } = useQuery(categoriesQuery(api));
  const { data: list } = useQuery(distributorsQuery(api, params));
  const fetching = useIsFetching({ queryKey: ["distributors", "list"] }) > 0;

  const [kw, setKw] = useState(params.keyword ?? "");
  const [loc, setLoc] = useState(params.location ?? "");
  const debKw = useDebouncedValue(kw, 300);
  const debLoc = useDebouncedValue(loc, 300);

  // Typing updates the URL after ~300ms (replace, so Back does not step through every keystroke).
  useEffect(() => {
    const next = debKw.trim() || undefined;
    if (next !== params.keyword) update({ keyword: next }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debKw]);
  useEffect(() => {
    const next = debLoc.trim() || undefined;
    if (next !== params.location) update({ location: next }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debLoc]);
  // Back/forward or sidebar edits: pull the new URL value into the field when it was not typed here.
  useEffect(() => {
    if ((params.keyword ?? "") !== debKw.trim()) setKw(params.keyword ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.keyword]);
  useEffect(() => {
    if ((params.location ?? "") !== debLoc.trim()) setLoc(params.location ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.location]);

  const submit = useCallback(() => {
    update({ keyword: kw.trim() || undefined, location: loc.trim() || undefined });
    requestAnimationFrame(() => document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [kw, loc, update]);

  const pickCategory = useCallback(
    (slug: string) => {
      setKw("");
      update({ category: [slug], keyword: undefined });
    },
    [update],
  );

  const refined = hasRefinement(params);
  // A search that only picks one category is the same content as that category's landing page.
  const onlyCategory = params.category.length === 1 && !hasRefinement({ ...params, category: [] }) ? params.category[0] : undefined;
  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Find Distributors", path: "/distributors" },
  ];
  const spec: HeadSpec = {
    title: params.keyword ? `${params.keyword} distributors | Search Distributors` : params.page > 1 ? `Search Distributors – Page ${params.page} | Find Trusted Business Partners` : TITLE,
    description: params.page > 1 && !refined ? `${DESCRIPTION} Page ${params.page}.` : DESCRIPTION,
    canonical: onlyCategory ? abs(site, `/categories/${onlyCategory}`) : refined ? abs(site, "/distributors") : paginationCanonical(site, "/distributors", params.page),
    robots: refined ? "noindex,follow" : "index,follow",
    jsonLd: [
      breadcrumbLd(site, crumbs),
      ...(!refined && list ? [itemListLd(site, "Distributors", list.data, (list.pagination.page - 1) * list.pagination.limit)] : []),
      faqLd(DISTRIBUTOR_FAQ),
      ...(personLd(site) ? [personLd(site)!] : []),
    ],
  };

  return (
    <>
      <PageHead spec={spec} site={site} />
      <HeroShell
        eyebrow="DISTRIBUTOR NETWORK"
        headline="Find the right distributor."
        highlight="Grow into new markets."
        sub="Discover businesses, distributors and market partners by product, category and location. Explore verified profiles and connect directly."
        top={<Breadcrumbs items={[{ name: "Home", to: "/" }, { name: "Find Distributors" }]} />}
      >
        <div className="anim-pop relative z-20 mx-auto mt-6 max-w-[960px] sm:mt-9">
          <SearchPanel keyword={kw} location={loc} onKeywordChange={setKw} onLocationChange={setLoc} onSubmit={submit} onPickCategory={pickCategory} loading={fetching} />
        </div>
        <PopularChips categories={categories} />
      </HeroShell>

      <AdBanner placement="SEARCH_TOP_BANNER" className="container-page" />
      <ResultsSection basePath="/distributors" showFeatured />

      <Reveal as="section" className="container-page pb-14">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-2xl sm:text-3xl">Questions about finding distributors</h2>
          <div className="mt-6 divide-y divide-line rounded-card border border-line bg-surface">
            {DISTRIBUTOR_FAQ.map((item) => (
              <details key={item.q} className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded font-medium text-ink">
                  <span>{item.q}</span>
                  <ChevronDown className="h-5 w-5 shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden />
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{item.a}</p>
              </details>
            ))}
          </div>
          <EditorBio />
        </div>
      </Reveal>

      <CtaSection />
    </>
  );
}
