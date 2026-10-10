import { AlertTriangle, ChevronLeft, ChevronRight, WifiOff } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Original abstract marketplace illustration: a few boxes linked by routes, one empty slot. */
function EmptyIllustration() {
  return (
    <svg viewBox="0 0 220 140" className="mx-auto h-36 w-auto" role="img" aria-label="Illustration of an empty distributor network" focusable="false">
      <defs>
        <linearGradient id="eg" x1="0" x2="1">
          <stop offset="0" stopColor="#3156D3" />
          <stop offset="1" stopColor="#6D5DFB" />
        </linearGradient>
      </defs>
      <path d="M45 100 L110 40 L178 96" fill="none" stroke="#CBD5E1" strokeWidth="2" strokeDasharray="4 6" strokeLinecap="round" />
      <path d="M45 100 L178 96" fill="none" stroke="#E2E8F0" strokeWidth="2" strokeLinecap="round" />
      <rect x="22" y="80" width="46" height="40" rx="10" fill="#fff" stroke="#CBD5E1" strokeWidth="2" />
      <rect x="31" y="92" width="18" height="4" rx="2" fill="#E2E8F0" />
      <rect x="31" y="101" width="28" height="4" rx="2" fill="#E2E8F0" />
      <rect x="86" y="18" width="48" height="44" rx="12" fill="url(#eg)" />
      <circle cx="110" cy="40" r="9" fill="none" stroke="#fff" strokeWidth="3.5" />
      <path d="M117 47l7 7" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" />
      <rect x="154" y="76" width="46" height="40" rx="10" fill="#fff" stroke="#CBD5E1" strokeWidth="2" strokeDasharray="5 5" />
      <path d="M177 90v12M171 96h12" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function EmptyState({ onClear, canClear }: { onClear: () => void; canClear: boolean }) {
  return (
    <div role="status" className="rounded-card border border-dashed border-line-strong bg-surface px-6 py-14 text-center">
      <EmptyIllustration />
      <h3 className="mt-6 text-xl">No distributors found</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">Try a broader search, another location or remove some filters.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {canClear && <Button onClick={onClear}>Clear Filters</Button>}
        <Button asChild variant="secondary">
          <Link to="/post-requirement">Send Your Requirement</Link>
        </Button>
      </div>
    </div>
  );
}

export function ErrorState({ offline, onRetry, message }: { offline?: boolean; onRetry: () => void; message?: string }) {
  const Icon = offline ? WifiOff : AlertTriangle;
  return (
    <div role="alert" className="rounded-card border border-red-200 bg-red-50/60 px-6 py-12 text-center">
      <Icon className="mx-auto h-9 w-9 text-danger" aria-hidden />
      <h3 className="mt-4 text-lg">{offline ? "You appear to be offline" : "We couldn’t load distributors"}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
        {offline ? "Reconnect to the internet and try again." : (message ?? "Something went wrong on our side. Your filters are saved, so you can retry.")}
      </p>
      <Button className="mt-5" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

export function Pagination({ page, totalPages, hrefFor, onNavigate }: { page: number; totalPages: number; hrefFor: (p: number) => string; onNavigate?: () => void }) {
  if (totalPages <= 1) return null;
  const pages: Array<number | "gap"> = [];
  const add = (p: number) => {
    if (p >= 1 && p <= totalPages && !pages.includes(p)) pages.push(p);
  };
  add(1);
  for (let p = page - 1; p <= page + 1; p++) add(p);
  add(totalPages);
  pages.sort((a, b) => (a as number) - (b as number));
  const withGaps: Array<number | "gap"> = [];
  pages.forEach((p, i) => {
    if (i > 0 && (p as number) - (pages[i - 1] as number) > 1) withGaps.push("gap");
    withGaps.push(p);
  });

  const item = "inline-flex h-10 min-w-10 items-center justify-center rounded-button px-3 text-sm font-medium transition-colors";
  return (
    <nav aria-label="Pagination" className="mt-10 flex justify-center">
      <ul className="flex flex-wrap items-center justify-center gap-1.5">
        <li>
          {page > 1 ? (
            <Link to={hrefFor(page - 1)} rel="prev" onClick={onNavigate} className={cn(item, "gap-1 border border-line-strong bg-white hover:border-primary/40 hover:bg-primary-soft")}>
              <ChevronLeft className="h-4 w-4" aria-hidden /> Previous
            </Link>
          ) : (
            <span aria-disabled className={cn(item, "gap-1 border border-line bg-slate-50 text-slate-400")}>
              <ChevronLeft className="h-4 w-4" aria-hidden /> Previous
            </span>
          )}
        </li>
        {withGaps.map((p, i) =>
          p === "gap" ? (
            <li key={`g${i}`} aria-hidden className="px-1 text-slate-400">
              …
            </li>
          ) : (
            <li key={p}>
              <Link
                to={hrefFor(p)}
                onClick={onNavigate}
                aria-label={`Page ${p}`}
                aria-current={p === page ? "page" : undefined}
                className={cn(item, p === page ? "bg-primary text-white shadow-sm" : "border border-line-strong bg-white hover:border-primary/40 hover:bg-primary-soft")}
              >
                {p}
              </Link>
            </li>
          ),
        )}
        <li>
          {page < totalPages ? (
            <Link to={hrefFor(page + 1)} rel="next" onClick={onNavigate} className={cn(item, "gap-1 border border-line-strong bg-white hover:border-primary/40 hover:bg-primary-soft")}>
              Next <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          ) : (
            <span aria-disabled className={cn(item, "gap-1 border border-line bg-slate-50 text-slate-400")}>
              Next <ChevronRight className="h-4 w-4" aria-hidden />
            </span>
          )}
        </li>
      </ul>
    </nav>
  );
}
