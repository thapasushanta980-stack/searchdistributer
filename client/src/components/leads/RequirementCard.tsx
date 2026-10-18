import { m } from "framer-motion";
import { MapPin, Wallet } from "lucide-react";
import { Link } from "react-router-dom";
import { REQUIREMENT_KIND_LABELS, type RequirementCardDTO } from "@sd/shared";
import { Badge } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { cn, formatInvestment } from "@/lib/utils";

export function budgetLabel(r: Pick<RequirementCardDTO, "budgetMin" | "budgetMax" | "budgetCurrency">): string | null {
  return formatInvestment(r.budgetMin, r.budgetMax, r.budgetCurrency);
}

/** Compact lead card: the essentials only. Experience, warehouse and the full description live on the lead page. */
export function RequirementCard({ r, index = 0, animate = false, className }: { r: RequirementCardDTO; index?: number; animate?: boolean; className?: string }) {
  const budget = budgetLabel(r);
  return (
    <m.li
      initial={animate ? { opacity: 0, y: 16 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: Math.min(index, 8) * 0.045, ease: [0.22, 1, 0.36, 1] }}
      className={cn("list-none", className)}
    >
      <m.article
        whileHover={{ y: -3 }}
        transition={{ type: "spring", stiffness: 420, damping: 30 }}
        aria-labelledby={`req-${r.id}`}
        className="flex h-full flex-col rounded-card border border-line bg-surface p-5 shadow-card transition-[box-shadow,border-color] duration-200 hover:border-line-strong hover:shadow-card-hover"
      >
        <div className="flex flex-wrap items-center gap-2">
          {r.category && <span className="text-xs font-semibold uppercase tracking-wide text-primary">{r.category.name}</span>}
          {r.isNew && <Badge tone="success">New</Badge>}
          {r.isDemo && <Badge>Demo data</Badge>}
        </div>

        <h3 id={`req-${r.id}`} className="mt-2 line-clamp-2 text-lg">
          <Link to={`/leads/${r.slug}`} className="rounded transition-colors hover:text-primary">
            {r.title}
          </Link>
        </h3>
        <p className="mt-1 text-sm text-muted">
          {r.poster ?? "Business seeker"} · {REQUIREMENT_KIND_LABELS[r.kind]}
        </p>

        <dl className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-slate-600">
          <div className="flex items-center gap-1.5">
            <dt className="sr-only">Location</dt>
            <MapPin className="h-4 w-4 text-slate-400" aria-hidden />
            <dd>{r.preferredLocation}</dd>
          </div>
          {budget && (
            <div className="flex items-center gap-1.5">
              <dt className="sr-only">Budget</dt>
              <Wallet className="h-4 w-4 text-slate-400" aria-hidden />
              <dd>{budget}</dd>
            </div>
          )}
        </dl>

        <Button asChild variant="secondary" size="sm" className="mt-5 self-start">
          <Link to={`/leads/${r.slug}`} aria-label={`View opportunity: ${r.title}`}>
            View Opportunity
          </Link>
        </Button>
      </m.article>
    </m.li>
  );
}
