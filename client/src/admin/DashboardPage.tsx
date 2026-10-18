import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import type { AdminStatsDTO } from "@sd/shared";
import { cn } from "@/lib/utils";
import { adminApi } from "./api";

interface Tile {
  key: keyof AdminStatsDTO;
  label: string;
  hint: string;
  /** Where the queue lives, once it has a screen. */
  to?: string;
  /** Non-zero means something needs a person. */
  attention: boolean;
}

const TILES: Tile[] = [
  { key: "requirementsPending", label: "Requirements to review", hint: "Buyer requirements waiting for moderation", to: "/requirements", attention: true },
  { key: "listingsPending", label: "Listings to review", hint: "Distributor listings submitted for approval", attention: true },
  { key: "productsPending", label: "Products to review", hint: "Products submitted for approval", attention: true },
  { key: "adsPending", label: "Ads to review", hint: "Campaigns awaiting approval", attention: true },
  { key: "enquiriesAwaitingVerification", label: "Unverified enquiries", hint: "Senders yet to confirm their email", attention: false },
  { key: "outboxFailed", label: "Failed emails", hint: "Notifications that ran out of retries", attention: true },
  { key: "leadsLast7Days", label: "Leads, last 7 days", hint: "Contact and registration submissions", attention: false },
];

export function DashboardPage() {
  const stats = useQuery({ queryKey: ["admin", "stats"], queryFn: adminApi.stats });

  return (
    <>
      <h1 className="text-2xl">Dashboard</h1>
      <p className="mt-1 text-sm text-muted">What needs attention right now.</p>

      {stats.isError && (
        <p role="alert" className="mt-6 rounded-input border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
          Couldn't load the numbers. Please refresh.
        </p>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3 sm:mt-6 sm:gap-4 lg:grid-cols-3">
        {TILES.map((t) => {
          const value = stats.data?.[t.key];
          const hot = t.attention && !!value;
          const body = (
            <>
              <div className="text-sm font-medium text-ink">{t.label}</div>
              <div className={cn("mt-1.5 font-display text-2xl font-bold sm:mt-2 sm:text-3xl", hot ? "text-primary" : "text-ink")}>{value ?? <span className="text-line-strong">—</span>}</div>
              <div className="mt-1 line-clamp-2 text-xs text-muted">{t.hint}</div>
            </>
          );
          const cls = "block rounded-card border bg-surface p-4 shadow-card sm:p-5 " + (hot ? "border-primary/40" : "border-line");
          return t.to ? (
            <Link key={t.key} to={t.to} className={cn(cls, "transition-shadow hover:shadow-card-hover")}>
              {body}
            </Link>
          ) : (
            <div key={t.key} className={cls}>
              {body}
            </div>
          );
        })}
      </div>
    </>
  );
}
