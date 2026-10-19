import { useQuery } from "@tanstack/react-query";
import { Eye, Package, Plus, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { BUSINESS_TYPES, BUSINESS_TYPE_LABELS, LISTING_STATUSES, LISTING_STATUS_LABELS, VERIFICATION_LABELS } from "@sd/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/misc";
import { adminApi } from "./api";
import { Card, ListState, Meta, PageHeader, Pager, SearchBox, Select, StatusBadge, Tabs, Toolbar, fmtDate, qs, useFilters } from "./ui";

export const LISTINGS_KEY = ["admin", "listings"];

export function ListingsPage() {
  const { values, page, set } = useFilters(["status", "businessType", "live", "q"] as const);
  const list = useQuery({ queryKey: [...LISTINGS_KEY, values, page], queryFn: () => adminApi.listings(qs({ ...values, page })), placeholderData: (p) => p });

  return (
    <>
      <PageHeader
        title="Listings"
        description="Distributors and brands shown on the site. A listing is visible only when it's published and its listing period is current."
        actions={
          <Button size="sm" asChild>
            <Link to="/listings/new">
              <Plus className="h-4 w-4" aria-hidden /> New listing
            </Link>
          </Button>
        }
      />
      <Tabs
        label="Status"
        value={values.status}
        onChange={(v) => set({ status: v })}
        options={[{ value: "", label: "All" }, ...LISTING_STATUSES.map((s) => ({ value: s, label: LISTING_STATUS_LABELS[s] }))]}
      />
      <Toolbar>
        <SearchBox value={values.q} onChange={(v) => set({ q: v })} placeholder="Search name or location…" />
        <Select aria-label="Business type" value={values.businessType} onChange={(e) => set({ businessType: e.target.value })} className="w-auto">
          <option value="">All types</option>
          {BUSINESS_TYPES.map((t) => (
            <option key={t} value={t}>
              {BUSINESS_TYPE_LABELS[t]}
            </option>
          ))}
        </Select>
        <Select aria-label="On the site" value={values.live} onChange={(e) => set({ live: e.target.value })} className="w-auto">
          <option value="">Visible and hidden</option>
          <option value="true">Visible on site</option>
          <option value="false">Hidden from site</option>
        </Select>
      </Toolbar>
      <ListState
        query={list}
        empty={
          values.q || values.status || values.businessType || values.live ? (
            "No listings match these filters."
          ) : (
            <>
              No listings yet.{" "}
              <Link to="/listings/new" className="text-primary hover:underline">
                Create the first one
              </Link>{" "}
              or convert a business registration from Leads.
            </>
          )
        }
      >
        <ul className="mt-5 space-y-3">
          {list.data?.data.map((l) => (
            <li key={l.id}>
              <Link to={`/listings/${l.id}`} className="block transition-shadow hover:shadow-card-hover">
                <Card>
                  <Meta>
                    <span>{BUSINESS_TYPE_LABELS[l.businessType]}</span>
                    {l.category && <span>{l.category.name}</span>}
                    <span>{l.location}</span>
                    <StatusBadge status={l.status} label={LISTING_STATUS_LABELS[l.status]} />
                    {l.isPublic ? (
                      <StatusBadge status="LIVE" label="Visible on site" />
                    ) : (
                      <Badge tone="neutral">Hidden</Badge>
                    )}
                    {l.isFeatured && (
                      <Badge tone="accent">
                        <Star className="h-3 w-3" aria-hidden /> Featured
                      </Badge>
                    )}
                  </Meta>
                  <h2 className="mt-1.5 text-base sm:text-lg">{l.name}</h2>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                    <span>{VERIFICATION_LABELS[l.verificationStatus]}</span>
                    <span>Listed until {fmtDate(l.listedUntil)}</span>
                    <span className="inline-flex items-center gap-1">
                      <Package className="h-3.5 w-3.5" aria-hidden /> {l.productCount} products
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Eye className="h-3.5 w-3.5" aria-hidden /> {l.enquiryCount} enquiries
                    </span>
                    <span>Updated {fmtDate(l.updatedAt)}</span>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </ListState>
      <Pager pagination={list.data?.pagination} onPage={(p) => set({ page: String(p) })} />
    </>
  );
}
