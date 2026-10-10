import { useQuery } from "@tanstack/react-query";
import { m } from "framer-motion";
import { ArrowRight, Building2, CalendarDays, Coins, ExternalLink, Globe2, MapPin, PackageOpen, Send, ShieldCheck, Store } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BUSINESS_TYPE_LABELS, COVERAGE_LABELS, VERIFICATION_LABELS, type HeadSpec } from "@sd/shared";
import { CompanyLogo, VerificationBadge } from "@/components/distributors/bits";
import { Breadcrumbs } from "@/components/layout/Layout";
import { LazyEnquiryDialog, preloadEnquiryDialog, type EnquiryTarget } from "@/components/forms/lazy";
import { usePreloadWhenIdle } from "@/lib/lazyClient";
import { Button } from "@/components/ui/button";
import { Badge, Skeleton } from "@/components/ui/misc";
import { useApi, useSite } from "@/lib/context";
import { distributorQuery } from "@/lib/queries";
import { formatInvestment } from "@/lib/utils";
import { PageHead } from "@/seo/head";
import { abs, breadcrumbLd, distributorLd, profileDescription, profileTitle } from "@/seo/builders";
import { DistributorCard } from "@/components/distributors/DistributorCard";

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-24 rounded-card border border-line bg-surface p-6 shadow-card">
      <h2 id={`${id}-h`} className="text-xl">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function ProfilePage() {
  const { slug = "" } = useParams();
  const api = useApi();
  const site = useSite();
  const { data: d, isPending, isError, refetch } = useQuery(distributorQuery(api, slug));
  const [target, setTarget] = useState<EnquiryTarget | null>(null);
  usePreloadWhenIdle(preloadEnquiryDialog);

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

  return (
    <>
      <PageHead spec={spec} site={site} />
      <div className="border-b border-line bg-white">
        <div className="container-page py-8 sm:py-10">
          <Breadcrumbs items={[{ name: "Home", to: "/" }, { name: "Find Distributors", to: "/distributors" }, ...(d.category ? [{ name: d.category.name, to: `/categories/${d.category.slug}` }] : []), { name: d.name }]} />
          <m.div initial={false} className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-center">
            <CompanyLogo name={d.name} logoUrl={d.logoUrl} size={88} className="rounded-2xl" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <VerificationBadge status={d.verificationStatus} />
                {d.isFeatured && <Badge tone="accent">Featured · Sponsored</Badge>}
                {d.isDemo && <Badge>Demo data</Badge>}
              </div>
              <h1 className="mt-2 text-3xl sm:text-4xl">{d.name}</h1>
              <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-slate-400" aria-hidden /> {d.location}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Building2 className="h-4 w-4 text-slate-400" aria-hidden /> {BUSINESS_TYPE_LABELS[d.businessType]}
                </span>
              </p>
            </div>
            <Button size="lg" className="hidden sm:inline-flex" onClick={enquire}>
              <Send className="h-4 w-4" aria-hidden /> Send Enquiry
            </Button>
          </m.div>
        </div>
      </div>

      <div className="container-page grid gap-6 py-10 pb-28 lg:grid-cols-[minmax(0,1fr)_340px] lg:pb-12">
        <div className="space-y-6">
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

          <Section id="products" title="Products & Categories">
            {d.category && (
              <p className="mb-4 text-sm text-slate-600">
                Category:{" "}
                <Link to={`/categories/${d.category.slug}`} className="font-medium text-primary hover:underline">
                  {d.category.name}
                </Link>
              </p>
            )}
            {d.products.length ? (
              <ul className="grid gap-3 sm:grid-cols-2">
                {d.products.map((p) => (
                  <li key={p.id} className="rounded-xl border border-line p-4">
                    <h3 className="text-base">
                      <Link to={`/products/${p.publicSlug}`} className="hover:text-primary">
                        {p.name}
                      </Link>
                    </h3>
                    {p.description && <p className="mt-1 text-sm text-muted">{p.description}</p>}
                    <dl className="mt-2 space-y-0.5 text-sm text-slate-600">
                      {p.packaging && (
                        <div className="flex gap-1.5">
                          <dt className="text-muted">Packaging:</dt>
                          <dd>{p.packaging}</dd>
                        </div>
                      )}
                      <div className="flex gap-1.5">
                        <dt className="text-muted">Price:</dt>
                        <dd>{p.priceLabel ?? "Contact for details"}</dd>
                      </div>
                    </dl>
                  </li>
                ))}
              </ul>
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

          <Section id="business" title="Business Information">
            <dl className="grid gap-4 sm:grid-cols-2">
              {facts.map((f) => (
                <div key={f.label} className="flex items-start gap-3">
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

        <aside id="contact" aria-labelledby="contact-h" className="lg:sticky lg:top-24 lg:self-start">
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
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:hidden">
        <Button size="lg" className="w-full" onClick={enquire}>
          <Send className="h-4 w-4" aria-hidden /> Send Enquiry
        </Button>
      </div>

      <LazyEnquiryDialog target={target} onClose={() => setTarget(null)} />
    </>
  );
}
