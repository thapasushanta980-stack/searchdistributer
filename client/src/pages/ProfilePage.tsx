import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Building2, CalendarDays, ChevronLeft, ChevronRight, Coins, ExternalLink, Globe2, MapPin, MessageSquare, Package, PackageOpen, Send, ShieldCheck, Store } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BUSINESS_TYPE_LABELS, COVERAGE_LABELS, VERIFICATION_LABELS, type HeadSpec, type ProductDTO } from "@sd/shared";
import { CompanyLogo, VerificationBadge } from "@/components/distributors/bits";
import { Breadcrumbs } from "@/components/layout/Layout";
import { LazyEnquiryDialog, preloadEnquiryDialog, type EnquiryTarget } from "@/components/forms/lazy";
import { usePreloadWhenIdle } from "@/lib/lazyClient";
import { Button } from "@/components/ui/button";
import { Badge, Skeleton } from "@/components/ui/misc";
import { useApi, useSite } from "@/lib/context";
import { distributorQuery } from "@/lib/queries";
import { cn, formatInvestment } from "@/lib/utils";
import { PageHead } from "@/seo/head";
import { abs, breadcrumbLd, distributorLd, profileDescription, profileTitle } from "@/seo/builders";
import { DistributorCard } from "@/components/distributors/DistributorCard";

const TABS = [
  { id: "about", label: "About" },
  { id: "products", label: "Products" },
  { id: "areas", label: "Areas" },
  { id: "business", label: "Business Info" },
] as const;

const TILE_TONES = [
  "bg-orange-50 [&_svg]:text-orange-600",
  "bg-blue-50 [&_svg]:text-blue-600",
  "bg-emerald-50 [&_svg]:text-emerald-600",
  "bg-amber-50 [&_svg]:text-amber-600",
  "bg-violet-50 [&_svg]:text-violet-600",
  "bg-rose-50 [&_svg]:text-rose-600",
] as const;

function Section({ id, title, children, className }: { id: string; title: string; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className={cn("scroll-mt-32 rounded-card border border-line bg-surface p-4 shadow-card sm:scroll-mt-36 sm:p-6", className)}>
      <h2 id={`${id}-h`} className="border-l-4 border-primary pl-3 text-lg sm:text-xl">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Swipeable product cards (arrows from sm up). Products have no photos yet, so each card uses a neutral tile. */
function ProductShowcase({ products, onQuote }: { products: ProductDTO[]; onQuote: (p: ProductDTO) => void }) {
  const rail = useRef<HTMLUListElement>(null);
  const scroll = (dir: 1 | -1) => rail.current?.scrollBy({ left: dir * (rail.current.clientWidth * 0.8), behavior: "smooth" });
  return (
    <div>
      <div className={cn("mb-3 hidden justify-end gap-2", products.length > 3 && "sm:flex")}>
        <button type="button" onClick={() => scroll(-1)} aria-label="Previous products" className="flex h-10 w-10 items-center justify-center rounded-full border border-line-strong bg-white text-ink transition-colors hover:border-primary/40 hover:bg-primary-soft">
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </button>
        <button type="button" onClick={() => scroll(1)} aria-label="Next products" className="flex h-10 w-10 items-center justify-center rounded-full border border-line-strong bg-white text-ink transition-colors hover:border-primary/40 hover:bg-primary-soft">
          <ChevronRight className="h-5 w-5" aria-hidden />
        </button>
      </div>
      <ul ref={rail} className="scrollbar-none relative -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-2 sm:mx-0 sm:scroll-px-0 sm:gap-4 sm:px-0">
        {products.map((p) => (
          <li key={p.id} className="flex w-[72%] shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-line bg-white sm:w-60">
            <Link to={`/products/${p.publicSlug}`} className="flex aspect-[4/3] items-center justify-center bg-gradient-to-br from-slate-50 to-primary-soft/70 text-slate-300" aria-hidden tabIndex={-1}>
              <Package className="h-12 w-12" />
            </Link>
            <div className="flex flex-1 flex-col p-3.5">
              <h3 className="line-clamp-2 text-sm font-bold sm:text-base">
                <Link to={`/products/${p.publicSlug}`} className="hover:text-primary">
                  {p.name}
                </Link>
              </h3>
              <p className="mt-1 text-xs text-muted">{[p.packaging, p.priceLabel ?? "Contact for details"].filter(Boolean).join(" · ")}</p>
              <Button variant="secondary" size="sm" className="mt-3 w-full rounded-full" onClick={() => onQuote(p)} aria-label={`Get a quote for ${p.name}`}>
                <MessageSquare className="h-4 w-4" aria-hidden /> Get a Quote
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ProfilePage() {
  const { slug = "" } = useParams();
  const api = useApi();
  const site = useSite();
  const { data: d, isPending, isError, refetch } = useQuery(distributorQuery(api, slug));
  const [target, setTarget] = useState<EnquiryTarget | null>(null);
  usePreloadWhenIdle(preloadEnquiryDialog);
  const [showBar, setShowBar] = useState(false);
  const [active, setActive] = useState("about");
  const loaded = !!d;

  // Phones: the sticky enquiry bar appears once the header card's own button has scrolled away.
  useEffect(() => {
    const onScroll = () => setShowBar(window.scrollY > 320);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Highlight the section tab for whichever section is in view.
  useEffect(() => {
    if (!loaded) return;
    const els = TABS.map((t) => document.getElementById(t.id)).filter((e): e is HTMLElement => !!e);
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (vis) setActive(vis.target.id);
      },
      { rootMargin: "-120px 0px -60% 0px" },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [loaded]);

  if (isPending) {
    return (
      <div className="container-page py-10" aria-busy="true">
        <Skeleton className="h-4 w-56" />
        <div className="mt-8 flex items-center gap-5">
          <Skeleton className="h-20 w-20 rounded-2xl" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        </div>
        <Skeleton className="mt-10 h-48 w-full rounded-card" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="container-page py-20 text-center" role="alert">
        <h1 className="text-3xl">We couldn’t load this profile</h1>
        <p className="mt-3 text-muted">Check your connection and try again.</p>
        <Button className="mt-6" onClick={() => refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  if (!d) {
    const spec: HeadSpec = {
      title: "Profile unavailable | Search Distributors",
      description: "This business profile is not currently available.",
      canonical: abs(site, `/distributors/${slug}`),
      robots: "noindex,follow",
      status: 404,
    };
    return (
      <>
        <PageHead spec={spec} site={site} />
        <div className="container-page py-24 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
            <Store className="h-7 w-7" aria-hidden />
          </span>
          <h1 className="mt-5 text-3xl">This profile is unavailable</h1>
          <p className="mx-auto mt-3 max-w-md text-muted">The business may have paused or ended its listing. You can still search for other distributors.</p>
          <Button asChild className="mt-7">
            <Link to="/distributors">Find distributors</Link>
          </Button>
        </div>
      </>
    );
  }

  const invest = formatInvestment(d.investmentMin, d.investmentMax, d.investmentCurrency);
  const enquire = () => setTarget({ slug: d.slug, name: d.name });
  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Find Distributors", path: "/distributors" },
    ...(d.category ? [{ name: d.category.name, path: `/categories/${d.category.slug}` }] : []),
    { name: d.name, path: `/distributors/${d.slug}` },
  ];
  const spec: HeadSpec = {
    title: profileTitle(d),
    description: profileDescription(d),
    canonical: abs(site, `/distributors/${d.slug}`),
    robots: d.isDemo ? "noindex,nofollow" : "index,follow",
    ogType: "profile",
    ...(d.logoUrl ? { ogImage: d.logoUrl } : {}),
    jsonLd: [breadcrumbLd(site, crumbs), distributorLd(site, d)],
  };

  const facts: Array<{ icon: typeof Building2; label: string; value: React.ReactNode }> = [
    { icon: Building2, label: "Business type", value: BUSINESS_TYPE_LABELS[d.businessType] },
    { icon: Globe2, label: "Coverage", value: COVERAGE_LABELS[d.coverage] },
    ...(d.foundedYear ? [{ icon: CalendarDays, label: "Founded", value: d.foundedYear }] : []),
    ...(invest ? [{ icon: Coins, label: "Investment range", value: invest }] : []),
    ...(d.minimumOrder ? [{ icon: PackageOpen, label: "Minimum order", value: d.minimumOrder }] : []),
    ...(d.verificationStatus !== "NONE" ? [{ icon: ShieldCheck, label: "Verification", value: VERIFICATION_LABELS[d.verificationStatus] }] : []),
  ];

  const tabs = TABS.filter((t) => t.id !== "business" || d.supportOffered || d.website);
  const tabNav = (cls: string) => (
    <nav aria-label="Profile sections" className={cls}>
      <ul className="scrollbar-none relative flex overflow-x-auto px-2">
        {tabs.map((t) => (
          <li key={t.id} className="shrink-0">
            <a
              href={`#${t.id}`}
              aria-current={active === t.id ? "true" : undefined}
              className={cn("flex min-h-11 items-center border-b-2 px-3.5 text-sm font-semibold transition-colors", active === t.id ? "border-primary text-primary-dark" : "border-transparent text-slate-600 hover:text-ink")}
            >
              {t.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );

  return (
    <>
      <PageHead spec={spec} site={site} />
      <div className="border-b border-line bg-white sm:border-0 sm:bg-transparent">
        <div className="container-page py-4 sm:py-5">
          <Breadcrumbs items={[{ name: "Home", to: "/" }, { name: "Find Distributors", to: "/distributors" }, ...(d.category ? [{ name: d.category.name, to: `/categories/${d.category.slug}` }] : []), { name: d.name }]} />
          {/* Phones: compact profile card */}
          <div className="mt-3 rounded-card border border-line bg-surface p-4 shadow-card sm:hidden">
            <div className="flex items-center gap-3">
              <CompanyLogo name={d.name} logoUrl={d.logoUrl} size={56} className="shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <VerificationBadge status={d.verificationStatus} />
                  {d.isFeatured && <Badge tone="accent">Featured</Badge>}
                  {d.isDemo && <Badge>Demo data</Badge>}
                </div>
                <h1 className="mt-1 text-xl leading-snug">{d.name}</h1>
              </div>
            </div>
            <dl className="mt-3 space-y-1.5 border-t border-line pt-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Business type</dt>
                <dd className="text-right font-semibold text-ink">{BUSINESS_TYPE_LABELS[d.businessType]}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Coverage</dt>
                <dd className="text-right font-semibold text-ink">{COVERAGE_LABELS[d.coverage]}</dd>
              </div>
            </dl>
            <p className="mt-3 flex items-start gap-1.5 text-sm text-slate-600">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden /> {d.location}
            </p>
            <Button size="lg" className="mt-4 w-full" onClick={enquire}>
              <Send className="h-4 w-4" aria-hidden /> Send Enquiry
            </Button>
          </div>
        </div>
      </div>

      {/* Phones: key facts as colour tiles + section tabs that follow you down the page */}
      <div className="sm:hidden">
        <div className="container-page pt-4">
          <dl className="grid grid-cols-2 gap-2.5">
            {facts.slice(2).map((f, i, arr) => (
              <div key={f.label} className={cn("flex min-w-0 items-center gap-2.5 rounded-xl p-3", TILE_TONES[i % TILE_TONES.length], arr.length % 2 === 1 && i === arr.length - 1 && "col-span-2")}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
                  <f.icon className="h-[18px] w-[18px]" aria-hidden />
                </span>
                <div className="min-w-0">
                  <dt className="text-xs font-medium text-slate-600">{f.label}</dt>
                  <dd className="break-words text-sm font-bold leading-snug text-ink">{f.value}</dd>
                </div>
              </div>
            ))}
          </dl>
        </div>
        {tabNav("sticky top-14 z-20 mt-4 border-y border-line bg-white/95 backdrop-blur")}
      </div>

      <div className="container-page grid gap-4 py-4 pb-28 sm:gap-6 sm:py-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:pb-12">
        <div className="min-w-0 space-y-4 sm:space-y-6">
          {/* sm+: logo card beside colour fact tiles, then the section tabs */}
          <div className="hidden gap-4 sm:grid sm:grid-cols-[120px_minmax(0,1fr)] lg:grid-cols-[148px_minmax(0,1fr)]">
            <div className="flex items-center justify-center rounded-card border border-line bg-white p-3 shadow-card">
              <CompanyLogo name={d.name} logoUrl={d.logoUrl} size={96} className="rounded-xl" />
            </div>
            <dl className="grid grid-cols-2 gap-3 xl:grid-cols-3">
              {facts.map((f, i) => (
                <div key={f.label} className={cn("flex min-w-0 items-center gap-3 rounded-xl p-3.5", TILE_TONES[i % TILE_TONES.length])}>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
                    <f.icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <dt className="text-xs font-medium text-slate-600">{f.label}</dt>
                    <dd className="break-words text-sm font-bold leading-snug text-ink">{f.value}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </div>
          {tabNav("sticky top-16 lg:top-4 z-20 hidden rounded-card border border-line bg-white/95 shadow-card backdrop-blur sm:block")}

          <Section id="about" title="About Company">
            <p className="whitespace-pre-line leading-relaxed text-slate-700">{d.description}</p>
            {d.specialties.length > 0 && (
              <ul className="mt-5 flex flex-wrap gap-2" aria-label="Specialties">
                {d.specialties.map((s) => (
                  <li key={s} className="rounded-lg bg-slate-100 px-2.5 py-1 text-sm font-medium text-slate-700">
                    {s}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section id="products" title="Product Showcase">
            {d.category && (
              <p className="mb-4 text-sm text-slate-600">
                Category:{" "}
                <Link to={`/categories/${d.category.slug}`} className="font-medium text-primary hover:underline">
                  {d.category.name}
                </Link>
              </p>
            )}
            {d.products.length ? (
              <ProductShowcase products={d.products} onQuote={() => enquire()} />
            ) : (
              <p className="text-sm text-muted">No individual products are published for this business yet.</p>
            )}
          </Section>

          <Section id="areas" title="Distribution Areas">
            {d.territories.length ? (
              <ul className="flex flex-wrap gap-2">
                {d.territories.map((t) => (
                  <li key={t} className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-sm">
                    <MapPin className="h-3.5 w-3.5 text-primary" aria-hidden /> {t}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Distribution areas have not been listed.</p>
            )}
            {d.distributorshipInfo && (
              <div className="mt-5 rounded-xl bg-primary-soft/60 p-4 text-sm text-slate-700">
                <p className="font-semibold text-ink">Distributorship information</p>
                <p className="mt-1">{d.distributorshipInfo}</p>
              </div>
            )}
          </Section>

          <Section id="business" title="Business Information" className={cn(!d.supportOffered && !d.website && "max-sm:hidden")}>
            <dl className="grid gap-4 sm:grid-cols-2">
              {facts.map((f) => (
                <div key={f.label} className="flex items-start gap-3 max-sm:hidden">
                  <f.icon className="mt-0.5 h-5 w-5 text-slate-400" aria-hidden />
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted">{f.label}</dt>
                    <dd className="mt-0.5 font-medium text-ink">{f.value}</dd>
                  </div>
                </div>
              ))}
              {d.supportOffered && (
                <div className="flex items-start gap-3 sm:col-span-2">
                  <ShieldCheck className="mt-0.5 h-5 w-5 text-slate-400" aria-hidden />
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted">Support offered</dt>
                    <dd className="mt-0.5 text-slate-700">{d.supportOffered}</dd>
                  </div>
                </div>
              )}
            </dl>
            {d.website && (
              <a href={d.website} target="_blank" rel="nofollow noopener noreferrer" className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
                Company website <ExternalLink className="h-4 w-4" aria-hidden />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            )}
          </Section>
        </div>

        <aside id="contact" aria-labelledby="contact-h" className="max-sm:order-last sm:order-first lg:sticky lg:top-6 lg:order-none lg:self-start">
          <div className="hidden space-y-4 sm:block">
            <div className="rounded-card border border-line bg-surface p-5 shadow-card">
              {d.category && <p className="text-xs font-semibold uppercase tracking-wide text-primary">{d.category.name}</p>}
              <h1 className="mt-1 text-xl leading-snug lg:text-2xl">{d.name}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <VerificationBadge status={d.verificationStatus} />
                {d.isFeatured && <Badge tone="accent">Featured · Sponsored</Badge>}
                {d.isDemo && <Badge>Demo data</Badge>}
              </div>
              <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Business type</dt>
                  <dd className="text-right font-semibold text-ink">{BUSINESS_TYPE_LABELS[d.businessType]}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Coverage</dt>
                  <dd className="text-right font-semibold text-ink">{COVERAGE_LABELS[d.coverage]}</dd>
                </div>
              </dl>
              <p className="mt-3 flex items-start gap-1.5 text-sm text-slate-600">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden /> {d.location}
              </p>
              <Button size="lg" className="mt-5 w-full" onClick={enquire}>
                <Send className="h-4 w-4" aria-hidden /> Send Enquiry
              </Button>
              <p className="mt-3 text-xs leading-relaxed text-muted">Contact details are shared only when you send an enquiry. An enquiry is not an order or a guarantee of a reply.</p>
            </div>
            {d.category && (
              <div className="rounded-card border border-line bg-surface p-5 shadow-card">
                <h2 className="border-l-4 border-primary pl-3 text-base">{d.category.name} Business Category</h2>
                <Link to={`/categories/${d.category.slug}`} className="mt-3 inline-flex rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary-dark hover:underline">
                  {d.category.name}
                </Link>
              </div>
            )}
          </div>
          <div className="sm:hidden">
          <div className="rounded-card border border-line bg-surface p-6 shadow-card">
            <h2 id="contact-h" className="text-xl">
              Contact / Enquiry
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Contact details are shared only when you send an enquiry. Your message goes to {d.name} after you confirm your email address.
            </p>
            <Button size="lg" className="mt-5 w-full" onClick={enquire}>
              Send Enquiry <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Button>
            <p className="mt-3 text-xs text-muted">An enquiry is not an order or a guarantee of a reply.</p>
          </div>
          </div>
        </aside>
      </div>

      {d.related.length > 0 && (
        <section aria-labelledby="related-h" className="container-page pb-16">
          <h2 id="related-h" className="text-2xl">
            More {d.category?.name} distributors
          </h2>
          <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {d.related.map((r, i) => (
              <DistributorCard key={r.id} d={r} view="grid" index={i} animate={false} onEnquire={(x) => setTarget({ slug: x.slug, name: x.name })} />
            ))}
          </ul>
        </section>
      )}

      {/* Sticky mobile CTA: reserved space above (pb-28) keeps it from covering content. */}
      <div className={cn("fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur transition-transform duration-200 sm:hidden", showBar ? "translate-y-0" : "translate-y-full")} aria-hidden={!showBar}>
        <Button size="lg" className="w-full" onClick={enquire}>
          <Send className="h-4 w-4" aria-hidden /> Send Enquiry
        </Button>
      </div>

      <LazyEnquiryDialog target={target} onClose={() => setTarget(null)} />
    </>
  );
}
