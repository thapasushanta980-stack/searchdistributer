import { useQuery } from "@tanstack/react-query";
import { MapPin, Package, Send } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { parseProductSearch, type HeadSpec, type ProductListItemDTO } from "@sd/shared";
import { CompanyLogo, VerificationBadge } from "@/components/distributors/bits";
import { Pagination } from "@/components/distributors/states";
import { LazyEnquiryDialog, preloadEnquiryDialog, type EnquiryTarget } from "@/components/forms/lazy";
import { Breadcrumbs } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/misc";
import { useApi, useSite } from "@/lib/context";
import { usePreloadWhenIdle } from "@/lib/lazyClient";
import { categoriesQuery, productQuery, productsQuery } from "@/lib/queries";
import { PageHead } from "@/seo/head";
import { abs, breadcrumbLd, paginationCanonical } from "@/seo/builders";
import { NotFoundPage } from "./NotFoundPage";

export function ProductTile({ p }: { p: ProductListItemDTO }) {
  return (
    <li className="group/p flex min-w-0 flex-col overflow-hidden rounded-card border border-line bg-surface shadow-card transition-[box-shadow,transform,border-color] duration-200 hover:-translate-y-1 hover:border-line-strong hover:shadow-card-hover">
      <div className="flex h-24 items-center justify-center bg-gradient-to-br from-slate-50 to-primary-soft/60 text-slate-300" aria-hidden>
        <Package className="h-10 w-10" />
      </div>
      <div className="flex flex-1 flex-col p-3 sm:p-4">
        {p.category && <p className="text-xs font-semibold uppercase tracking-wide text-primary">{p.category.name}</p>}
        <h3 className="mt-1 line-clamp-2 text-sm sm:text-base">
          <Link to={`/products/${p.publicSlug}`} className="hover:text-primary">
            {p.name}
          </Link>
        </h3>
        <p className="mt-1 truncate text-[13px] text-ink sm:text-sm">{p.distributor.name}</p>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden /> <span className="truncate">{p.distributor.location}</span>
        </p>
        <Link to={`/products/${p.publicSlug}`} className="mt-auto inline-flex min-h-11 items-center pt-2 text-sm font-semibold text-primary hover:underline">
          View Product <span className="sr-only">{p.name}</span>
        </Link>
      </div>
    </li>
  );
}

export function ProductsPage() {
  const api = useApi();
  const site = useSite();
  const [sp, setSp] = useSearchParams();
  const params = parseProductSearch(sp);
  const { data: categories = [] } = useQuery(categoriesQuery(api));
  const { data, isPending, isError, refetch } = useQuery(productsQuery(api, params));
  const [kw, setKw] = useState(params.keyword ?? "");
  const [cat, setCat] = useState(params.category ?? "");
  const key = sp.toString();
  useEffect(() => {
    setKw(params.keyword ?? "");
    setCat(params.category ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const refined = Boolean(params.keyword || params.category);
  const href = (page: number, over?: { keyword?: string; category?: string }) => {
    const q = new URLSearchParams();
    const k = over ? over.keyword : params.keyword;
    const c = over ? over.category : params.category;
    if (k) q.set("keyword", k);
    if (c) q.set("category", c);
    if (page > 1) q.set("page", String(page));
    return q.toString();
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSp(new URLSearchParams(href(1, { keyword: kw.trim() || undefined, category: cat || undefined })));
  };
  const flat = categories.flatMap((c) => [c, ...c.children]);
  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Products", path: "/products" },
  ];
  const spec: HeadSpec = {
    title: `Explore Products${params.page > 1 ? ` – Page ${params.page}` : ""} | Search Distributors`,
    description: "Discover products from brands and manufacturers across industries. Open a company profile and send an enquiry.",
    canonical: refined ? abs(site, "/products") : paginationCanonical(site, "/products", params.page),
    robots: refined || (data && data.data.length === 0) ? "noindex,follow" : "index,follow",
    jsonLd: [breadcrumbLd(site, crumbs)],
  };

  return (
    <>
      <PageHead spec={spec} site={site} />
      <div className="container-page py-10 sm:py-14">
        <Breadcrumbs items={[{ name: "Home", to: "/" }, { name: "Products" }]} />
        <h1 className="mt-6 text-3xl sm:text-4xl">Explore Products</h1>
        <p className="mt-3 max-w-2xl text-lg text-body">Discover products from brands and manufacturers across industries.</p>

        <form onSubmit={submit} role="search" aria-label="Search products" className="mt-8 grid gap-3 rounded-[20px] border border-line bg-white p-4 shadow-panel sm:grid-cols-[1.5fr_1fr_auto] sm:items-end">
          <label className="text-sm font-medium text-ink">
            Search products
            <Input value={kw} onChange={(e) => setKw(e.target.value)} placeholder="Product, brand or company" className="mt-1.5" />
          </label>
          <label className="text-sm font-medium text-ink">
            Category
            <Select value={cat} onChange={(e) => setCat(e.target.value)} className="mt-1.5">
              <option value="">All categories</option>
              {flat.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.parentId ? `— ${c.name}` : c.name}
                </option>
              ))}
            </Select>
          </label>
          <Button type="submit">Search</Button>
        </form>

        {isPending ? (
          <ul aria-busy="true" className="mt-6 grid grid-cols-2 gap-3 sm:mt-8 sm:gap-4 lg:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <li key={i}>
                <Skeleton className="h-64 w-full rounded-card" />
              </li>
            ))}
          </ul>
        ) : isError ? (
          <div role="alert" className="mt-8 rounded-card border border-red-200 bg-red-50/60 p-10 text-center">
            <h2 className="text-lg">Something went wrong.</h2>
            <Button className="mt-4" onClick={() => refetch()}>
              Try Again
            </Button>
          </div>
        ) : data.data.length === 0 ? (
          <div role="status" className="mt-8 rounded-card border border-dashed border-line-strong bg-surface p-12 text-center">
            <h2 className="text-xl">Nothing found.</h2>
            <p className="mt-2 text-sm text-muted">{refined ? "Try another search or change your filters." : "Products appear here once listed businesses publish their portfolios."}</p>
            {refined && (
              <Button className="mt-5" onClick={() => setSp(new URLSearchParams())}>
                Clear Filters
              </Button>
            )}
          </div>
        ) : (
          <>
            <p aria-live="polite" className="mt-8 text-sm text-slate-600">
              Showing <strong className="tabular-nums text-ink">{data.pagination.total}</strong> {data.pagination.total === 1 ? "product" : "products"}
            </p>
            <ul className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              {data.data.map((p) => (
                <ProductTile key={p.id} p={p} />
              ))}
            </ul>
            <Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} hrefFor={(n) => `/products${href(n) ? `?${href(n)}` : ""}`} />
          </>
        )}
      </div>
    </>
  );
}

export function ProductDetailPage() {
  const { slug = "" } = useParams();
  const api = useApi();
  const site = useSite();
  const { data: p, isPending, isError, refetch } = useQuery(productQuery(api, slug));
  const [target, setTarget] = useState<EnquiryTarget | null>(null);
  usePreloadWhenIdle(preloadEnquiryDialog);

  if (isPending) return <div className="container-page py-12" aria-busy="true"><Skeleton className="h-10 w-1/2" /><Skeleton className="mt-6 h-72 w-full rounded-card" /></div>;
  if (isError)
    return (
      <div className="container-page py-20 text-center" role="alert">
        <h1 className="text-3xl">Something went wrong.</h1>
        <Button className="mt-6" onClick={() => refetch()}>
          Try Again
        </Button>
      </div>
    );
  if (!p) return <NotFoundPage />;

  const d = p.distributor;
  const enquire = () => setTarget({ slug: d.slug, name: d.name });
  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Products", path: "/products" },
    ...(p.category ? [{ name: p.category.name, path: `/categories/${p.category.slug}` }] : []),
    { name: p.name, path: `/products/${p.publicSlug}` },
  ];
  const spec: HeadSpec = {
    title: `${p.name} – ${d.name} | Search Distributors`.slice(0, 70),
    description: (p.description ?? `${p.name} from ${d.name}, ${d.location}. View the company profile and send an enquiry.`).slice(0, 158),
    canonical: abs(site, `/products/${p.publicSlug}`),
    robots: d.isDemo ? "noindex,nofollow" : "index,follow",
    jsonLd: [
      breadcrumbLd(site, crumbs),
      {
        "@context": "https://schema.org",
        "@type": "Product",
        name: p.name,
        ...(p.description ? { description: p.description } : {}),
        ...(p.category ? { category: p.category.name } : {}),
        brand: { "@type": "Brand", name: d.name },
        url: abs(site, `/products/${p.publicSlug}`),
      },
    ],
  };

  return (
    <>
      <PageHead spec={spec} site={site} />
      <div className="container-page py-8 sm:py-10">
        <Breadcrumbs items={[{ name: "Home", to: "/" }, { name: "Products", to: "/products" }, ...(p.category ? [{ name: p.category.name, to: `/categories/${p.category.slug}` }] : []), { name: p.name }]} />
        <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-6 pb-24 sm:mt-8 sm:gap-8 lg:grid-cols-[1.1fr_1fr] lg:pb-0">
          <div className="flex aspect-[4/3] items-center justify-center rounded-card border border-line bg-gradient-to-br from-slate-50 to-primary-soft/60 text-slate-300" role="img" aria-label="Product image not provided yet">
            <Package className="h-20 w-20" aria-hidden />
          </div>
          <div>
            {p.category && <p className="text-xs font-semibold uppercase tracking-wide text-primary">{p.category.name}</p>}
            <h1 className="mt-2 text-2xl sm:text-4xl">{p.name}</h1>
            <p className="mt-2 text-slate-600">
              by{" "}
              <Link to={`/distributors/${d.slug}`} className="font-medium text-primary hover:underline">
                {d.name}
              </Link>
            </p>
            {p.description && <p className="mt-5 leading-relaxed text-slate-700">{p.description}</p>}
            <dl className="mt-6 divide-y divide-line rounded-xl border border-line text-sm">
              <div className="grid grid-cols-[104px_minmax(0,1fr)] gap-2 px-4 py-3 sm:grid-cols-[150px_1fr]">
                <dt className="text-muted">Manufacturer / Brand</dt>
                <dd className="font-medium text-ink">{d.name}</dd>
              </div>
              {p.packaging && (
                <div className="grid grid-cols-[104px_minmax(0,1fr)] gap-2 px-4 py-3 sm:grid-cols-[150px_1fr]">
                  <dt className="text-muted">Packaging</dt>
                  <dd className="font-medium text-ink">{p.packaging}</dd>
                </div>
              )}
              <div className="grid grid-cols-[104px_minmax(0,1fr)] gap-2 px-4 py-3 sm:grid-cols-[150px_1fr]">
                <dt className="text-muted">Price</dt>
                <dd className="font-medium text-ink">{p.priceLabel ?? "Contact for details"}</dd>
              </div>
              <div className="grid grid-cols-[104px_minmax(0,1fr)] gap-2 px-4 py-3 sm:grid-cols-[150px_1fr]">
                <dt className="text-muted">Available in</dt>
                <dd className="font-medium text-ink">{d.coverage === "INTERNATIONAL" ? "International" : d.coverage === "NATIONAL" ? "Nationwide" : "Local area"} · {d.location}</dd>
              </div>
            </dl>
            <div className="mt-6 hidden gap-3 sm:flex">
              <Button size="lg" onClick={enquire}>
                <Send className="h-4 w-4" aria-hidden /> Send Enquiry
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link to={`/distributors/${d.slug}`}>View Brand</Link>
              </Button>
            </div>
            <div className="mt-6 flex items-center gap-3 rounded-xl border border-line bg-white p-4">
              <CompanyLogo name={d.name} logoUrl={d.logoUrl} size={44} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-ink">{d.name}</p>
                <p className="text-xs text-muted">{d.location}</p>
              </div>
              <VerificationBadge status={d.verificationStatus} />
            </div>
          </div>
        </div>

        {p.related.length > 0 && (
          <section aria-labelledby="rel-h" className="mt-14">
            <h2 id="rel-h" className="text-2xl">
              Related products
            </h2>
            <ul className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              {p.related.map((r) => (
                <ProductTile key={r.id} p={r} />
              ))}
            </ul>
          </section>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t border-line bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:hidden">
        <Button asChild variant="secondary" size="lg">
          <Link to={`/distributors/${d.slug}`}>View Brand</Link>
        </Button>
        <Button size="lg" className="flex-1" onClick={enquire}>
          <Send className="h-4 w-4" aria-hidden /> Send Enquiry
        </Button>
      </div>
      <LazyEnquiryDialog target={target} onClose={() => setTarget(null)} />
    </>
  );
}
