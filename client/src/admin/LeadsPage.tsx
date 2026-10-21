import { useQuery } from "@tanstack/react-query";
import { Building2, Mail, Phone } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { LEAD_STATUSES, LEAD_STATUS_LABELS, LEAD_TYPES, LEAD_TYPE_LABELS, type AdminLeadDTO, type LeadStatus } from "@sd/shared";
import { Button } from "@/components/ui/button";
import { adminApi } from "./api";
import { Card, DeleteButton, Details, ErrorLine, ListState, Meta, PageHeader, Pager, SearchBox, Select, StatusBadge, Tabs, TextArea, Toolbar, fmtDateTime, qs, useAdminMutation, useFilters, useIsSuperAdmin } from "./ui";

const KEY = ["admin", "leads"];

export function LeadsPage() {
  const { values, page, set } = useFilters(["status", "type", "q"] as const);
  const list = useQuery({ queryKey: [...KEY, values, page], queryFn: () => adminApi.leads(qs({ ...values, page })), placeholderData: (p) => p });

  return (
    <>
      <PageHeader title="Leads" description="Business registrations and contact messages from the public forms. Contact details are private." />
      <Tabs
        label="Status"
        value={values.status}
        onChange={(v) => set({ status: v })}
        options={[{ value: "", label: "All" }, ...LEAD_STATUSES.map((s) => ({ value: s, label: LEAD_STATUS_LABELS[s] }))]}
      />
      <Toolbar>
        <SearchBox value={values.q} onChange={(v) => set({ q: v })} placeholder="Search name, company, email…" />
        <Select aria-label="Type" value={values.type} onChange={(e) => set({ type: e.target.value })} className="w-auto">
          <option value="">All types</option>
          {LEAD_TYPES.map((t) => (
            <option key={t} value={t}>
              {LEAD_TYPE_LABELS[t]}
            </option>
          ))}
        </Select>
      </Toolbar>
      <ListState query={list} empty={values.q || values.status || values.type ? "No leads match these filters." : "No leads yet. Submissions from Register and Contact appear here."}>
        <ul className="mt-5 space-y-4">
          {list.data?.data.map((l) => (
            <LeadItem key={l.id} lead={l} />
          ))}
        </ul>
      </ListState>
      <Pager pagination={list.data?.pagination} onPage={(p) => set({ page: String(p) })} />
    </>
  );
}

function LeadItem({ lead }: { lead: AdminLeadDTO }) {
  const superAdmin = useIsSuperAdmin();
  const [notes, setNotes] = useState(lead.notes ?? "");
  const update = useAdminMutation((body: { status?: LeadStatus; notes?: string | null }) => adminApi.updateLead(lead.id, body), [KEY]);
  const remove = useAdminMutation(() => adminApi.deleteLead(lead.id), [KEY]);
  const notesDirty = notes.trim() !== (lead.notes ?? "");

  return (
    <li>
      <Card>
        <Meta>
          <span className="font-mono">{lead.reference}</span>
          <span>{LEAD_TYPE_LABELS[lead.type]}</span>
          <time dateTime={lead.createdAt}>{fmtDateTime(lead.createdAt)}</time>
          <StatusBadge status={lead.status} label={LEAD_STATUS_LABELS[lead.status]} />
        </Meta>
        <h2 className="mt-1.5 text-base sm:text-lg">
          {lead.name}
          {lead.companyName && <span className="font-normal text-muted"> · {lead.companyName}</span>}
        </h2>
        <p className="mt-2 whitespace-pre-wrap text-sm text-body">{lead.message}</p>
        <Details
          items={[
            [
              "Email",
              lead.email && (
                <a key="e" href={`mailto:${lead.email}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                  <Mail className="h-3.5 w-3.5" aria-hidden /> {lead.email}
                </a>
              ),
            ],
            [
              "Phone",
              lead.phone && (
                <a key="p" href={`tel:${lead.phone}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                  <Phone className="h-3.5 w-3.5" aria-hidden /> {lead.phone}
                </a>
              ),
            ],
            ["Registration side", lead.registrationSide === "BRAND" ? "Brand / Manufacturer" : lead.registrationSide === "DISTRIBUTOR" ? "Distributor / Wholesaler / Dealer" : null],
            ["Location", lead.location],
            ["Category", lead.categorySlug],
          ]}
        />

        <label htmlFor={`notes-${lead.id}`} className="mt-4 block text-xs font-medium text-muted">
          Private notes
        </label>
        <TextArea id={`notes-${lead.id}`} rows={2} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Called on Monday, sending pricing" className="mt-1" />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {notesDirty && (
            <Button size="sm" onClick={() => update.mutate({ notes: notes.trim() || null })} disabled={update.isPending}>
              Save notes
            </Button>
          )}
          <Select aria-label="Status" value={lead.status} onChange={(e) => update.mutate({ status: e.target.value as LeadStatus })} disabled={update.isPending} className="h-9 w-auto">
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {LEAD_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
          {(lead.type === "BUSINESS_REGISTRATION" || lead.type === "FIND_DISTRIBUTORS") && lead.status !== "CONVERTED" && (
            <Button size="sm" variant="secondary" asChild>
              <Link to={`/listings/new?fromLead=${lead.id}`}>
                <Building2 className="h-4 w-4" aria-hidden /> Create listing
              </Link>
            </Button>
          )}
          {superAdmin && (
            <span className="ml-auto">
              <DeleteButton what="this lead" pending={remove.isPending} onConfirm={() => remove.mutate(undefined)} />
            </span>
          )}
        </div>
        <ErrorLine error={update.error ?? remove.error} />
      </Card>
    </li>
  );
}
