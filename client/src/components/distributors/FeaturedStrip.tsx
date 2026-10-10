import { ArrowUpRight, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import type { DistributorCardDTO } from "@sd/shared";
import { Badge } from "@/components/ui/misc";
import { CompanyLogo, VerificationBadge } from "./bits";

/** Admin-managed placements. Renders nothing when there are none; never padded with invented entries. */
export function FeaturedStrip({ items }: { items: DistributorCardDTO[] }) {
  if (!items.length) return null;
  return (
    <section aria-labelledby="featured-title" className="mb-8">
      <div className="mb-3 flex items-center gap-2.5">
        <Badge tone="dark" className="tracking-wider">
          FEATURED
        </Badge>
        <h2 id="featured-title" className="text-base font-semibold sm:text-lg">
          Featured distributor opportunities
        </h2>
        <span className="text-xs text-muted">Sponsored</span>
      </div>
      <ul className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0">
        {items.map((d) => (
          <li key={d.id} className="w-[82%] shrink-0 snap-start sm:w-auto">
            <Link
              to={`/distributors/${d.slug}`}
              className="group/card flex h-full items-center gap-4 rounded-card border border-indigo-200/70 bg-gradient-to-br from-white to-primary-soft/60 p-4 transition-[box-shadow,transform,border-color] duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-card-hover"
            >
              <CompanyLogo name={d.name} logoUrl={d.logoUrl} size={52} />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="truncate font-display text-[15px] font-bold tracking-tight">{d.name}</span>
                  <VerificationBadge status={d.verificationStatus} />
                </span>
                <span className="mt-0.5 block truncate text-sm text-muted">{d.category?.name}</span>
                <span className="mt-1 flex items-center gap-1 text-xs text-slate-600">
                  <MapPin className="h-3.5 w-3.5" aria-hidden /> {d.location}
                </span>
              </span>
              <ArrowUpRight className="h-5 w-5 shrink-0 text-primary transition-transform duration-200 group-hover/card:-translate-y-0.5 group-hover/card:translate-x-0.5" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
