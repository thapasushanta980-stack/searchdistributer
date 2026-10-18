import { m } from "framer-motion";
import { ArrowRight, Building2, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { BUSINESS_TYPE_LABELS, type DistributorCardDTO } from "@sd/shared";
import { Button } from "@/components/ui/button";
import { Badge, Skeleton } from "@/components/ui/misc";
import { cn } from "@/lib/utils";
import { CompanyLogo, FavoriteButton, VerificationBadge } from "./bits";

interface Props {
  d: DistributorCardDTO;
  view: "grid" | "list";
  index: number;
  /** False for server-rendered / first paint so content is never hidden before hydration. */
  animate: boolean;
  onEnquire: (d: DistributorCardDTO) => void;
}

export function DistributorCard({ d, view, index, animate, onEnquire }: Props) {
  const list = view === "list";
  return (
    <m.li
      initial={animate ? { opacity: 0, y: 18 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: Math.min(index, 8) * 0.045, ease: [0.22, 1, 0.36, 1] }}
      className="list-none"
    >
      <m.article
        whileHover={{ y: -4 }}
        transition={{ type: "spring", stiffness: 420, damping: 30 }}
        aria-labelledby={`dist-${d.id}`}
        className={cn(
          "group/card flex h-full flex-col rounded-card border border-line bg-surface p-4 shadow-card transition-[box-shadow,border-color] duration-200 sm:p-5 hover:border-line-strong hover:shadow-card-hover",
          list && "md:flex-row md:items-stretch md:gap-6",
        )}
      >
        <div className={cn("flex min-w-0 flex-1 flex-col", list && "md:flex-row md:gap-5")}>
          <div className={cn("flex items-start justify-between gap-3", list && "md:flex-col md:items-start md:justify-start")}>
            <CompanyLogo name={d.name} logoUrl={d.logoUrl} size={list ? 64 : 48} />
            <div className={cn("flex items-center gap-1.5", list && "md:hidden")}>
              <VerificationBadge status={d.verificationStatus} />
              <FavoriteButton id={d.id} name={d.name} />
            </div>
          </div>

          <div className="mt-3 flex min-w-0 flex-1 flex-col sm:mt-4">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {d.category && (
                <Link to={`/categories/${d.category.slug}`} className="text-xs font-semibold uppercase tracking-wide text-primary hover:underline">
                  {d.category.name}
                </Link>
              )}
              {d.isFeatured && (
                <Badge tone="accent" className="py-px">
                  Featured · Sponsored
                </Badge>
              )}
              {d.isDemo && <Badge className="py-px">Demo data</Badge>}
            </div>

            <h3 id={`dist-${d.id}`} className="mt-1 text-base sm:mt-1.5 sm:text-lg">
              <Link to={`/distributors/${d.slug}`} className="rounded transition-colors hover:text-primary">
                {d.name}
              </Link>
            </h3>

            <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-muted sm:mt-2 sm:line-clamp-3 sm:text-sm">{d.summary}</p>

            <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-slate-600 sm:mt-3.5 sm:text-sm">
              <div className="flex items-center gap-1.5">
                <dt className="sr-only">Location</dt>
                <MapPin className="h-4 w-4 text-slate-400" aria-hidden />
                <dd>{d.location}</dd>
              </div>
              <div className="flex items-center gap-1.5">
                <dt className="sr-only">Business type</dt>
                <Building2 className="h-4 w-4 text-slate-400" aria-hidden />
                <dd>{BUSINESS_TYPE_LABELS[d.businessType]}</dd>
              </div>
            </dl>

            {d.specialties.length > 0 && (
              <ul className="mt-3.5 hidden flex-wrap gap-1.5 sm:flex" aria-label="Specialties">
                {d.specialties.slice(0, 2).map((s) => (
                  <li key={s} className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                    {s}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className={cn("mt-4 flex flex-col gap-3 sm:mt-5", list && "md:mt-0 md:w-48 md:shrink-0 md:justify-between md:border-l md:border-line md:pl-6")}>
          {list && (
            <div className="hidden items-center justify-end gap-1.5 md:flex">
              <VerificationBadge status={d.verificationStatus} />
              <FavoriteButton id={d.id} name={d.name} />
            </div>
          )}
          <div className={cn("grid grid-cols-2 gap-2", list && "md:grid-cols-1")}>
            <Button asChild variant="secondary" size="sm">
              <Link to={`/distributors/${d.slug}`} aria-label={`View profile of ${d.name}`}>
                View Profile
              </Link>
            </Button>
            <Button size="sm" onClick={() => onEnquire(d)} aria-label={`Send enquiry to ${d.name}`}>
              Send Enquiry
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
            </Button>
          </div>
        </div>
      </m.article>
    </m.li>
  );
}

export function DistributorCardSkeleton({ view }: { view: "grid" | "list" }) {
  return (
    <li className="list-none">
      <div className={cn("flex h-full flex-col rounded-card border border-line bg-surface p-5", view === "list" && "md:flex-row md:gap-6")}>
        <div className="flex-1">
          <div className="flex items-start justify-between">
            <Skeleton className="h-12 w-12 rounded-xl" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
          <Skeleton className="mt-4 h-3 w-24" />
          <Skeleton className="mt-2.5 h-5 w-3/4" />
          <Skeleton className="mt-3 h-3.5 w-full" />
          <Skeleton className="mt-2 h-3.5 w-full" />
          <Skeleton className="mt-2 h-3.5 w-2/3" />
          <div className="mt-4 flex gap-2">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-24" />
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2 md:w-48 md:grid-cols-1">
          <Skeleton className="h-9 rounded-button" />
          <Skeleton className="h-9 rounded-button" />
        </div>
      </div>
    </li>
  );
}
