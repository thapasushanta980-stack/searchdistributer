import type {
  AdminAdAction,
  AdminAdDTO,
  AdminAdInput,
  AdminAuditDTO,
  AdminEnquiryDTO,
  AdminEnquiryUpdate,
  AdminLeadDTO,
  AdminLeadUpdateRequest,
  AdminListingAction,
  AdminListingDTO,
  AdminListingInput,
  AdminListingSummaryDTO,
  AdminMeDTO,
  AdminPage,
  AdminProductDTO,
  AdminProductInput,
  AdminRequirementDTO,
  AdminRequirementResponseDTO,
  AdminStatsDTO,
  AnalyticsDTO,
  AnalyticsRange,
  ApiErrorBody,
  CategoryDTO,
  ModerationDecision,
  PaginationDTO,
} from "@sd/shared";

const BASE = "/api/admin/v1";

export const ME_KEY = ["admin", "me"] as const;

export class AdminApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const method = init.method ?? "GET";
  const res = await fetch(`${BASE}${path}`, {
    method,
    credentials: "same-origin",
    // Required by the server on every state-changing request (CSRF defence).
    headers: { "X-SD-Admin": "1", ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}) },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (res.status === 204) return undefined as T;
  const json = (await res.json().catch(() => null)) as (T & Partial<ApiErrorBody>) | null;
  if (!res.ok) {
    const err = json?.error;
    throw new AdminApiError(res.status, err?.code ?? "ERROR", err?.message ?? "Something went wrong.", err?.fields);
  }
  return json as T;
}

export type RequirementStatus = AdminRequirementDTO["status"];

export const adminApi = {
  /** Resolves to null when nobody is signed in. */
  me: async (): Promise<AdminMeDTO | null> => {
    try {
      return (await request<{ data: AdminMeDTO }>("/auth/me")).data;
    } catch (e) {
      if (e instanceof AdminApiError && e.status === 401) return null;
      throw e;
    }
  },
  login: (email: string, password: string) => request<{ data: AdminMeDTO }>("/auth/login", { method: "POST", body: { email, password } }).then((r) => r.data),
  logout: () => request<void>("/auth/logout", { method: "POST" }),
  stats: () => request<{ data: AdminStatsDTO }>("/stats").then((r) => r.data),
  requirements: (status: RequirementStatus, page: number) =>
    request<{ data: AdminRequirementDTO[]; pagination: PaginationDTO }>(`/requirements?status=${status}&page=${page}`),
  decide: (id: string, body: ModerationDecision) => request<{ data: { id: string; status: RequirementStatus } }>(`/requirements/${id}/decision`, { method: "POST", body }),
  requirementResponses: (id: string) => request<{ data: AdminRequirementResponseDTO[] }>(`/requirements/${id}/responses`).then((r) => r.data),
  setRequirementStatus: (id: string, status: "APPROVED" | "CLOSED") => request<{ data: { id: string; status: RequirementStatus } }>(`/requirements/${id}/status`, { method: "POST", body: { status } }),
  deleteRequirement: (id: string) => request<void>(`/requirements/${id}`, { method: "DELETE" }),

  leads: (query: string) => request<AdminPage<AdminLeadDTO>>(`/leads${query}`),
  lead: (id: string) => request<{ data: AdminLeadDTO }>(`/leads/${id}`).then((r) => r.data),
  updateLead: (id: string, body: AdminLeadUpdateRequest) => request<{ data: AdminLeadDTO }>(`/leads/${id}`, { method: "PATCH", body }).then((r) => r.data),
  deleteLead: (id: string) => request<void>(`/leads/${id}`, { method: "DELETE" }),

  enquiries: (query: string) => request<AdminPage<AdminEnquiryDTO>>(`/enquiries${query}`),
  updateEnquiry: (id: string, body: AdminEnquiryUpdate) => request<{ data: AdminEnquiryDTO }>(`/enquiries/${id}`, { method: "PATCH", body }).then((r) => r.data),
  deleteEnquiry: (id: string) => request<void>(`/enquiries/${id}`, { method: "DELETE" }),

  listings: (query: string) => request<AdminPage<AdminListingSummaryDTO>>(`/listings${query}`),
  listing: (id: string) => request<{ data: AdminListingDTO }>(`/listings/${id}`).then((r) => r.data),
  createListing: (body: AdminListingInput) => request<{ data: AdminListingDTO }>("/listings", { method: "POST", body }).then((r) => r.data),
  updateListing: (id: string, body: AdminListingInput) => request<{ data: AdminListingDTO }>(`/listings/${id}`, { method: "PUT", body }).then((r) => r.data),
  listingAction: (id: string, body: AdminListingAction) => request<{ data: AdminListingDTO }>(`/listings/${id}/action`, { method: "POST", body }).then((r) => r.data),
  deleteListing: (id: string) => request<void>(`/listings/${id}`, { method: "DELETE" }),
  createProduct: (listingId: string, body: AdminProductInput) => request<{ data: AdminProductDTO }>(`/listings/${listingId}/products`, { method: "POST", body }).then((r) => r.data),
  updateProduct: (listingId: string, id: string, body: AdminProductInput) =>
    request<{ data: AdminProductDTO }>(`/listings/${listingId}/products/${id}`, { method: "PUT", body }).then((r) => r.data),
  deleteProduct: (listingId: string, id: string) => request<void>(`/listings/${listingId}/products/${id}`, { method: "DELETE" }),

  ads: (query: string) => request<AdminPage<AdminAdDTO>>(`/ads${query}`),
  ad: (id: string) => request<{ data: AdminAdDTO }>(`/ads/${id}`).then((r) => r.data),
  createAd: (body: AdminAdInput) => request<{ data: AdminAdDTO }>("/ads", { method: "POST", body }).then((r) => r.data),
  updateAd: (id: string, body: AdminAdInput) => request<{ data: AdminAdDTO }>(`/ads/${id}`, { method: "PUT", body }).then((r) => r.data),
  adAction: (id: string, body: AdminAdAction) => request<{ data: AdminAdDTO }>(`/ads/${id}/action`, { method: "POST", body }).then((r) => r.data),
  deleteAd: (id: string) => request<void>(`/ads/${id}`, { method: "DELETE" }),

  analytics: (range: AnalyticsRange) => request<{ data: AnalyticsDTO }>(`/analytics?range=${range}`).then((r) => r.data),
  audit: (query: string) => request<{ data: AdminAuditDTO[]; total: number }>(`/audit-log${query}`),
  /** Public category tree (same origin, no auth needed), used by the listing and product pickers. */
  categories: async (): Promise<CategoryDTO[]> => {
    const res = await fetch("/api/v1/categories", { credentials: "same-origin" });
    if (!res.ok) throw new AdminApiError(res.status, "ERROR", "Couldn't load categories.");
    return ((await res.json()) as { data: CategoryDTO[] }).data;
  },
};
