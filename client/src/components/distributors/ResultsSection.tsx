import { useQuery } from "@tanstack/react-query";
import { m } from "framer-motion";
import { SlidersHorizontal } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { SORT_LABELS, SORT_OPTIONS, searchToQueryString, type DistributorCardDTO, type DistributorSearchParams, type SortOption } from "@sd/shared";
import { LazyEnquiryDialog, preloadEnquiryDialog, type EnquiryTarget } from "@/components/forms/lazy";
import { Button } from "@/components/ui/button";
import { OverlayDialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/form";
import { useApi } from "@/lib/context";
import { categoriesQuery, distributorsQuery, facetsQuery, featuredQuery } from "@/lib/queries";
import { usePreloadWhenIdle } from "@/lib/lazyClient";
import { countActiveFilters, useHydrated, useSearchState } from "@/lib/useSearchState";
import { cn, useOnlineStatus } from "@/lib/utils";
import { DistributorCard, DistributorCardSkeleton } from "./DistributorCard";
import { FeaturedStrip } from "./FeaturedStrip";
import { FilterPanel, type FilterValue } from "./FilterPanel";
import { EmptyState, ErrorState, Pagination } from "./states";

const pickFilters = (p: DistributorSearchParams): FilterValue => ({
  category: p.category,
  subcategory: p.subcategory,
  location: p.location,
  coverage: p.coverage,
  businessType: p.businessType,
  verified: p.verified,
  reviewed: p.reviewed,
  investmentMin: p.investmentMin,
  investmentMax: p.investmentMax,
});

interface Props {
  /** Category landing pages scope results to one category and hide that filter group. */
  lockedCategory?: string;
  /** Brand pages scope results to manufacturers and hide that filter. */
  lockedBusinessType?: "MANUFACTURER";
  basePath: string;
  showFeatured?: boolean;
}

export function ResultsSection({ lockedCategory, lockedBusinessType, basePath, showFeatured }: Props) {
  const api = useApi();
  const online = useOnlineStatus();
  const hydrated = useHydrated();
  usePreloadWhenIdle(preloadEnquiryDialog);
  const { params, update, clearAll } = useSearchState();
  const effective = useMemo<DistributorSearchParams>(
    () => ({ ...params, ...(lockedCategory ? { category: [lockedCategory] } : {}), ...(lockedBusinessType ? { businessType: [lockedBusinessType] } : {}) }),
    [params, lockedCategory, lockedBusinessType],
  );

  const results = useQuery(distributorsQuery(api, effective));
  const { data: categories = [] } = useQuery(categoriesQuery(api));
  const { data: facets } = useQuery(facetsQuery(api));
  const { data: featured = [] } = useQuery(featuredQuery(api));

  const view = "grid" as const;

  const [enquiry, setEnquiry] = useState<EnquiryTarget | null>(null);
  const onEnquire = useCallback((d: DistributorCardDTO) => setEnquiry({ slug: d.slug, name: d.name }), []);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draft, setDraft] = useState<FilterValue>(() => pickFilters(params));
  const openDrawer = () => {
    setDraft(pickFilters(params));
    setDrawerOpen(true);
  };

  const activeCount = countActiveFilters(lockedBusinessType ? { ...params, businessType: [] } : params, lockedCategory);
  const refined = activeCount > 0 || !!params.keyword;
  const canClear = refined || params.sort !== "relevance";
  const clear = () => {
    // Category landing pages keep their scope; everything else resets.
    clearAll();
  };

  const data = results.data;
  const total = data?.pagination.total ?? 0;
  const hrefFor = (page: number) => {
    const qs = searchToQueryString({ ...params, page });
    return qs ? `${basePath}?${qs}` : basePath;
  };
  const scrollTop = () => requestAnimationFrame(() => document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" }));

  const filterPanel = (value: FilterValue, onChange: (patch: Partial<FilterValue>) => void, prefix: string) => (
    <FilterPanel value={value} onChange={onChange} categories={categories} facets={facets} hideCategory={!!lockedCategory} hideBusinessType={!!lockedBusinessType} idPrefix={prefix} />
  );

  return (
    <section id="results" aria-labelledby="results-heading" className="container-page scroll-mt-20 py-10 lg:py-12">
      <h2 id="results-heading" className="sr-only">
        Distributor search results
      </h2>
      <div className="grid gap-8 lg:grid-cols-[272px_minmax(0,1fr)]">
        {/* ---------- Desktop filter sidebar ---------- */}
        <aside aria-label="Filters" className="hidden lg:block">
          <div className="sticky top-24 max-h-[calc(100dvh-7rem)] overflow-y-auto rounded-card border border-line bg-surface p-5 shadow-card">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-sans text-base font-semibold tracking-normal">Filter Results</h3>
              <button type="button" onClick={clear} disabled={!canClear} className="text-sm font-medium text-primary hover:underline disabled:pointer-events-none disabled:text-slate-400">
                Clear all
              </button>
            </div>
            {filterPanel(pickFilters(params), (patch) => update(patch), "desk")}
          </div>
        </aside>

        {/* ---------- Results ---------- */}
        <div className="min-w-0">
          {showFeatured && !refined && params.page === 1 && <FeaturedStrip items={featured} />}

          <div className="mb-5 flex flex-wrap items-center gap-3">
            <p aria-live="polite" className="mr-auto text-sm text-slate-600">
              {data ? (
                <>
                  Showing <strong className="tabular-nums text-ink">{total.toLocaleString("en")}</strong> {total === 1 ? "distributor" : "distributors"}
                </>
              ) : (
                "Loading distributors…"
              )}
              {results.isFetching && data && <span className="ml-2 text-xs text-primary">Updating…</span>}
            </p>

            <Button variant="secondary" size="sm" className="lg:hidden" onClick={openDrawer}>
              <SlidersHorizontal className="h-4 w-4" aria-hidden />
              Filters{activeCount ? ` (${activeCount})` : ""}
            </Button>

            <div className="flex items-center gap-2">
              <label htmlFor="sort" className="sr-only">
                Sort results
              </label>
              <Select id="sort" value={params.sort} onChange={(e) => update({ sort: e.target.value as SortOption })} className="h-11 w-auto py-0 pr-9 text-sm sm:h-9">
                {SORT_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {SORT_LABELS[s]}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {results.isPending ? (
            <ul aria-busy="true" aria-label="Loading distributors" className={cn("grid gap-5", view === "grid" ? "sm:grid-cols-2 xl:grid-cols-3" : "grid-cols-1")}>
              {Array.from({ length: 6 }, (_, i) => (
                <DistributorCardSkeleton key={i} view={view} />
              ))}
            </ul>
          ) : results.isError && !data ? (
            <ErrorState offline={!online} onRetry={() => results.refetch()} message={results.error instanceof Error ? results.error.message : undefined} />
          ) : data && data.data.length === 0 ? (
            <EmptyState onClear={clear} canClear={canClear || params.page > 1} />
          ) : data ? (
            <m.div key={searchToQueryString(effective)} initial={false} animate={{ opacity: results.isPlaceholderData ? 0.55 : 1 }} transition={{ duration: 0.15 }} aria-busy={results.isFetching}>
                <ul className={cn("grid gap-5", view === "grid" ? "sm:grid-cols-2 xl:grid-cols-3" : "grid-cols-1")}>
                  {data.data.map((d, i) => (
                    <DistributorCard key={d.id} d={d} view={view} index={i} animate={hydrated} onEnquire={onEnquire} />
                  ))}
                </ul>
                {results.isError && (
                  <p role="alert" className="mt-4 text-center text-sm text-danger">
                    Couldn’t refresh results.{" "}
                    <button type="button" className="font-medium underline" onClick={() => results.refetch()}>
                      Try again
                    </button>
                  </p>
                )}
                <Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} hrefFor={hrefFor} onNavigate={scrollTop} />
            </m.div>
          ) : null}
        </div>
      </div>

      {/* ---------- Mobile / tablet filter drawer (spring from the right) ---------- */}
      <OverlayDialog open={drawerOpen} onOpenChange={setDrawerOpen} title="Filter Results" variant="sheet">
        <div className="flex-1 overflow-y-auto px-5 py-4">{filterPanel(draft, (patch) => setDraft((d) => ({ ...d, ...patch })), "drawer")}</div>
        <div className="flex gap-2 border-t border-line bg-white px-5 py-4">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => {
              setDraft(pickFilters({ ...params, category: [], subcategory: [], coverage: [], businessType: [], verified: false, reviewed: false, location: undefined, investmentMin: undefined, investmentMax: undefined }));
            }}
          >
            Clear all
          </Button>
          <Button
            className="flex-[1.4]"
            onClick={() => {
              update({ ...draft, ...(lockedCategory ? { category: [] } : {}), ...(lockedBusinessType ? { businessType: [] } : {}) });
              setDrawerOpen(false);
            }}
          >
            Apply Filters
          </Button>
        </div>
      </OverlayDialog>

      <LazyEnquiryDialog target={enquiry} onClose={() => setEnquiry(null)} />
    </section>
  );
}
