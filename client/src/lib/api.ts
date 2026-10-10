import {
  requirementQueryString,
  searchToQueryString,
  type ApiClient,
  type ApiErrorBody,
  type AdDTO,
  type CategoryDTO,
  type DistributorCardDTO,
  type DistributorDetailDTO,
  type DistributorListResponse,
  type EnquiryResponse,
  type FacetsResponse,
  type LeadResponse,
  type ProductDetailDTO,
  type ProductListResponse,
  type RequirementDetailDTO,
  type RequirementListResponse,
  type RequirementSubmitResponse,
  type SuggestResponse,
} from "@sd/shared";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, {
      ...init,
      headers: { Accept: "application/json", ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers },
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new ApiError(0, "NETWORK", "Could not reach the server. Check your connection and try again.");
  }
  if (!res.ok) {
    let body: ApiErrorBody | undefined;
    try {
      body = (await res.json()) as ApiErrorBody;
    } catch {
      /* non-JSON error */
    }
    throw new ApiError(res.status, body?.error.code ?? "HTTP_ERROR", body?.error.message ?? `Request failed (${res.status})`, body?.error.fields);
  }
  return (await res.json()) as T;
}

/** Browser implementation of the shared data-access contract. */
export const browserApi: ApiClient = {
  listDistributors: (p, signal) => request<DistributorListResponse>(`/distributors?${searchToQueryString(p)}`, { signal }),
  async getDistributor(slug, signal) {
    try {
      return (await request<{ data: DistributorDetailDTO }>(`/distributors/${encodeURIComponent(slug)}`, { signal })).data;
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return null;
      throw err;
    }
  },
  getCategories: async (signal) => (await request<{ data: CategoryDTO[] }>("/categories", { signal })).data,
  getFeatured: async (signal) => (await request<{ data: DistributorCardDTO[] }>("/distributors/featured", { signal })).data,
  getFacets: (signal) => request<FacetsResponse>("/distributors/facets", { signal }),
  suggest: (q, signal) => request<SuggestResponse>(`/distributors/suggest?q=${encodeURIComponent(q)}`, { signal }),
  listProducts: (p, signal) => {
    const sp = new URLSearchParams();
    if (p.keyword) sp.set("keyword", p.keyword);
    if (p.category) sp.set("category", p.category);
    if (p.page > 1) sp.set("page", String(p.page));
    return request<ProductListResponse>(`/products?${sp.toString()}`, { signal });
  },
  async getProduct(slug, signal) {
    try {
      return (await request<{ data: ProductDetailDTO }>(`/products/${encodeURIComponent(slug)}`, { signal })).data;
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return null;
      throw err;
    }
  },
  listAds: async (placement, signal) => (await request<{ data: AdDTO[] }>(`/ads?placement=${placement}`, { signal })).data,
  listRequirements: (p, signal) => request<RequirementListResponse>(`/requirements?${requirementQueryString(p)}`, { signal }),
  async getRequirement(slug, signal) {
    try {
      return (await request<{ data: RequirementDetailDTO }>(`/requirements/${encodeURIComponent(slug)}`, { signal })).data;
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return null;
      throw err;
    }
  },
};

export const submitEnquiry = (body: unknown) => request<EnquiryResponse>("/enquiries", { method: "POST", body: JSON.stringify(body) });
export const verifyEnquiryToken = (token: string) =>
  request<{ reference: string; distributorName: string }>("/enquiries/verify", { method: "POST", body: JSON.stringify({ token }) });
export const resendEnquiryVerification = (body: { reference: string; email: string }) =>
  request<{ ok: true }>("/enquiries/resend", { method: "POST", body: JSON.stringify(body) });
export const submitLead = (body: unknown) => request<LeadResponse>("/leads", { method: "POST", body: JSON.stringify(body) });
export const submitRequirement = (body: unknown) => request<RequirementSubmitResponse>("/requirements", { method: "POST", body: JSON.stringify(body) });
export const respondToRequirement = (slug: string, body: unknown) =>
  request<{ reference: string }>(`/requirements/${encodeURIComponent(slug)}/responses`, { method: "POST", body: JSON.stringify(body) });
