import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Inbox, Info, Mail, Phone, RefreshCw, ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { ENQUIRY_STATUSES, ENQUIRY_STATUS_LABELS, type AdminEnquiryDTO, type AdminEnquiryUpdate } from "@sd/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/misc";
import { adminApi } from "./api";
import { Card, DeleteButton, Details, ErrorLine, ListState, Meta, PageHeader, Pager, SearchBox, Select, StatusBadge, Tabs, Toolbar, fmtDateTime, qs, useAdminMutation, useFilters, useIsSuperAdmin } from "./ui";

const KEY = ["admin", "enquiries"];

export function EnquiriesPage() {
  const { values, page, set } = useFilters(["status", "spam", "q", "distributorId"] as const);
  const list = useQuery({ queryKey: [...KEY, values, page], queryFn: () => adminApi.enquiries(qs({ ...values, page })), placeholderData: (p) => p });
  const filtered = !!(values.q || values.status || values.spam || values.distributorId);
  const clearFilters = () => set({ status: "", spam: "", q: "", distributorId: "", page: "" });

  return (
    <>
      <PageHeader
        title="Enquiries"
        description="Direct messages sent from a specific business profile or product page."
        actions={
          <Button variant="secondary" size="sm" onClick={() => void list.refetch()} disabled={list.isFetching}>
            <RefreshCw className={`h-4 w-4 ${list.isFetching ? "animate-spin" : ""}`} aria-hidden />
            {list.isFetching ? "Refreshing" : "Refresh inbox"}
          </Button>
        }
      />
      <div className="mt-4 flex gap-3 rounded-xl border border-primary/15 bg-gradient-to-r from-primary-soft/70 to-surface px-4 py-3.5 text-sm sm:mt-5">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
        <p className="leading-relaxed text-body">
          New listing enquiries appear here as <strong className="font-semibold text-ink">Unconfirmed</strong> while the sender verifies their email. Buyer requirements and responses to them are managed separately under <Link to="/requirements" className="font-semibold text-primary hover:underline">Requirements</Link>.
        </p>
      </div>
      <Tabs
        label="Status"
        value={values.status}
        onChange={(v) => set({ status: v })}
        options={[{ value: "", label: "All" }, ...ENQUIRY_STATUSES.map((s) => ({ value: s, label: s === "PENDING_VERIFICATION" ? "Unconfirmed" : ENQUIRY_STATUS_LABELS[s] }))]}
      />
      <Toolbar>
        <SearchBox value={values.q} onChange={(v) => set({ q: v })} placeholder="Search sender, email, message…" />
        <Select aria-label="Spam" value={values.spam} onChange={(e) => set({ spam: e.target.value })} className="w-auto">
          <option value="">Spam and not spam</option>
          <option value="false">Not spam</option>
          <option value="true">Marked as spam</option>
        </Select>
        {filtered && <Button size="sm" variant="ghost" onClick={clearFilters}>Clear filters</Button>}
        {values.distributorId && (
          <Button size="sm" variant="ghost" onClick={() => set({ distributorId: "" })}>
            Showing one listing · show all
          </Button>
        )}
      </Toolbar>
      <ListState
        query={list}
        empty={
          filtered ? (
            <div className="mx-auto max-w-md">
              <p className="font-semibold text-ink">No enquiries match these filters</p>
              <p className="mt-1.5 text-sm text-muted">Clear the filters to see the full inbox.</p>
              <Button size="sm" variant="secondary" className="mt-4" onClick={clearFilters}>Clear filters</Button>
            </div>
          ) : (
            <div className="mx-auto max-w-lg py-2">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-primary-soft text-primary"><Inbox className="h-6 w-6" aria-hidden /></span>
              <h2 className="mt-4 text-base font-semibold text-ink">No listing enquiries yet</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">When someone uses <strong className="font-medium text-ink">Send Enquiry</strong> on a published business profile or product page, the message will show here. It appears as Unconfirmed before the sender verifies their email.</p>
              <Button asChild size="sm" variant="secondary" className="mt-4"><a href="/distributors" target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" aria-hidden /> Open public listings</a></Button>
            </div>
          )
        }
      >
        <ul className="mt-5 space-y-4">
          {list.data?.data.map((e) => (
            <EnquiryItem key={e.id} enquiry={e} />
          ))}
        </ul>
      </ListState>
      <Pager pagination={list.data?.pagination} onPage={(p) => set({ page: String(p) })} />
    </>
  );
}

function EnquiryItem({ enquiry: e }: { enquiry: AdminEnquiryDTO }) {
  const superAdmin = useIsSuperAdmin();
  const update = useAdminMutation((body: AdminEnquiryUpdate) => adminApi.updateEnquiry(e.id, body), [KEY]);
  const remove = useAdminMutation(() => adminApi.deleteEnquiry(e.id), [KEY]);
  const confirmed = e.status !== "PENDING_VERIFICATION";

  return (
    <li>
      <Card className={`overflow-hidden border-l-4 ${e.spamFlag ? "border-l-slate-400 opacity-70" : e.status === "PENDING_VERIFICATION" ? "border-l-amber-400" : "border-l-primary"}`}>
        <Meta>
          <span className="font-mono">{e.reference}</span>
          <time dateTime={e.createdAt}>{fmtDateTime(e.createdAt)}</time>
          <StatusBadge status={e.status} label={ENQUIRY_STATUS_LABELS[e.status]} />
          {e.spamFlag && (
            <Badge tone="dark">
              <ShieldAlert className="h-3 w-3" aria-hidden /> Spam
            </Badge>
          )}
        </Meta>
        <h2 className="mt-1.5 text-base sm:text-lg">
          {e.senderName} <span className="font-normal text-muted">→</span>{" "}
          <Link to={`/listings/${e.distributor.id}`} className="text-primary hover:underline">
            {e.distributor.name}
          </Link>
        </h2>
        <div className="mt-4 rounded-xl border border-line bg-slate-50/80 px-4 py-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Message</p>
          <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{e.message}</p>
        </div>
        <Details
          items={[
            [
              "Email",
              <a key="e" href={`mailto:${e.senderEmail}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                <Mail className="h-3.5 w-3.5" aria-hidden /> {e.senderEmail}
              </a>,
            ],
            [
              "Phone",
              e.senderPhone && (
                <a key="p" href={`tel:${e.senderPhone}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                  <Phone className="h-3.5 w-3.5" aria-hidden /> {e.senderPhone}
                </a>
              ),
            ],
            ["Location", e.senderLocation],
            ["Email confirmed", e.verifiedAt ? fmtDateTime(e.verifiedAt) : "Not yet"],
          ]}
        />
        {!confirmed && <p className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-900"><Mail className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />The sender still needs to confirm their email. The business notification is queued only after confirmation.</p>}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
          {confirmed ? (
            <Select aria-label="Status" value={e.status} onChange={(ev) => update.mutate({ status: ev.target.value as "NEW" | "CONTACTED" | "CLOSED" })} disabled={update.isPending} className="h-9 w-auto">
              {(["NEW", "CONTACTED", "CLOSED"] as const).map((s) => (
                <option key={s} value={s}>
                  {ENQUIRY_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          ) : (
            <span className="text-xs font-medium text-amber-800">Waiting for email confirmation</span>
          )}
          <Button size="sm" variant="secondary" onClick={() => update.mutate({ spamFlag: !e.spamFlag })} disabled={update.isPending}>
            <ShieldAlert className="h-4 w-4" aria-hidden /> {e.spamFlag ? "Not spam" : "Mark as spam"}
          </Button>
          <Button size="sm" variant="ghost" asChild>
            <a href={`/distributors/${e.distributor.slug}`} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4" aria-hidden /> View listing
            </a>
          </Button>
          {superAdmin && (
            <span className="ml-auto">
              <DeleteButton what="this enquiry" pending={remove.isPending} onConfirm={() => remove.mutate(undefined)} />
            </span>
          )}
        </div>
        <ErrorLine error={update.error ?? remove.error} />
      </Card>
    </li>
  );
}
