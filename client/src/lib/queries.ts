import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { requirementQueryString, searchToQueryString, type AdPlacement, type ApiClient, type DistributorSearchParams, type ProductSearchParams, type RequirementSearchParams } from "@sd/shared";

/** One definition per query, shared by components and the server-side prefetcher. */
export const distributorsQuery = (api: ApiClient, params: DistributorSearchParams) =>
  queryOptions({
    queryKey: ["distributors", "list", searchToQueryString(params)],
    queryFn: ({ signal }) => api.listDistributors(params, signal),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

export const distributorQuery = (api: ApiClient, slug: string) =>
  queryOptions({
    queryKey: ["distributors", "detail", slug],
    queryFn: ({ signal }) => api.getDistributor(slug, signal),
    staleTime: 60_000,
  });

export const categoriesQuery = (api: ApiClient) =>
  queryOptions({ queryKey: ["categories"], queryFn: ({ signal }) => api.getCategories(signal), staleTime: 5 * 60_000 });

export const featuredQuery = (api: ApiClient) =>
  queryOptions({ queryKey: ["distributors", "featured"], queryFn: ({ signal }) => api.getFeatured(signal), staleTime: 60_000 });

export const facetsQuery = (api: ApiClient) =>
  queryOptions({ queryKey: ["distributors", "facets"], queryFn: ({ signal }) => api.getFacets(signal), staleTime: 5 * 60_000 });

export const productsQuery = (api: ApiClient, params: ProductSearchParams) =>
  queryOptions({
    queryKey: ["products", params.page, params.keyword ?? "", params.category ?? ""],
    queryFn: ({ signal }) => api.listProducts(params, signal),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

export const productQuery = (api: ApiClient, slug: string) =>
  queryOptions({ queryKey: ["products", "detail", slug], queryFn: ({ signal }) => api.getProduct(slug, signal), staleTime: 60_000 });

export const requirementsQuery = (api: ApiClient, params: RequirementSearchParams) =>
  queryOptions({
    queryKey: ["requirements", "list", requirementQueryString(params)],
    queryFn: ({ signal }) => api.listRequirements(params, signal),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

export const requirementQuery = (api: ApiClient, slug: string) =>
  queryOptions({ queryKey: ["requirements", "detail", slug], queryFn: ({ signal }) => api.getRequirement(slug, signal), staleTime: 60_000 });

export const suggestQuery = (api: ApiClient, q: string) =>
  queryOptions({
    queryKey: ["suggest", q.toLowerCase()],
    queryFn: ({ signal }) => api.suggest(q, signal),
    staleTime: 60_000,
    enabled: q.trim().length >= 2,
  });

export const adsQuery = (api: ApiClient, placement: AdPlacement) =>
  queryOptions({ queryKey: ["ads", placement], queryFn: ({ signal }) => api.listAds(placement, signal), staleTime: 60_000 });
