import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ExternalLink, Lock, MessageSquare, RotateCcw, X } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { REQUIREMENT_KIND_LABELS, type AdminRequirementDTO } from "@sd/shared";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AdminApiError, ME_KEY, adminApi, type RequirementStatus } from "./api";
import { DeleteButton, ErrorLine, fmtDateTime, useAdminMutation, useIsSuperAdmin } from "./ui";

const TABS: Array<{ value: RequirementStatus; label: string }> = [
  { value: "PENDING_REVIEW", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "CLOSED", label: "Closed" },
];

const isStatus = (v: string | null): v is RequirementStatus => TABS.some((t) => t.value === v);

export function RequirementsPage() {
  const [params, setParams] = useSearchParams();
  const status = isStatus(params.get("status")) ? (params.get("status") as RequirementStatus) : "PENDING_REVIEW";
  const page = Math.max(1, Number(params.get("page")) || 1);

  const list = useQuery({ queryKey: ["admin", "requirements", status, page], queryFn: () => adminApi.requirements(status, page), placeholderData: (prev) => prev });
  const go = (next: Record<string, string>) => setParams(next, { replace: true });

  return (
    <>
      <h1 className="text-2xl">Requirements</h1>
      <p className="mt-1 text-sm text-muted">Buyer requirements only go public once approved. Contact details below are private.</p>

      <div role="tablist" aria-label="Status" className="scrollbar-none relative mt-5 flex gap-1 overflow-x-auto border-b border-line sm:mt-6">
        {TABS.map((t) => (
          <button
            key={t.value}
            role="tab"
            aria-selected={status === t.value}
            onClick={() => go({ status: t.value })}
            className={cn("-mb-px min-h-11 shrink-0 whitespace-nowrap border-b-2 px-4 text-sm font-medium transition-colors sm:min-h-0 sm:py-2", status === t.value ? "border-primary text-primary-dark" : "border-transparent text-body hover:text-ink")}
          >
            {t.label}
          </button>
        ))}
      </div>

      {list.isError && (
        <p role="alert" className="mt-6 text-sm text-danger">
          Couldn't load requirements. Please refresh.
        </p>
      )}
      {list.isLoading && <p className="mt-6 text-sm text-muted">Loading…</p>}
      {list.data && list.data.data.length === 0 && <p className="mt-8 rounded-card border border-dashed border-line-strong p-8 text-center text-sm text-muted">Nothing here.</p>}

      <ul className="mt-5 space-y-4">
        {list.data?.data.map((r) => (
          <RequirementItem key={r.id} item={r} />
        ))}
      </ul>

      {list.data && list.data.pagination.totalPages > 1 && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => go({ status, page: String(page - 1) })}>
            Previous
          </Button>
          <span>
            Page {list.data.pagination.page} of {list.data.pagination.totalPages} · {list.data.pagination.total} total
          </span>
          <Button variant="secondary" size="sm" disabled={page >= list.data.pagination.totalPages} onClick={() => go({ status, page: String(page + 1) })}>
            Next
          </Button>
        </div>
      )}
    </>
  );
}

function RequirementItem({ item }: { item: AdminRequirementDTO }) {
  const qc = useQueryClient();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const decide = useMutation({
    mutationFn: (body: { decision: "APPROVE" | "REJECT"; reason?: string }) => adminApi.decide(item.id, body),
    onSettled: (_d, err) => {
      // Refresh the queue and counts. A 401 means the session ended, so re-check who is signed in.
      void qc.invalidateQueries({ queryKey: ["admin", "requirements"] });
      void qc.invalidateQueries({ queryKey: ["admin", "stats"] });
      if (err instanceof AdminApiError && err.status === 401) void qc.invalidateQueries({ queryKey: ME_KEY });
    },
  });
  const error = decide.error instanceof AdminApiError ? (decide.error.fields?.reason ?? decide.error.message) : decide.error ? "Couldn't reach the server." : null;
  const pending = item.status === "PENDING_REVIEW";

  return (
    <li className="rounded-card border border-line bg-surface p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        <span className="font-mono">{item.reference}</span>
        <span>{REQUIREMENT_KIND_LABELS[item.kind]}</span>
        {item.category && <span>{item.category.name}</span>}
        <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time>
      </div>
      <h2 className="mt-1.5 text-base sm:text-lg">{item.title}</h2>
      <p className="mt-2 whitespace-pre-wrap text-sm text-body">{item.description}</p>

      <dl className="mt-4 grid gap-x-6 gap-y-1 rounded-input bg-background p-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-muted">Contact (private)</dt>
          <dd className="text-ink">
            {item.contactName}
            {item.companyName ? ` · ${item.companyName}` : ""}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Email</dt>
          <dd className="break-all text-ink">{item.contactEmail}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Phone</dt>
          <dd className="text-ink">{item.contactPhone}</dd>
        </div>
      </dl>

      {pending && !rejecting && (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:flex">
          <Button size="sm" onClick={() => decide.mutate({ decision: "APPROVE" })} disabled={decide.isPending}>
            <Check className="h-4 w-4" aria-hidden /> Approve
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setRejecting(true)} disabled={decide.isPending}>
            <X className="h-4 w-4" aria-hidden /> Reject…
          </Button>
        </div>
      )}
      {pending && rejecting && (
        <div className="mt-4">
          <label htmlFor={`reason-${item.id}`} className="mb-1 block text-sm font-medium text-ink">
            Reason for rejecting (kept in the audit log)
          </label>
          <textarea
            id={`reason-${item.id}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            rows={2}
            className="w-full rounded-input border border-line-strong bg-surface p-3 text-base text-ink focus-visible:outline-primary sm:text-sm"
          />
          <div className="mt-2 grid grid-cols-2 gap-2 sm:flex">
            <Button size="sm" variant="primary" disabled={decide.isPending || !reason.trim()} onClick={() => decide.mutate({ decision: "REJECT", reason: reason.trim() })}>
              Confirm rejection
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setRejecting(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
      <AfterDecision item={item} />
    </li>
  );
}

const LIST_KEY = ["admin", "requirements"];

/** Close, reopen, view, delete and read responses: everything after the approve/reject decision. */
function AfterDecision({ item }: { item: AdminRequirementDTO }) {
  const superAdmin = useIsSuperAdmin();
  const [showResponses, setShowResponses] = useState(false);
  const status = useAdminMutation((next: "APPROVED" | "CLOSED") => adminApi.setRequirementStatus(item.id, next), [LIST_KEY]);
  const remove = useAdminMutation(() => adminApi.deleteRequirement(item.id), [LIST_KEY]);
  const responses = useQuery({ queryKey: ["admin", "requirement-responses", item.id], queryFn: () => adminApi.requirementResponses(item.id), enabled: showResponses });

  return (
    <>
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
        {item.status === "APPROVED" && (
          <>
            <Button size="sm" variant="ghost" asChild>
              <a href={`/leads/${item.slug}`} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" aria-hidden /> View on site
              </a>
            </Button>
            <Button size="sm" variant="secondary" onClick={() => status.mutate("CLOSED")} disabled={status.isPending}>
              <Lock className="h-4 w-4" aria-hidden /> Close
            </Button>
          </>
        )}
        {item.status === "CLOSED" && (
          <Button size="sm" variant="secondary" onClick={() => status.mutate("APPROVED")} disabled={status.isPending}>
            <RotateCcw className="h-4 w-4" aria-hidden /> Reopen
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => setShowResponses((v) => !v)} aria-expanded={showResponses} disabled={item.responseCount === 0}>
          <MessageSquare className="h-4 w-4" aria-hidden /> {item.responseCount} {item.responseCount === 1 ? "response" : "responses"}
        </Button>
        {superAdmin && (
          <span className="ml-auto">
            <DeleteButton what="this requirement and its responses" pending={remove.isPending} onConfirm={() => remove.mutate(undefined)} />
          </span>
        )}
      </div>
      <ErrorLine error={status.error ?? remove.error} />
      {showResponses && (
        <ul className="mt-3 space-y-2">
          {responses.isLoading && <li className="text-sm text-muted">Loading responses…</li>}
          {responses.data?.map((r) => (
            <li key={r.id} className="rounded-input border border-line bg-background p-3 text-sm">
              <div className="flex flex-wrap gap-x-3 text-xs text-muted">
                <span className="font-mono">{r.reference}</span>
                <span>{fmtDateTime(r.createdAt)}</span>
              </div>
              <p className="mt-1 font-medium text-ink">
                {r.senderName} · <a href={`mailto:${r.senderEmail}`} className="text-primary hover:underline">{r.senderEmail}</a>
                {r.senderPhone ? ` · ${r.senderPhone}` : ""} · {r.senderLocation}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-body">{r.message}</p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
