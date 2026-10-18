import type { AdminMeDTO, AdminRequirementDTO, AdminStatsDTO, ApiErrorBody, ModerationDecision, PaginationDTO } from "@sd/shared";

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
};
