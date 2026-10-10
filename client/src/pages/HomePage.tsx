import { useQuery } from "@tanstack/react-query";
import { Building2, MapPin, MessageSquare, SlidersHorizontal } from "lucide-react";
import { useCallback, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { parseRequirementSearch, type HeadSpec, type RequirementSearchParams } from "@sd/shared";
import { SearchPanel } from "@/components/distributors/SearchPanel";
import { CtaBand } from "@/components/home/blocks";
import { AdBanner, AdSpotlight } from "@/components/ads/AdSlot";
import { Showcase } from "@/components/home/Showcase";
import { HeroNetwork } from "@/components/home/visuals";
import { RequirementCard } from "@/components/leads/RequirementCard";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { useApi, useSite } from "@/lib/context";
import { categoriesQuery, requirementsQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { PageHead } from "@/seo/head";
import { abs, organizationLd, websiteLd } from "@/seo/builders";

/** Queries shared with the server-side prefetcher in routes.tsx. */
export const HOME_LEADS: RequirementSearchParams = { ...parseRequirementSearch(new URLSearchParams()), page: 1 };

const TABS = [
  { id: "distributors", label: "Find Distributors", path: "/distributors", placeholder: "Search products, brands, distributors or keywords", location: true },
  { id: "products", label: "Find Products", path: "/products", placeholder: "Search products or brands", location: false },
  { id: "brands", label: "Find Brands", path: "/brands", placeholder: "Search brands or manufacturers", location: true },
  { id: "leads", label: "Distributor Leads", path: "/leads", placeholder: "Search requirements or products", location: true },
] as const;

const STEPS = [
  { n: "01", title: "Search", text: "Find distributors, brands, products or opportunities." },
  { n: "02", title: "Explore", text: "Review company profiles, products and requirements." },
  { n: "03", title: "Connect", text: "Send an enquiry to the relevant business." },
  { n: "04", title: "Grow", text: "Build new distribution relationships." },
] as const;

const WHY = [
  { icon: SlidersHorizontal, title: "Structured Discovery", text: "Find businesses through categories, products and locations." },
  { icon: Building2, title: "Business Profiles", text: "Explore meaningful company information before connecting." },
  { icon: MessageSquare, title: "Direct Enquiries", text: "Turn discovery into a structured business enquiry." },
  { icon: MapPin, title: "Growing Network", text: "Discover new distribution opportunities across markets." },
] as const;

function Head({ eyebrow, title, text, action }: { eyebrow: string; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
        <h2 className="mt-3 text-3xl sm:text-4xl">{title}</h2>
        {text && <p className="mt-3 text-base text-body sm:text-lg">{text}</p>}
      </div>
      {action}
    </div>
  );
}

const Section = ({ children }: { children: ReactNode }) => (
  <Reveal as="section" className="container-page py-14 sm:py-20">
    {children}
  </Reveal>
);

export function HomePage() {
  const api = useApi();
  const site = useSite();
  const navigate = useNavigate();
  const { data: categories = [] } = useQuery(categoriesQuery(api));
  const { data: leads } = useQuery(requirementsQuery(api, HOME_LEADS));

  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("distributors");
  const [kw, setKw] = useState("");
  const [loc, setLoc] = useState("");
  const [cat, setCat] = useState("");
  const active = TABS.find((t) => t.id === tab)!;

  const go = useCallback(
    (category = cat) => {
      const q = new URLSearchParams();
      if (kw.trim()) q.set("keyword", kw.trim());
      if (active.location && loc.trim()) q.set("location", loc.trim());
      if (category) q.set("category", category);
      navigate(`${active.path}${q.toString() ? `?${q}` : ""}`);
    },
    [kw, loc, cat, active, navigate],
  );

  const popular = [...categories].filter((c) => c.distributorCount > 0).sort((a, b) => b.distributorCount - a.distributorCount).slice(0, 4);
  const leadItems = (leads?.data ?? []).slice(0, 3);

  const spec: HeadSpec = {
    title: "Search Distributor | Find Distributors & Distribution Opportunities",
    description: "Search Distributor helps businesses discover distributors, products and brands and build new distribution opportunities.",
    canonical: abs(site, "/"),
    robots: "index,follow",
    jsonLd: [organizationLd(site), websiteLd(site)],
  };

  return (
    <>
      <PageHead spec={spec} site={site} />

      {/* ---------------- Hero ---------------- */}
      <section className="relative isolate overflow-hidden">
        <div className="hero-bg" aria-hidden>
          <div className="hero-grid" />
        </div>
        <div className="mx-auto grid max-w-[1320px] items-center gap-10 px-4 pb-16 pt-10 sm:px-6 lg:grid-cols-[1.4fr_0.6fr] lg:gap-4 lg:pb-24 lg:pt-16">
          <div>
            <p className="anim-rise text-xs font-bold uppercase tracking-[0.18em] text-primary">THE B2B DISTRIBUTION NETWORK</p>
            <h1 className="anim-rise mt-4 text-[2.4rem] leading-[1.05] sm:text-5xl lg:text-[3.6rem]" style={{ animationDelay: "60ms" }}>
              Find the right distributor.
              <br />
              <span className="text-primary">Grow into new markets.</span>
            </h1>
            <p className="anim-rise mt-5 max-w-xl text-base text-body sm:text-lg" style={{ animationDelay: "120ms" }}>
              Search distributors, discover products, explore brands and connect with businesses looking for new distribution opportunities.
            </p>

            <div className="anim-pop relative z-20 mt-8 max-w-[820px]">
              <div role="tablist" aria-label="What are you looking for?" className="mb-3 flex flex-wrap gap-1.5">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    id={`tab-${t.id}`}
                    aria-selected={tab === t.id}
                    onClick={() => setTab(t.id)}
                    className={cn("rounded-full px-4 py-2 text-sm font-semibold transition-colors", tab === t.id ? "bg-ink text-white" : "bg-white text-slate-600 ring-1 ring-line-strong hover:text-ink hover:ring-primary/40")}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div role="tabpanel" aria-labelledby={`tab-${tab}`}>
                <SearchPanel
                  keyword={kw}
                  location={loc}
                  onKeywordChange={setKw}
                  onLocationChange={setLoc}
                  onSubmit={() => go()}
                  onPickCategory={(slug) => go(slug)}
                  categories={categories}
                  category={cat}
                  onCategoryChange={setCat}
                  placeholder={active.placeholder}
                />
              </div>
            </div>
            {popular.length > 0 && (
              <div className="mt-5 flex flex-wrap items-center gap-2.5">
                <span className="text-sm font-medium text-muted">Popular:</span>
                {popular.map((c, i) => (
                  <Link key={c.slug} to={`/distributors?category=${c.slug}`} style={{ ["--i" as string]: i }} className="anim-chip rounded-full border border-line-strong bg-white px-3.5 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-[border-color,color,background-color,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:bg-primary-soft hover:text-primary-dark">
                    {c.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div className="hidden lg:block">
            <HeroNetwork />
          </div>
        </div>
      </section>

      {/* ---------------- Advertising: hero promotional banner ---------------- */}
      <div className="container-page space-y-5 pb-12">
        <AdBanner placement="HOME_HERO_BANNER" fallback big />
        <AdSpotlight />
      </div>

      {/* ---------------- Latest opportunities ---------------- */}
      <Section>
        <Head
          eyebrow="LATEST OPPORTUNITIES"
          title="Businesses looking for distributors"
          text="Discover current distribution opportunities from brands and manufacturers."
          action={
            <Button asChild variant="secondary">
              <Link to="/leads">View All Opportunities</Link>
            </Button>
          }
        />
        {leadItems.length > 0 ? (
          <ul className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {leadItems.map((r, i) => (
              <RequirementCard key={r.id} r={r} index={i} />
            ))}
          </ul>
        ) : (
          <p className="mt-8 rounded-card border border-dashed border-line-strong bg-surface p-8 text-center text-sm text-muted">
            Opportunities appear here once they are approved.{" "}
            <Link to="/post-requirement" className="font-semibold text-primary hover:underline">
              Post the first requirement
            </Link>
          </p>
        )}
      </Section>

      {/* ---------------- Business & product showcase ---------------- */}
      <Section>
        <Head
          eyebrow="BUSINESS SHOWCASE"
          title="Businesses and their products, organised by industry."
          text="Choose an industry to see company profiles and the products they publish."
        />
        <Showcase />
      </Section>

      {/* ---------------- Industries ---------------- */}
      {categories.length > 0 && (
        <Section>
          <Head eyebrow="EXPLORE INDUSTRIES" title="Find opportunities across every major industry." text="Browse distributors, products and brands by industry." />
          <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {categories.map((c) => (
              <li key={c.slug}>
                <Link to={`/categories/${c.slug}`} className="group flex h-full items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3.5 shadow-card transition-[box-shadow,transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-card-hover">
                  <span className="text-sm font-semibold text-ink">{c.name}</span>
                  <span className="text-xs tabular-nums text-muted">{c.distributorCount}</span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-8">
            <Button asChild variant="secondary" size="lg">
              <Link to="/categories">Browse All Industries</Link>
            </Button>
          </div>
        </Section>
      )}

      {/* ---------------- How it works ---------------- */}
      <Section>
        <Head eyebrow="HOW SEARCH DISTRIBUTOR WORKS" title="From search to business connection." />
        <ol className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <li key={s.n} className="rounded-card border border-line bg-surface p-6 shadow-card">
              <span className="font-display text-3xl font-extrabold text-primary/30">{s.n}</span>
              <h3 className="mt-3 text-lg">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{s.text}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* ---------------- Why ---------------- */}
      <Section>
        <Head eyebrow="WHY SEARCH DISTRIBUTOR" title="Built to make B2B discovery easier." />
        <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {WHY.map((w) => (
            <li key={w.title} className="flex gap-4 rounded-card border border-line bg-surface p-6 shadow-card">
              <w.icon className="mt-0.5 h-6 w-6 shrink-0 text-primary" aria-hidden />
              <div>
                <h3 className="text-base">{w.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{w.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <CtaBand />
      <AdBanner placement="HOME_FOOTER_BANNER" dismissible className="container-page pb-12" />
    </>
  );
}
