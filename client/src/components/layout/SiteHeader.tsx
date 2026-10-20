import { Menu } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { OverlayDialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { MegaMenu } from "./MegaMenu";

export const NAV_ITEMS = [
  { label: "Find Distributors", to: "/distributors" },
  { label: "Distributor Leads", to: "/leads" },
  { label: "Products", to: "/products" },
  { label: "Brands", to: "/brands" },
  { label: "Categories", to: "/categories" },
  { label: "Pricing", to: "/pricing" },
] as const;

const MOBILE_GROUPS = [
  { title: "Explore", items: NAV_ITEMS.slice(0, 5) },
  { title: "Business", items: [NAV_ITEMS[5], { label: "Advertising", to: "/advertising" }, { label: "Post Requirement", to: "/post-requirement" }] },
  { title: "Company", items: [{ label: "About", to: "/about" }, { label: "Contact", to: "/contact" }] },
] as const;

export function LogoMark({ size = 32 }: { size?: number }) {
  // Search lens whose handle branches into three connected nodes: search, connection, distribution.
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <rect width="64" height="64" rx="16" fill="#3156D3" />
      <circle cx="25" cy="32" r="10.5" fill="none" stroke="#fff" strokeWidth="4.5" />
      <path d="M35.5 32h6M41.5 32l5-12M41.5 32l5 12" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="48" cy="19" r="4.2" fill="#fff" />
      <circle cx="51" cy="32" r="4.2" fill="#C7D2FE" />
      <circle cx="48" cy="45" r="4.2" fill="#fff" />
    </svg>
  );
}

export function Logo({ light }: { light?: boolean }) {
  return (
    <Link to="/" className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg sm:gap-2.5" aria-label="Search Distributor home">
      <LogoMark />
      <span className={cn("whitespace-nowrap font-display text-base font-extrabold tracking-tight sm:text-[17px]", light ? "text-white" : "text-ink")}>
        Search <span className={light ? "text-indigo-300" : "text-primary"}>Distributor</span>
      </span>
    </Link>
  );
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { pathname, search } = useLocation();
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const current = pathname + search;
  const isActive = (to: string) => (to.includes("?") ? current === to : pathname === to || (to !== "/" && pathname.startsWith(`${to}/`)));

  return (
    <header className={cn("sticky top-0 z-40 border-b lg:hidden transition-[background-color,border-color,box-shadow] duration-300", scrolled ? "border-line bg-white/95 backdrop-blur-md sm:bg-white/80" : "border-transparent bg-background/95 sm:bg-background/70")}>
      <div className={cn("container-page flex items-center justify-between gap-2 sm:gap-4 transition-[height] duration-300", "h-14", !scrolled && "sm:h-16")}>
        <Logo />

        <nav aria-label="Primary" className="hidden items-center gap-0.5 xl:flex">
          {NAV_ITEMS.map((item) =>
            item.to === "/categories" ? (
              <MegaMenu key={item.to} active={isActive(item.to)} />
            ) : (
            <Link
              key={item.to}
              to={item.to}
              aria-current={isActive(item.to) ? "page" : undefined}
              className={cn(
                "whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-ink",
                isActive(item.to) && "bg-primary-soft text-primary-dark hover:bg-primary-soft",
              )}
            >
              {item.label}
            </Link>
            ),
          )}
        </nav>

        <div className="hidden items-center gap-2 xl:flex">
          <Button asChild variant="ghost" size="sm">
            <Link to="/login">Login</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/register">Register Business</Link>
          </Button>
        </div>

        <div className="flex items-center gap-2 xl:hidden">
          <Button asChild size="sm" className="px-3.5 sm:hidden">
            <Link to="/register">Join Free</Link>
          </Button>
          <Button variant="secondary" size="icon" aria-label="Open menu" onClick={() => setOpen(true)}>
            <Menu className="h-5 w-5" aria-hidden />
          </Button>
        </div>
      </div>

      <OverlayDialog open={open} onOpenChange={setOpen} title="Menu" variant="sheet">
        <nav aria-label="Mobile" className="flex flex-1 flex-col overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {MOBILE_GROUPS.map((g) => (
            <div key={g.title} className="mb-3">
              <p className="px-4 pb-1 text-xs font-semibold uppercase tracking-wider text-muted">{g.title}</p>
              {g.items.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  aria-current={isActive(item.to) ? "page" : undefined}
                  className={cn("flex min-h-12 items-center rounded-xl px-4 text-base font-medium text-ink hover:bg-slate-100", isActive(item.to) && "bg-primary-soft text-primary-dark")}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
          <div className="mt-auto flex flex-col gap-2 border-t border-line pt-4">
            <Button asChild variant="secondary" size="lg">
              <Link to="/login" onClick={() => setOpen(false)}>
                Login
              </Link>
            </Button>
            <Button asChild size="lg">
              <Link to="/register" onClick={() => setOpen(false)}>
                Register Business
              </Link>
            </Button>
          </div>
        </nav>
      </OverlayDialog>
    </header>
  );
}
