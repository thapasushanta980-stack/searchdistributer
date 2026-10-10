import { useQuery } from "@tanstack/react-query";
import { m } from "framer-motion";
import { ArrowRight, BadgeCheck, MapPin } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { BUSINESS_TYPE_LABELS, parseSearch, type DistributorCardDTO, type DistributorSearchParams, type ProductSearchParams } from "@sd/shared";
import { LazyEnquiryDialog, preloadEnquiryDialog, type EnquiryTarget } from "@/components/forms/lazy";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { useApi } from "@/lib/context";
import { usePreloadWhenIdle } from "@/lib/lazyClient";
import { categoriesQuery, distributorsQuery, productsQuery } from "@/lib/queries";
import { cn, initials } from "@/lib/utils";
import { ProductTile } from "@/pages/ProductPages";

const MAX_TABS = 6;

/** Default (all industries) queries, shared with the server-side prefetcher. */
export const SHOWCASE_COMPANIES: DistributorSearchParams = parseSearch(new URLSearchParams("limit=8"));
export const SHOWCASE_PRODUCTS: ProductSearchParams = { page: 1 };

/** Compact, logo-led company tile: logo panel with category chip, name, location, two actions. */
function ShowcaseCard({ d, onEnquire }: { d: DistributorCardDTO; onEnquire: (d: DistributorCardDTO) => void }) {
  return (
    <li className="min-w-0 list-none">
      <m.article
        whileHover={{ y: -3 }}
        transition={{ type: "spring", stiffness: 420, damping: 30 }}
        aria-labelledby={`sc-${d.id}`}
        className="flex h-full flex-col rounded-card border border-line bg-surface p-3.5 shadow-card transition-[box-shadow,border-color] duration-200 hover:border-line-strong hover:shadow-card-hover"
      >
        <div className="relative flex h-28 items-center justify-center overflow-hidden rounded-xl border border-line bg-white">
          {d.logoUrl ? (
            <img src={d.logoUrl} alt={`${d.name} logo`} width={160} height={80} loading="lazy" decoding="async" className="h-full w-full object-contain p-3" />
          ) : (
            <span aria-hidden className="font-display text-3xl font-extrabold tracking-tight text-primary/70">
              {initials(d.name)}
            </span>
          )}
          <span className="absolute left-2 top-2 max-w-[70%] truncate rounded bg-night px-2 py-0.5 text-[10px] font-semibold text-white">{d.category?.name ?? BUSINESS_TYPE_LABELS[d.businessType]}</span>
          {d.verificationStatus === "VERIFIED" && (
            <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-green-50 text-success" title="Verified business">
              <BadgeCheck className="h-4 w-4" aria-hidden />
              <span className="sr-only">Verified business</span>
            </span>
          )}
        </div>

        <h3 id={`sc-${d.id}`} className="mt-3 truncate font-sans text-[15px] font-bold tracking-tight">
          <Link to={`/distributors/${d.slug}`} className="rounded hover:text-primary" title={d.name}>
            {d.name}
          </Link>
        </h3>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-600">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
          <span className="truncate">{d.location}</span>
        </p>

        <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
          <Button asChild variant="secondary" size="sm" className="px-2">
            <Link to={`/distributors/${d.slug}`}>
              View Profile<span className="sr-only"> of {d.name}</span>
            </Link>
          </Button>
          <Button size="sm" className="px-2" onClick={() => onEnquire(d)} aria-label={`Send enquiry to ${d.name}`}>
            Send Enquiry
          </Button>
        </div>
      </m.article>
    </li>
  );
}

/** Industry-tabbed showcase of real company profiles and their products. */
export function Showcase() {
  const api = useApi();
  const { data: tree = [] } = useQuery(categoriesQuery(api));
  const [cat, setCat] = useState<string | null>(null);
  const [enquiry, setEnquiry] = useState<EnquiryTarget | null>(null);
  usePreloadWhenIdle(preloadEnquiryDialog);

  const tabs = tree.filter((c) => c.distributorCount > 0).sort((a, b) => b.distributorCount - a.distributorCount).slice(0, MAX_TABS);
  const current = tabs.find((t) => t.slug === cat) ?? null;
  const slug = current?.slug;

  const companies = useQuery(distributorsQuery(api, slug ? { ...SHOWCASE_COMPANIES, category: [slug] } : SHOWCASE_COMPANIES));
  const products = useQuery(productsQuery(api, slug ? { page: 1, category: slug } : SHOWCASE_PRODUCTS));
  const productItems = (products.data?.data ?? []).slice(0, 4);
  const label = current?.name ?? "all industries";

  return (
    <>
      {tabs.length > 0 && (
        <div role="tablist" aria-label="Industry" className="scrollbar-none -mx-4 mt-8 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          {[{ slug: null as string | null, name: "All industries", distributorCount: 0 }, ...tabs].map((t) => {
            const on = (t.slug ?? null) === (slug ?? null);
            return (
              <button
                key={t.slug ?? "all"}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setCat(t.slug)}
                className={cn("shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors", on ? "bg-ink text-white" : "bg-white text-slate-600 ring-1 ring-line-strong hover:text-ink hover:ring-primary/40")}
              >
                {t.name}
                {t.slug && <span className={cn("ml-1.5 text-xs tabular-nums", on ? "text-white/70" : "text-muted")}>{t.distributorCount}</span>}
              </button>
            );
          })}
        </div>
      )}

      <div role="tabpanel" aria-live="polite" className="mt-6">
        {companies.isPending ? (
          <ul aria-busy="true" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <li key={i}>
                <Skeleton className="h-60 w-full rounded-card" />
              </li>
            ))}
          </ul>
        ) : companies.data && companies.data.data.length > 0 ? (
          <ul className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-4", companies.isPlaceholderData && "opacity-60 transition-opacity")}>
            {companies.data.data.map((d) => (
              <ShowcaseCard key={d.id} d={d} onEnquire={(x) => setEnquiry({ slug: x.slug, name: x.name })} />
            ))}
          </ul>
        ) : (
          <p className="rounded-card border border-dashed border-line-strong bg-surface p-8 text-center text-sm text-muted">Company profiles appear here as businesses are approved and published.</p>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button asChild variant="secondary" size="lg">
            <Link to={slug ? `/categories/${slug}` : "/distributors"}>
              View all companies <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
          {companies.data && companies.data.pagination.total > 0 && (
            <span className="text-sm text-muted">
              Showing {companies.data.data.length} of {companies.data.pagination.total} in {label}
            </span>
          )}
        </div>
      </div>

      {productItems.length > 0 && (
        <div className="mt-12">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h3 className="text-xl sm:text-2xl">Products in {label}</h3>
            <Link to={slug ? `/products?category=${slug}` : "/products"} className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
              View all products <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
          <ul className={cn("mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4", products.isPlaceholderData && "opacity-60 transition-opacity")}>
            {productItems.map((p) => (
              <ProductTile key={p.id} p={p} />
            ))}
          </ul>
        </div>
      )}

      <LazyEnquiryDialog target={enquiry} onClose={() => setEnquiry(null)} />
    </>
  );
}
