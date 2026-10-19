import { useIsFetching, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import type { HeadSpec } from "@sd/shared";
import { CtaBand } from "@/components/home/blocks";
import { ResultsSection } from "@/components/distributors/ResultsSection";
import { SearchPanel } from "@/components/distributors/SearchPanel";
import { Breadcrumbs } from "@/components/layout/Layout";
import { useApi, useSite } from "@/lib/context";
import { distributorsQuery } from "@/lib/queries";
import { useSearchState } from "@/lib/useSearchState";
import { useDebouncedValue } from "@/lib/utils";
import { PageHead } from "@/seo/head";
import { abs, breadcrumbLd, hasRefinement, paginationCanonical } from "@/seo/builders";

export function BrandsPage() {
  const site = useSite();
  const api = useApi();
  const { params, update } = useSearchState();
  // Same query (and cache entry) as the ResultsSection below, so this adds no request.
  const { data: list } = useQuery(distributorsQuery(api, { ...params, businessType: ["MANUFACTURER"] }));
  const fetching = useIsFetching({ queryKey: ["distributors", "list"] }) > 0;

  const [kw, setKw] = useState(params.keyword ?? "");
  const [loc, setLoc] = useState(params.location ?? "");
  const debKw = useDebouncedValue(kw, 300);
  const debLoc = useDebouncedValue(loc, 300);
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
  useEffect(() => {
    if ((params.keyword ?? "") !== debKw.trim()) setKw(params.keyword ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.keyword]);
  useEffect(() => {
    if ((params.location ?? "") !== debLoc.trim()) setLoc(params.location ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.location]);

  const submit = useCallback(() => update({ keyword: kw.trim() || undefined, location: loc.trim() || undefined }), [kw, loc, update]);
  const pick = useCallback((slug: string) => update({ category: [slug], keyword: undefined }), [update]);

  const refined = hasRefinement({ ...params, businessType: [] });
  const spec: HeadSpec = {
    title: `Discover Brands${params.page > 1 ? ` – Page ${params.page}` : ""} | Search Distributors`,
    description: "Explore brands and manufacturers looking to grow their distribution network. Review company profiles, products and distribution areas.",
    canonical: refined ? abs(site, "/brands") : paginationCanonical(site, "/brands", params.page),
    robots: refined || (list && list.data.length === 0) ? "noindex,follow" : "index,follow",
    jsonLd: [
      breadcrumbLd(site, [
        { name: "Home", path: "/" },
        { name: "Brands", path: "/brands" },
      ]),
    ],
  };

  return (
    <>
      <PageHead spec={spec} site={site} />
      <div className="border-b border-line bg-white">
        <div className="container-page py-10 sm:py-14">
          <Breadcrumbs items={[{ name: "Home", to: "/" }, { name: "Brands" }]} />
          <h1 className="mt-6 text-3xl sm:text-4xl">Discover Brands</h1>
          <p className="mt-3 max-w-2xl text-lg text-body">Explore businesses looking to grow their distribution network.</p>
          <div className="relative z-20 mt-8 max-w-4xl">
            <SearchPanel keyword={kw} location={loc} onKeywordChange={setKw} onLocationChange={setLoc} onSubmit={submit} onPickCategory={pick} loading={fetching} placeholder="Search brands, products or keywords" />
          </div>
        </div>
      </div>
      <ResultsSection lockedBusinessType="MANUFACTURER" basePath="/brands" />
      <CtaBand />
    </>
  );
}
