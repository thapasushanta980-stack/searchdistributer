import { useQuery } from "@tanstack/react-query";
import { adminApi } from "./api";
import { Card, ListState, PageHeader, Pager, Select, Toolbar, fmtDateTime, qs, useFilters } from "./ui";

const LIMIT = 50;

const ENTITY_LABELS: Record<string, string> = {
  Lead: "Leads",
  Enquiry: "Enquiries",
  Requirement: "Requirements",
  Distributor: "Listings",
  Product: "Products",
  AdCampaign: "Advertising",
};

/** "listing.publish" -> "Listing publish"; the raw action stays visible as a tooltip. */
const describe = (action: string) => {
  const [what = "", verb = ""] = action.split(".");
  return `${what.charAt(0).toUpperCase()}${what.slice(1)} ${verb.replace(/_/g, " ")}`.trim();
};

export function ActivityPage() {
  const { values, page, set } = useFilters(["entityType"] as const);
  const log = useQuery({ queryKey: ["admin", "audit", values, page], queryFn: () => adminApi.audit(qs({ ...values, page })), placeholderData: (p) => p });
  const totalPages = Math.max(1, Math.ceil((log.data?.total ?? 0) / LIMIT));

  return (
    <>
      <PageHeader title="Activity" description="Every sign-in and change made in the back office, newest first." />
      <Toolbar>
        <Select aria-label="Area" value={values.entityType} onChange={(e) => set({ entityType: e.target.value })} className="w-auto">
          <option value="">All areas</option>
          {Object.entries(ENTITY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
      </Toolbar>
      <ListState query={log} empty="No activity yet.">
        <Card className="mt-5 p-0 sm:p-0">
          <ul className="divide-y divide-line">
            {log.data?.data.map((a) => {
              const reason = (a.meta as { reason?: string } | null)?.reason;
              return (
                <li key={a.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3 text-sm">
                  <time dateTime={a.createdAt} className="w-40 shrink-0 text-xs text-muted">
                    {fmtDateTime(a.createdAt)}
                  </time>
                  <span className="font-medium text-ink" title={a.action}>
                    {describe(a.action)}
                  </span>
                  <span className="text-muted">{a.admin?.name ?? "Unknown admin"}</span>
                  {reason && <span className="text-body">“{reason}”</span>}
                  {a.ip && <span className="ml-auto font-mono text-xs text-muted">{a.ip}</span>}
                </li>
              );
            })}
          </ul>
        </Card>
      </ListState>
      <Pager pagination={log.data ? { page, limit: LIMIT, total: log.data.total, totalPages } : undefined} onPage={(p) => set({ page: String(p) })} />
    </>
  );
}
