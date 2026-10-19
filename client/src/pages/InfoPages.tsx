import { Link } from "react-router-dom";
import type { HeadSpec, LeadType } from "@sd/shared";
import { Breadcrumbs } from "@/components/layout/Layout";
import { LazyLeadForm } from "@/components/forms/lazy";
import { Button } from "@/components/ui/button";
import { useSite } from "@/lib/context";
import { PageHead } from "@/seo/head";
import { abs, breadcrumbLd } from "@/seo/builders";
import { DISTRIBUTOR_FAQ } from "@/seo/content";
import type { ReactNode } from "react";

function InfoLayout({ path, title, description, h1, intro, children, noindex }: { path: string; title: string; description: string; h1: string; intro?: string; children?: ReactNode; noindex?: boolean }) {
  const site = useSite();
  const spec: HeadSpec = {
    title: `${title} | Search Distributors`,
    description,
    canonical: abs(site, path),
    robots: noindex ? "noindex,follow" : "index,follow",
    jsonLd: [
      breadcrumbLd(site, [
        { name: "Home", path: "/" },
        { name: h1, path },
      ]),
    ],
  };
  return (
    <>
      <PageHead spec={spec} site={site} />
      <div className="container-page max-w-4xl py-10 sm:py-14">
        <Breadcrumbs items={[{ name: "Home", to: "/" }, { name: h1 }]} />
        <h1 className="mt-6 text-3xl sm:text-4xl">{h1}</h1>
        {intro && <p className="mt-3 max-w-2xl text-lg text-slate-600">{intro}</p>}
        <div className="mt-8">{children}</div>
      </div>
    </>
  );
}

const Card = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="rounded-card border border-line bg-surface p-6 shadow-card">
    <h2 className="text-lg">{title}</h2>
    <div className="mt-2 text-sm leading-relaxed text-slate-600">{children}</div>
  </div>
);

export function PricingPage() {
  return (
    <InfoLayout
      path="/pricing"
      title="Pricing"
      description="Searching and sending enquiries is free for distributors and buyers. Brands subscribe monthly or yearly to publish a company profile."
      h1="Pricing"
      intro="Searching for distributors and sending enquiries is free. Brands and manufacturers subscribe to publish a company profile and product portfolio."
    >
      <div className="grid gap-5 md:grid-cols-2">
        <Card title="For distributors and buyers">
          Free. Browse company profiles, compare details and send enquiries without an account.
        </Card>
        <Card title="For brands and manufacturers">
          A subscription with monthly or yearly billing publishes your profile and a limited portfolio of products. Plan prices and product allowances are not published yet and will appear here once confirmed. Payments are reviewed manually, so a subscription is active only after approval.
        </Card>
      </div>
      <Button asChild size="lg" className="mt-8">
        <Link to="/register">Register Your Business</Link>
      </Button>
    </InfoLayout>
  );
}

export function AdvertisingPage() {
  const slots = [
    { name: "Hero promotional banner", where: "Directly below the homepage hero and search", format: "Wide banner, 1200 × 300 (desktop)" },
    { name: "Spotlight cards", where: "Between sections on the homepage", format: "Paired sponsored cards" },
    { name: "Search results banner", where: "Above distributor search results", format: "Wide banner" },
    { name: "Footer promotional banner", where: "Before the footer, dismissible", format: "Full-width call-to-action banner" },
  ];
  const rules = [
    "Every ad is labelled “Sponsored” with the advertiser’s name, so it never looks like an organic result.",
    "An ad goes live only after the creative is approved, payment is verified and the schedule starts. It stops automatically at its end time.",
    "Placements are controlled by our team. We can pause or remove any campaign.",
    "Impressions (at least half the ad visible for one second) and clicks are measured and reported as internal estimates.",
  ];
  return (
    <InfoLayout
      path="/advertising"
      title="Advertising"
      description="Advertise on Search Distributor: clearly labelled, admin-managed placements on the homepage and search results, with measured impressions and clicks."
      h1="Advertising placements"
      intro="Reach distributors and business buyers with structured placements that are always labelled as sponsored."
    >
      <div className="grid gap-5 md:grid-cols-2">
        {slots.map((s) => (
          <Card key={s.name} title={s.name}>
            <p>{s.where}.</p>
            <p className="mt-1 text-xs text-muted">{s.format}</p>
          </Card>
        ))}
      </div>
      <section aria-labelledby="ad-rules" className="mt-10">
        <h2 id="ad-rules" className="text-2xl">
          How advertising works
        </h2>
        <ul className="mt-4 space-y-3">
          {rules.map((r) => (
            <li key={r} className="flex gap-3 text-sm leading-relaxed text-slate-700">
              <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              {r}
            </li>
          ))}
        </ul>
        <p className="mt-6 max-w-2xl text-sm text-muted">Prices, availability and creative specifications are agreed per booking and are not published here. Advertising is arranged with our team for now; self-service booking is planned.</p>
      </section>
      <Button asChild size="lg" className="mt-8">
        <Link to="/contact">Request a placement</Link>
      </Button>
    </InfoLayout>
  );
}

export function HelpPage() {
  return (
    <InfoLayout path="/help" title="Help Center" description="Answers about searching for distributors, verification labels, enquiries and listing your business." h1="Help Center" intro="Short answers to common questions.">
      <div className="divide-y divide-line rounded-card border border-line bg-surface">
        {DISTRIBUTOR_FAQ.map((item) => (
          <div key={item.q} className="px-5 py-5">
            <h2 className="text-base font-semibold">{item.q}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{item.a}</p>
          </div>
        ))}
      </div>
      <p className="mt-6 text-sm text-slate-600">
        Still stuck?{" "}
        <Link to="/contact" className="font-medium text-primary hover:underline">
          Contact us
        </Link>
        .
      </p>
    </InfoLayout>
  );
}

export function LegalPage({ kind }: { kind: "terms" | "privacy" | "cookies" }) {
  const label = kind === "terms" ? "Terms of Service" : kind === "privacy" ? "Privacy Policy" : "Cookie Policy";
  return (
    <InfoLayout path={`/${kind}`} title={label} description={`${label} for Search Distributor.`} h1={label} noindex>
      <div className="rounded-card border border-dashed border-line-strong bg-surface p-8 text-sm leading-relaxed text-slate-600">
        <p>
          The {label.toLowerCase()} is being finalised and will be published here before the marketplace opens to the public. It will cover how enquiry details are shared, how long records are kept and how to request their deletion.
        </p>
        {kind !== "terms" && (
          <p className="mt-3">
            What we do today: we count page views, searches and contact clicks anonymously to improve the marketplace. We set no tracking cookies and store no IP addresses; visits are counted with a code that changes every day, and the records are deleted after about 13 months. Choosing &ldquo;Chat on WhatsApp&rdquo; opens WhatsApp, where WhatsApp&rsquo;s own privacy policy applies.
          </p>
        )}
        <p className="mt-3">
          Questions in the meantime? <Link to="/contact" className="font-medium text-primary hover:underline">Contact us</Link>.
        </p>
      </div>
    </InfoLayout>
  );
}

const LEAD_PAGES: Record<"register" | "contact", { type: LeadType; path: string; title: string; h1: string; intro: string; description: string }> = {
  register: {
    type: "BUSINESS_REGISTRATION",
    path: "/register",
    title: "Register Your Business",
    h1: "Register your business",
    intro: "Tell us about your company. Profiles are reviewed before they are published, and publication depends on an active subscription.",
    description: "Register your brand, manufacturer or distribution business to publish a company profile and receive enquiries from distributors and buyers.",
  },
  contact: {
    type: "CONTACT",
    path: "/contact",
    title: "Contact",
    h1: "Contact us",
    intro: "Questions about listings, enquiries or advertising? Send us a message.",
    description: "Contact Search Distributor about company listings, enquiries or advertising placements.",
  },
};

export function LeadPage({ kind }: { kind: keyof typeof LEAD_PAGES }) {
  const p = LEAD_PAGES[kind];
  return (
    <InfoLayout path={p.path} title={p.title} description={p.description} h1={p.h1} intro={p.intro}>
      <div className="max-w-2xl">
        <LazyLeadForm type={p.type} />
      </div>
    </InfoLayout>
  );
}

export function AboutPage() {
  return (
    <InfoLayout
      path="/about"
      title="About"
      description="Search Distributor connects manufacturers, brands, distributors, wholesalers and business seekers through a structured, searchable B2B marketplace."
      h1="About Search Distributor"
      intro="Search Distributor connects manufacturers, brands, distributors, wholesalers and business seekers through a structured, searchable B2B marketplace."
    >
      <div className="grid gap-5 md:grid-cols-2">
        <Card title="Our promise">We want distributor discovery to be simple, professional and trustworthy. Every listing is reviewed before it is published, and verification labels appear only when a specific check has been completed.</Card>
        <Card title="How it works">Brands and manufacturers publish a company profile and product portfolio. Distributors and buyers search for free, compare profiles and send enquiries directly.</Card>
      </div>
      <Button asChild size="lg" className="mt-8">
        <Link to="/contact">Contact us</Link>
      </Button>
    </InfoLayout>
  );
}

export function LoginPage() {
  return (
    <InfoLayout path="/login" title="Login" description="Brand portal sign-in." h1="Brand portal sign-in" noindex>
      <div className="max-w-xl rounded-card border border-line bg-surface p-7 shadow-card">
        <h2 className="text-lg">Sign-in is not open yet</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Brand accounts are being opened in stages. Register your business and we will contact you when your account is ready. You do not need an account to search for distributors or send an enquiry.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/register">Register Your Business</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link to="/distributors">Find distributors</Link>
          </Button>
        </div>
      </div>
    </InfoLayout>
  );
}
