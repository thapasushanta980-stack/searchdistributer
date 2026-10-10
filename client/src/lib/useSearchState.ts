import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { parseSearch, searchToQueryString, type DistributorSearchParams } from "@sd/shared";

/** URL is the single source of truth: copyable links, back/forward and reloads all restore the search. */
export function useSearchState() {
  const [sp, setSp] = useSearchParams();
  const key = sp.toString();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const params = useMemo(() => parseSearch(sp), [key]);

  const update = useCallback(
    (patch: Partial<DistributorSearchParams>, opts?: { replace?: boolean }) => {
      const next = { ...params, ...patch };
      // Any change to the query resets pagination unless the caller sets the page explicitly.
      if (!("page" in patch)) next.page = 1;
      setSp(new URLSearchParams(searchToQueryString(next)), { replace: opts?.replace, preventScrollReset: true });
    },
    [params, setSp],
  );

  const clearAll = useCallback(() => setSp(new URLSearchParams(), { preventScrollReset: true }), [setSp]);

  return { params, update, clearAll };
}

/** Number of refinements currently applied (excluding sort, page and keyword). */
export function countActiveFilters(p: DistributorSearchParams, lockedCategory?: string): number {
  return (
    (lockedCategory ? 0 : p.category.length) +
    p.subcategory.length +
    p.coverage.length +
    p.businessType.length +
    (p.verified ? 1 : 0) +
    (p.reviewed ? 1 : 0) +
    (p.location ? 1 : 0) +
    (p.investmentMin !== undefined || p.investmentMax !== undefined ? 1 : 0)
  );
}

/** False during SSR and the first client render so hydration matches; true afterwards. */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}
