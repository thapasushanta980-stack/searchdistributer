import { Mail } from "lucide-react";
import { Link } from "react-router-dom";
import { Reveal } from "@/components/ui/reveal";
import { useSite } from "@/lib/context";
import { Logo } from "./SiteHeader";

const COLUMNS = [
  {
    title: "Discover",
    links: [
      { label: "Find Distributors", to: "/distributors" },
      { label: "Distributor Leads", to: "/leads" },
      { label: "Products", to: "/products" },
      { label: "Brands", to: "/brands" },
      { label: "Categories", to: "/categories" },
    ],
  },
  {
    title: "Business",
    links: [
      { label: "Register Business", to: "/register" },
      { label: "Pricing", to: "/pricing" },
      { label: "Advertising", to: "/advertising" },
      { label: "Post Requirement", to: "/post-requirement" },
      { label: "Login", to: "/login" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", to: "/about" },
      { label: "Contact", to: "/contact" },
      { label: "FAQ", to: "/help" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms", to: "/terms" },
      { label: "Privacy", to: "/privacy" },
      { label: "Cookie Policy", to: "/cookies" },
    ],
  },
] as const;

export function SiteFooter() {
  const site = useSite();
  return (
    <Reveal as="footer" className="border-t border-line bg-white">
      <div className="container-page grid grid-cols-2 gap-x-6 gap-y-8 py-9 sm:grid-cols-4 md:grid-cols-[1.4fr_repeat(4,1fr)] md:gap-10 md:py-12">
        <div className="col-span-2 max-w-xs sm:col-span-4 md:col-span-1">
          <Logo />
          <p className="mt-4 text-sm leading-relaxed text-muted">
            Find the right distributor. Grow your business.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h2 className="font-sans text-sm font-semibold tracking-normal text-ink">{col.title}</h2>
            <ul className="mt-1 md:mt-4 md:space-y-2.5">
              {col.links.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="inline-flex min-h-11 items-center text-sm text-muted transition-colors hover:text-primary md:min-h-0">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="container-page flex flex-col gap-3 py-5 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {site.siteName}. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {site.supportEmail ? (
              <a href={`mailto:${site.supportEmail}`} className="inline-flex min-h-11 items-center gap-1.5 hover:text-primary sm:min-h-0">
                <Mail className="h-4 w-4" aria-hidden /> {site.supportEmail}
              </a>
            ) : (
              <Link to="/contact" className="inline-flex min-h-11 items-center gap-1.5 hover:text-primary sm:min-h-0">
                <Mail className="h-4 w-4" aria-hidden /> Contact us
              </Link>
            )}
            {site.twitter && (
              <a href={`https://x.com/${site.twitter.replace(/^@/, "")}`} rel="me noopener" className="hover:text-primary">
                X / Twitter
              </a>
            )}
          </div>
        </div>
      </div>
    </Reveal>
  );
}
