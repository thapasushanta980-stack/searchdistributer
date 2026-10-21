import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { AlertTriangle, Search, Trash2 } from "lucide-react";
import { useEffect, useId, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { useSearchParams } from "react-router-dom";
import type { AdminMeDTO, PaginationDTO } from "@sd/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/misc";
import { cn } from "@/lib/utils";
import { AdminApiError, ME_KEY } from "./api";

/* ------------------------------ Data ------------------------------- */

export function useMe(): AdminMeDTO | null {
  return useQuery<AdminMeDTO | null>({ queryKey: ME_KEY, enabled: false }).data ?? null;
}
export const useIsSuperAdmin = () => useMe()?.role === "SUPER_ADMIN";

/**
 * Mutation that refreshes the given lists and the dashboard counts afterwards.
 * A 401 means the session ended, so it re-checks who is signed in (which shows the login screen).
 */
export function useAdminMutation<TVars, TData>(fn: (v: TVars) => Promise<TData>, invalidate: QueryKey[], onSuccess?: (data: TData) => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess,
    onSettled: (_d, err) => {
      for (const key of [...invalidate, ["admin", "stats"]]) void qc.invalidateQueries({ queryKey: key });
      if (err instanceof AdminApiError && err.status === 401) void qc.invalidateQueries({ queryKey: ME_KEY });
    },
  });
}

export const errorText = (err: unknown) => (err instanceof AdminApiError ? err.message : err ? "Couldn't reach the server. Check your connection and try again." : null);
export const fieldError = (err: unknown, field: string) => (err instanceof AdminApiError ? err.fields?.[field] : undefined);

/** Reads and writes list filters in the URL so they survive reloads and can be shared. */
export function useFilters<K extends string>(keys: readonly K[]) {
  const [params, setParams] = useSearchParams();
  const values = Object.fromEntries(keys.map((k) => [k, params.get(k) ?? ""])) as Record<K, string>;
  const page = Math.max(1, Number(params.get("page")) || 1);
  const set = (patch: Partial<Record<K | "page", string>>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch) as Array<[string, string | undefined]>) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!("page" in patch)) next.delete("page");
    setParams(next, { replace: true });
  };
  return { values, page, set };
}

export function qs(params: Record<string, string | number | boolean | undefined | null>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
}

export const fmtDate = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—");
export const fmtDateTime = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");

/** <input type="date"> value (local day) <-> ISO end of that day. */
export const toDateInput = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const fromDateInput = (v: string, endOfDay = true) => (v ? new Date(`${v}T${endOfDay ? "23:59:59" : "00:00:00"}`).toISOString() : null);

/* ------------------------------ Layout ----------------------------- */

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Tabs<T extends string>({ value, options, onChange, label }: { value: T; options: Array<{ value: T; label: string; count?: number }>; onChange: (v: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="scrollbar-none relative mt-5 flex gap-1 overflow-x-auto border-b border-line sm:mt-6">
      {options.map((t) => (
        <button
          key={t.value || "all"}
          role="tab"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={cn(
            "-mb-px min-h-11 shrink-0 whitespace-nowrap border-b-2 px-4 text-sm font-medium transition-colors sm:min-h-0 sm:py-2",
            value === t.value ? "border-primary text-primary-dark" : "border-transparent text-body hover:text-ink",
          )}
        >
          {t.label}
          {t.count ? <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-white">{t.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

/** Search box that updates the list after typing pauses. */
export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  useEffect(() => {
    if (draft === value) return;
    const t = setTimeout(() => onChange(draft.trim()), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);
  return (
    <label className="relative block w-full sm:max-w-xs">
      <span className="sr-only">{placeholder}</span>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
      <input type="search" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder} className={cn(inputCls, "pl-9")} />
    </label>
  );
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="mt-4 flex flex-wrap items-center gap-2">{children}</div>;
}

export function Pager({ pagination, onPage }: { pagination: PaginationDTO | undefined; onPage: (p: number) => void }) {
  if (!pagination || pagination.totalPages <= 1) return pagination ? <p className="mt-6 text-center text-xs text-muted">{pagination.total} total</p> : null;
  const { page, totalPages, total } = pagination;
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
      <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </Button>
      <span>
        Page {page} of {totalPages} · {total} total
      </span>
      <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
        Next
      </Button>
    </div>
  );
}

/** Loading, error and empty handling shared by every list. */
export function ListState({ query, empty, children }: { query: { isLoading: boolean; isError: boolean; data?: { data: unknown[] } }; empty: ReactNode; children: ReactNode }) {
  if (query.isLoading)
    return (
      <div className="mt-5 space-y-3" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton h-24 w-full rounded-card" />
        ))}
      </div>
    );
  if (query.isError && !query.data)
    return (
      <p role="alert" className="mt-6 rounded-input border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
        Couldn't load this list. Please refresh.
      </p>
    );
  if (query.data && query.data.data.length === 0) return <div className="mt-6 rounded-card border border-dashed border-line-strong p-8 text-center text-sm text-muted">{empty}</div>;
  return <>{children}</>;
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-card border border-line bg-surface p-4 shadow-card sm:p-5", className)}>{children}</div>;
}

export function Meta({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">{children}</div>;
}

export function Details({ items }: { items: Array<[string, ReactNode]> }) {
  const shown = items.filter(([, v]) => v !== null && v !== undefined && v !== "");
  if (!shown.length) return null;
  return (
    <dl className="mt-3 grid gap-x-6 gap-y-2 rounded-input bg-background p-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
      {shown.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-xs text-muted">{k}</dt>
          <dd className="break-words text-ink">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

const TONES = { NEW: "primary", PENDING_REVIEW: "accent", SUBMITTED: "accent", PENDING_VERIFICATION: "neutral", APPROVED: "success", CONTACTED: "accent", CONVERTED: "success", LIVE: "success" } as const;
export function StatusBadge({ status, label }: { status: string; label: string }) {
  return <Badge tone={(TONES as Record<string, "primary" | "accent" | "neutral" | "success">)[status] ?? "neutral"}>{label}</Badge>;
}

export function ErrorLine({ error }: { error: unknown }) {
  const text = errorText(error);
  return text ? (
    <p role="alert" className="mt-3 text-sm text-danger">
      {text}
    </p>
  ) : null;
}

/** Destructive action with an inline second step, so a stray click can never delete. */
export function DeleteButton({ onConfirm, pending, what, disabled }: { onConfirm: () => void; pending: boolean; what: string; disabled?: boolean }) {
  const [asking, setAsking] = useState(false);
  if (!asking)
    return (
      <Button size="sm" variant="ghost" className="text-danger hover:bg-danger/10" onClick={() => setAsking(true)} disabled={disabled || pending}>
        <Trash2 className="h-4 w-4" aria-hidden /> Delete
      </Button>
    );
  return (
    <span role="group" aria-label={`Confirm deleting ${what}`} className="inline-flex flex-wrap items-center gap-2 rounded-button border border-danger/30 bg-danger/5 px-2 py-1 text-sm">
      <AlertTriangle className="h-4 w-4 text-danger" aria-hidden />
      <span className="text-danger">Delete {what} for good?</span>
      <Button size="sm" className="bg-danger hover:bg-danger/90" onClick={onConfirm} disabled={pending}>
        {pending ? "Deleting…" : "Yes, delete"}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setAsking(false)} disabled={pending}>
        Cancel
      </Button>
    </span>
  );
}

/* ------------------------------ Forms ------------------------------ */

export const inputCls = "h-11 w-full rounded-input border border-line-strong bg-surface px-3 text-base text-ink focus-visible:outline-primary sm:text-sm";

export function Field({ label, hint, error, children, className }: { label: string; hint?: string; error?: string; children: (id: string) => ReactNode; className?: string }) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-ink">
        {label}
      </label>
      {children(id)}
      {hint && !error && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {error && (
        <p role="alert" className="mt-1 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export const TextInput = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cn(inputCls, p.className)} />;
export const TextArea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea rows={4} {...p} className={cn("w-full rounded-input border border-line-strong bg-surface p-3 text-base text-ink focus-visible:outline-primary sm:text-sm", p.className)} />
);
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={cn(inputCls, "pr-8", p.className)} />;

export function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-input border border-line p-3 hover:bg-background">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--color-primary)]" />
      <span>
        <span className="block text-sm font-medium text-ink">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
    </label>
  );
}

export function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-card border border-line bg-surface p-4 shadow-card sm:p-6">
      <h2 className="text-lg">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

/** Comma-separated list input for string arrays (territories, specialties). */
export const splitList = (v: string) =>
  v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

/** Chips for short lists (territories, specialties): Enter or comma adds, Backspace on empty removes the last. */
export function TagInput({ id, value, onChange, placeholder, max = 30, invalid }: { id: string; value: string[]; onChange: (v: string[]) => void; placeholder?: string; max?: number; invalid?: boolean }) {
  const [draft, setDraft] = useState("");
  const add = (raw: string) => {
    const items = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const next = [...value];
    for (const it of items) if (!next.some((x) => x.toLowerCase() === it.toLowerCase()) && next.length < max) next.push(it.slice(0, 80));
    onChange(next);
    setDraft("");
  };
  return (
    <div className={cn("flex min-h-11 flex-wrap items-center gap-1.5 rounded-input border bg-surface px-2 py-1.5 focus-within:outline focus-within:outline-2 focus-within:outline-primary", invalid ? "border-danger" : "border-line-strong")}>
      {value.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 rounded-full bg-primary-soft py-0.5 pl-2.5 pr-1 text-sm text-primary-dark">
          {t}
          <button type="button" onClick={() => onChange(value.filter((x) => x !== t))} aria-label={`Remove ${t}`} className="grid h-5 w-5 place-items-center rounded-full hover:bg-primary/15">
            ×
          </button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        onChange={(e) => (e.target.value.includes(",") ? add(e.target.value) : setDraft(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (draft.trim()) add(draft);
          } else if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={() => draft.trim() && add(draft)}
        placeholder={value.length ? "" : placeholder}
        className="min-w-[8rem] flex-1 bg-transparent px-1 text-base text-ink outline-none sm:text-sm"
      />
    </div>
  );
}
