import { useQuery } from "@tanstack/react-query";
import { Building2, MapPin, MessageSquare, SlidersHorizontal } from "lucide-react";
import { useCallback, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { parseRequirementSearch, type HeadSpec, type RequirementSearchParams } from "@sd/shared";
import { SearchPanel } from "@/components/distributors/SearchPanel";
import { CtaBand } from "@/components/home/blocks";
import { HowItWorks } from "@/components/home/HowItWorks";
import { AdBanner, AdSpotlight } from "@/components/ads/AdSlot";
import { Showcase } from "@/components/home/Showcase";
import { TrendingCategories } from "@/components/layout/TrendingCategories";
import { RequirementCard } from "@/components/leads/RequirementCard";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { useApi, useSite } from "@/lib/context";
import { categoriesQuery, requirementsQuery } from "@/lib/queries";
import { PageHead } from "@/seo/head";
import { abs, organizationLd, websiteLd } from "@/seo/builders";

/** Queries shared with the server-side prefetcher in routes.tsx. */
export const HOME_LEADS: RequirementSearchParams = { ...parseRequirementSearch(new URLSearchParams()), page: 1 };

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

  const [kw, setKw] = useState("");
  const [loc, setLoc] = useState("");
  const listed = categories.reduce((n, c) => n + c.distributorCount, 0);
  const industries = categories.filter((c) => c.distributorCount > 0).length;

  const go = useCallback(
    (category?: string) => {
      const q = new URLSearchParams();
      if (kw.trim()) q.set("keyword", kw.trim());
      if (loc.trim()) q.set("location", loc.trim());
      if (category) q.set("category", category);
      navigate(`/distributors${q.toString() ? `?${q}` : ""}`);
    },
    [kw, loc, navigate],
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
      {/* Desktop shows the categories in the sidebar. */}
      <div className="lg:hidden">
        <TrendingCategories />
      </div>

      {/* ---------------- Hero: headline, search, then the promotional banners ---------------- */}
      <section className="relative isolate">
        <div className="hero-bg" aria-hidden />
        <div className="container-page pb-5 pt-6 text-center sm:pb-6 sm:pt-9 lg:pt-10">
          <h1 className="anim-rise mx-auto max-w-2xl text-[1.7rem] leading-[1.15] tracking-tight sm:text-[2.2rem] lg:text-[2.6rem]">
            Connecting <span className="text-primary">Right</span> Distributors
            <br className="hidden sm:block" /> to <span className="text-primary">Right</span> Businesses
          </h1>
          <div className="anim-pop relative z-20 mx-auto mt-5 max-w-[560px] text-left sm:mt-6">
            <SearchPanel
              keyword={kw}
              location={loc}
              onKeywordChange={setKw}
              onLocationChange={setLoc}
              onSubmit={() => go()}
              onPickCategory={(slug) => go(slug)}
              placeholder="Search products, brands, distributors"
            />
          </div>
          <p className="anim-rise mt-3 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-xs text-body sm:text-sm" style={{ animationDelay: "200ms" }}>
            {listed > 0 && (
              <>
                <span className="h-2 w-2 rounded-full bg-success" aria-hidden />
                {listed.toLocaleString("en")} {listed === 1 ? "business is" : "businesses are"} listed across {industries} {industries === 1 ? "industry" : "industries"}.
              </>
            )}
            <Link to="/categories" className="font-semibold text-primary hover:underline">
              Browse All Industries
            </Link>
          </p>
        </div>

        <div className="container-page space-y-6 pb-5 sm:space-y-7 sm:pb-12">
          <AdBanner placement="HOME_HERO_BANNER" fallback big />
          <AdSpotlight fallback />
        </div>
      </section>

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

      {/* ---------------- How it works ---------------- */}
      <Section>
        <Head eyebrow="HOW IT WORKS" title="From first search to appointed distributor." text="Whether you make products or want to distribute them, the path is short and you talk to each other directly." />
        <HowItWorks />
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
