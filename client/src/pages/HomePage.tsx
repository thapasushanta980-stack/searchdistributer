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
import { TrendingCategories } from "@/components/layout/TrendingCategories";
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
  { id: "distributors", label: "Find Distributors", short: "Distributors", path: "/distributors", placeholder: "Product, brand or keyword", location: true },
  { id: "products", label: "Find Products", short: "Products", path: "/products", placeholder: "Product or brand name", location: false },
  { id: "brands", label: "Find Brands", short: "Brands", path: "/brands", placeholder: "Brand or manufacturer", location: true },
  { id: "leads", label: "Distributor Leads", short: "Leads", path: "/leads", placeholder: "Requirement or product", location: true },
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
  <Reveal as="section" className="container-page py-8 sm:py-20">
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
      <TrendingCategories />

      {/* Phones show the ads first; from sm up the hero comes first. */}
      <div className="flex flex-col">
      {/* ---------------- Hero ---------------- */}
      <section className="relative isolate overflow-hidden">
        <div className="hero-bg" aria-hidden>
          <div className="hero-grid" />
        </div>
        <div className="mx-auto grid max-w-[1320px] grid-cols-[minmax(0,1fr)] items-center gap-10 px-4 pb-12 pt-8 sm:px-6 lg:grid-cols-[1.4fr_0.6fr] lg:gap-4 lg:pb-16 lg:pt-12">
          <div className="min-w-0">
            <p className="anim-rise hidden items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-primary-dark sm:inline-flex"><span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />The B2B Distribution Network</p>
            <h1 className="anim-rise sr-only sm:not-sr-only sm:mt-4 sm:block text-[2rem] leading-[1.1] tracking-tight sm:text-4xl lg:text-[2.6rem]" style={{ animationDelay: "60ms" }}>
              Find the right distributor.
              <br />
              <span className="text-primary">Grow into new markets.</span>
            </h1>
            <p className="anim-rise mt-3 hidden max-w-lg text-sm leading-relaxed text-body sm:block sm:text-base" style={{ animationDelay: "120ms" }}>
              Search distributors, discover products, explore brands and connect with businesses looking for new distribution opportunities.
            </p>

            <div className="anim-pop relative z-20 mt-0 max-w-[680px] sm:mt-6">
              <div role="tablist" aria-label="What are you looking for?" className="relative mb-3 grid max-w-full grid-cols-4 gap-1 rounded-full sm:inline-flex sm:flex-wrap bg-white/80 p-1 shadow-sm ring-1 ring-line backdrop-blur">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    id={`tab-${t.id}`}
                    aria-selected={tab === t.id}
                    onClick={() => setTab(t.id)}
                    className={cn("min-h-11 min-w-0 whitespace-nowrap rounded-full px-1 text-xs font-semibold transition-colors sm:min-h-0 sm:px-3.5 sm:py-1.5 sm:text-[13px]", tab === t.id ? "bg-ink text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-ink")}
                  >
                    <span className="sm:hidden">{t.short}</span>
                    <span className="hidden sm:inline">{t.label}</span>
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
          </div>
          <div className="hidden lg:block">
            <HeroNetwork />
          </div>
        </div>
      </section>

      {/* ---------------- Advertising: hero promotional banner ---------------- */}
      <div className="container-page order-first space-y-4 pb-4 pt-3 sm:order-none sm:space-y-5 sm:pb-12 sm:pt-0">
        <AdBanner placement="HOME_HERO_BANNER" fallback big />
        <AdSpotlight />
      </div>
      </div>

      {/* ---------------- Business & product showcase ---------------- */}
      <Section>
        <Head
          eyebrow="BUSINESS SHOWCASE"
          title="Businesses and their products, organised by industry."
          text="Choose an industry to see company profiles and the products they publish."
        />
        <Showcase />
      </Section>

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
          <ul className="scrollbar-none relative -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-3 sm:mx-0 sm:grid sm:snap-none sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 mt-6 lg:grid-cols-3 lg:gap-5">
            {leadItems.map((r, i) => (
              <RequirementCard key={r.id} r={r} index={i} className="w-[86%] shrink-0 snap-start sm:w-auto" />
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
