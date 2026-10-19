import { useQuery } from "@tanstack/react-query";
import { Briefcase, MapPin, Send, Wallet, Warehouse } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { REQUIREMENT_KINDS, REQUIREMENT_KIND_LABELS, parseRequirementSearch, requirementQueryString, type HeadSpec, type RequirementKind } from "@sd/shared";
import { Pagination } from "@/components/distributors/states";
import { LazyResponseDialog, preloadResponseDialog } from "@/components/forms/lazy";
import type { ResponseTarget } from "@/components/forms/RequirementResponseDialog";
import { Breadcrumbs } from "@/components/layout/Layout";
import { budgetLabel, RequirementCard } from "@/components/leads/RequirementCard";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/misc";
import { useApi, useSite } from "@/lib/context";
import { useTrackSearch } from "@/lib/track";
import { usePreloadWhenIdle } from "@/lib/lazyClient";
import { categoriesQuery, requirementQuery, requirementsQuery } from "@/lib/queries";
import { useHydrated } from "@/lib/useSearchState";
import { PageHead } from "@/seo/head";
import { abs, breadcrumbLd, paginationCanonical } from "@/seo/builders";
import { CtaBand } from "@/components/home/blocks";
import { NotFoundPage } from "./NotFoundPage";

export function LeadsPage() {
  const api = useApi();
  const site = useSite();
  const hydrated = useHydrated();
  const [sp, setSp] = useSearchParams();
  const params = parseRequirementSearch(sp);
  const { data: categories = [] } = useQuery(categoriesQuery(api));
  const { data, isPending, isError, refetch, isFetching } = useQuery(requirementsQuery(api, params));
  useTrackSearch(
    data && params.page === 1 ? { type: "SEARCH", scope: "leads", query: params.keyword, location: params.location, categorySlug: params.category, resultCount: data.pagination.total } : null,
    !!data && !isFetching,
  );

  const [draft, setDraft] = useState({ keyword: params.keyword ?? "", location: params.location ?? "", category: params.category ?? "", kind: params.kind ?? "", budgetMin: params.budgetMin ? String(params.budgetMin) : "" });
  const key = sp.toString();
  useEffect(() => {
    setDraft({ keyword: params.keyword ?? "", location: params.location ?? "", category: params.category ?? "", kind: params.kind ?? "", budgetMin: params.budgetMin ? String(params.budgetMin) : "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSp(new URLSearchParams(requirementQueryString({ keyword: draft.keyword.trim() || undefined, location: draft.location.trim() || undefined, category: draft.category || undefined, kind: (draft.kind || undefined) as RequirementKind | undefined, budgetMin: Number(draft.budgetMin) || undefined })));
  };
  const refined = Boolean(params.keyword || params.category || params.location || params.kind || params.budgetMin);
  const flat = categories.flatMap((c) => [c, ...c.children]);
  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Distributor Leads", path: "/leads" },
  ];
  const spec: HeadSpec = {
    title: `Distributor Leads${params.page > 1 ? ` – Page ${params.page}` : ""} | Search Distributors`,
    description: "Browse current distributor requirements by product, location, budget and business experience, and send an enquiry to the business.",
    canonical: refined ? abs(site, "/leads") : paginationCanonical(site, "/leads", params.page),
    robots: refined || (data && data.data.length === 0) ? "noindex,follow" : "index,follow",
    jsonLd: [breadcrumbLd(site, crumbs)],
  };

  return (
    <>
      <PageHead spec={spec} site={site} />
      <div className="border-b border-line bg-white">
        <div className="container-page py-10 sm:py-14">
          <Breadcrumbs items={[{ name: "Home", to: "/" }, { name: "Distributor Leads" }]} />
          <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-primary">DISTRIBUTOR LEADS</p>
          <h1 className="mt-3 max-w-3xl text-3xl sm:text-4xl">Find businesses looking for distribution opportunities.</h1>
          <p className="mt-3 max-w-2xl text-lg text-body">Browse current distributor requirements by product, location, budget and business experience.</p>

          <form onSubmit={submit} role="search" aria-label="Search leads" className="mt-8 grid gap-3 rounded-[20px] border border-line bg-white p-4 shadow-panel sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr_0.8fr_auto] lg:items-end">
            <label className="text-sm font-medium text-ink">
              Product / Requirement
              <Input value={draft.keyword} onChange={(e) => setDraft({ ...draft, keyword: e.target.value })} placeholder="e.g. snacks, spare parts" className="mt-1.5" />
            </label>
            <label className="text-sm font-medium text-ink">
              Location
              <Input value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} placeholder="City or region" className="mt-1.5" />
            </label>
            <label className="text-sm font-medium text-ink">
              Category
              <Select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} className="mt-1.5">
                <option value="">All categories</option>
                {flat.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.parentId ? `— ${c.name}` : c.name}
                  </option>
                ))}
              </Select>
            </label>
            <label className="text-sm font-medium text-ink">
              Looking for
              <Select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as RequirementKind | "" })} className="mt-1.5">
                <option value="">Anything</option>
                {REQUIREMENT_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {REQUIREMENT_KIND_LABELS[k]}
                  </option>
                ))}
              </Select>
            </label>
            <label className="text-sm font-medium text-ink">
              Budget at least
              <Input type="number" min={0} inputMode="numeric" value={draft.budgetMin} onChange={(e) => setDraft({ ...draft, budgetMin: e.target.value })} className="mt-1.5" />
            </label>
            <Button type="submit" size="md" className="sm:col-span-2 lg:col-span-1">
              Search Leads
            </Button>
          </form>
        </div>
      </div>

      <div className="container-page py-10">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <p aria-live="polite" className="text-sm text-slate-600">
            {data ? (
              <>
                Showing <strong className="tabular-nums text-ink">{data.pagination.total}</strong> {data.pagination.total === 1 ? "opportunity" : "opportunities"}
              </>
            ) : (
              "Loading opportunities…"
            )}
          </p>
          {refined && (
            <Button variant="ghost" size="sm" onClick={() => setSp(new URLSearchParams())}>
              Clear filters
            </Button>
          )}
        </div>

        {isPending ? (
          <ul aria-busy="true" className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <li key={i}>
                <Skeleton className="h-64 w-full rounded-card" />
              </li>
            ))}
          </ul>
        ) : isError ? (
          <div role="alert" className="rounded-card border border-red-200 bg-red-50/60 p-10 text-center">
            <h2 className="text-lg">Something went wrong.</h2>
            <Button className="mt-4" onClick={() => refetch()}>
              Try Again
            </Button>
          </div>
        ) : data.data.length === 0 ? (
          <div role="status" className="rounded-card border border-dashed border-line-strong bg-surface p-12 text-center">
            <h2 className="text-xl">Nothing found.</h2>
            <p className="mt-2 text-sm text-muted">{refined ? "Try another search or change your filters." : "Opportunities appear here once they are approved."}</p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              {refined && <Button onClick={() => setSp(new URLSearchParams())}>Clear Filters</Button>}
              <Button asChild variant="secondary">
                <Link to="/post-requirement">Post Your Requirement</Link>
              </Button>
            </div>
          </div>
        ) : (
          <>
            <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {data.data.map((r, i) => (
                <RequirementCard key={r.id} r={r} index={i} animate={hydrated} />
              ))}
            </ul>
            <Pagination
              page={data.pagination.page}
              totalPages={data.pagination.totalPages}
              hrefFor={(n) => {
                const qs = requirementQueryString({ ...params, page: n });
                return qs ? `/leads?${qs}` : "/leads";
              }}
            />
          </>
        )}
      </div>
      <CtaBand />
    </>
  );
}

export function LeadDetailPage() {
  const { slug = "" } = useParams();
  const api = useApi();
  const site = useSite();
  const { data: r, isPending, isError, refetch } = useQuery(requirementQuery(api, slug));
  const [target, setTarget] = useState<ResponseTarget | null>(null);
  usePreloadWhenIdle(preloadResponseDialog);

  if (isPending) return <div className="container-page py-12" aria-busy="true"><Skeleton className="h-10 w-2/3" /><Skeleton className="mt-6 h-64 w-full rounded-card" /></div>;
  if (isError)
    return (
      <div className="container-page py-20 text-center" role="alert">
        <h1 className="text-3xl">Something went wrong.</h1>
        <Button className="mt-6" onClick={() => refetch()}>
          Try Again
        </Button>
      </div>
    );
  if (!r) return <NotFoundPage />;

  const budget = budgetLabel(r);
  const respond = () => setTarget({ slug: r.slug, title: r.title });
  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Distributor Leads", path: "/leads" },
    { name: r.title, path: `/leads/${r.slug}` },
  ];
  const spec: HeadSpec = {
    title: `${r.title} | Distributor Lead`.slice(0, 70),
    description: r.summary.slice(0, 158),
    canonical: abs(site, `/leads/${r.slug}`),
    robots: r.isDemo ? "noindex,nofollow" : "index,follow",
    jsonLd: [breadcrumbLd(site, crumbs)],
  };
  const sections: Array<[string, string | null, typeof Briefcase]> = [
    ["Business Experience", r.experience, Briefcase],
    ["Investment Capacity", budget, Wallet],
    ["Warehouse / Infrastructure", r.warehouse, Warehouse],
    ["Preferred Distribution Area", r.distributionArea ?? r.preferredLocation, MapPin],
  ];

  return (
    <>
      <PageHead spec={spec} site={site} />
      <div className="border-b border-line bg-white">
        <div className="container-page py-8 sm:py-10">
          <Breadcrumbs items={[{ name: "Home", to: "/" }, { name: "Distributor Leads", to: "/leads" }, { name: r.title }]} />
          <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-3xl">
              <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
                {r.isNew && <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/15">New</span>}
                {r.isDemo && <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">Demo data</span>}
                <span>{r.poster ?? "Business seeker"}</span>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" aria-hidden /> {r.preferredLocation}
                </span>
              </p>
              <h1 className="mt-2 text-3xl sm:text-4xl">{r.title}</h1>
              <p className="mt-2 text-slate-600">
                Looking for a {REQUIREMENT_KIND_LABELS[r.kind].toLowerCase()}
                {r.category && (
                  <>
                    {" "}
                    in{" "}
                    <Link to={`/categories/${r.category.slug}`} className="font-medium text-primary hover:underline">
                      {r.category.name}
                    </Link>
                  </>
                )}
              </p>
            </div>
            <Button size="lg" className="hidden sm:inline-flex" onClick={respond}>
              <Send className="h-4 w-4" aria-hidden /> Send Enquiry
            </Button>
          </div>
        </div>
      </div>

      <div className="container-page grid gap-6 py-10 pb-28 lg:grid-cols-[minmax(0,1fr)_340px] lg:pb-12">
        <div className="space-y-6">
          <section aria-labelledby="req-h" className="rounded-card border border-line bg-surface p-6 shadow-card">
            <h2 id="req-h" className="text-xl">
              Requirement
            </h2>
            <p className="mt-3 whitespace-pre-line leading-relaxed text-slate-700">{r.description}</p>
            {r.additional && (
              <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
                <p className="font-semibold text-ink">Additional requirements</p>
                <p className="mt-1 whitespace-pre-line">{r.additional}</p>
              </div>
            )}
          </section>
          <section aria-labelledby="det-h" className="rounded-card border border-line bg-surface p-6 shadow-card">
            <h2 id="det-h" className="text-xl">
              Business details
            </h2>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              {sections.map(([label, value, Icon]) => (
                <div key={label} className="flex items-start gap-3">
                  <Icon className="mt-0.5 h-5 w-5 text-slate-400" aria-hidden />
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted">{label}</dt>
                    <dd className="mt-0.5 font-medium text-ink">{value ?? "Not specified"}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </section>
          {r.related.length > 0 && (
            <section aria-labelledby="rel-h">
              <h2 id="rel-h" className="text-xl">
                Related opportunities
              </h2>
              <ul className="mt-4 grid gap-5 md:grid-cols-2">
                {r.related.slice(0, 2).map((x, i) => (
                  <RequirementCard key={x.id} r={x} index={i} />
                ))}
              </ul>
            </section>
          )}
        </div>
        <aside aria-labelledby="contact-h" className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-card border border-line bg-surface p-6 shadow-card">
            <h2 id="contact-h" className="text-xl">
              Contact / Enquiry
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">The poster’s contact details are private. Send an enquiry and they can reply using the details you share.</p>
            <Button size="lg" className="mt-5 w-full" onClick={respond}>
              Send Enquiry
            </Button>
            <p className="mt-3 text-xs text-muted">An enquiry is not a contract or a guarantee of a reply.</p>
          </div>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:hidden">
        <Button size="lg" className="w-full" onClick={respond}>
          <Send className="h-4 w-4" aria-hidden /> Send Enquiry
        </Button>
      </div>
      <LazyResponseDialog target={target} onClose={() => setTarget(null)} />
    </>
  );
}
