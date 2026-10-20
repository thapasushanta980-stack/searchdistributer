import { useQuery } from "@tanstack/react-query";
import { BadgeDollarSign, Building2, ChevronRight, ClipboardList, LogIn, Megaphone, Package, Search, Store, UserPlus, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useApi } from "@/lib/context";
import { categoriesQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { LogoMark } from "./SiteHeader";
import { iconFor } from "./TrendingCategories";

const MAX_CATEGORIES = 8;

const EXPLORE: Array<{ label: string; to: string; icon: LucideIcon }> = [
  { label: "Find Distributors", to: "/distributors", icon: Search },
  { label: "Distributor Leads", to: "/leads", icon: ClipboardList },
  { label: "Products", to: "/products", icon: Package },
  { label: "Brands", to: "/brands", icon: Store },
  { label: "Post Requirement", to: "/post-requirement", icon: Megaphone },
  { label: "Pricing", to: "/pricing", icon: BadgeDollarSign },
];

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-6">
      <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{title}</p>
      <ul className="space-y-0.5">{children}</ul>
    </div>
  );
}

function Item({ to, icon: Icon, label, active }: { to: string; icon: LucideIcon; label: string; active: boolean }) {
  return (
    <li>
      <Link
        to={to}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group flex min-h-9 items-center gap-3 rounded-lg px-3 text-[13px] font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-ink",
          active && "bg-primary-soft text-primary-dark hover:bg-primary-soft",
        )}
      >
        <Icon className={cn("h-[18px] w-[18px] shrink-0 text-slate-500 group-hover:text-ink", active && "text-primary")} aria-hidden />
        <span className="truncate">{label}</span>
      </Link>
    </li>
  );
}

/** Desktop navigation rail (lg and up). Phones and tablets keep the top header and its menu sheet. */
export function SiteSidebar() {
  const api = useApi();
  const { data: tree = [] } = useQuery(categoriesQuery(api));
  const { pathname } = useLocation();
  const isActive = (to: string) => pathname === to || pathname.startsWith(`${to}/`);
  const top = [...tree].sort((a, b) => b.distributorCount - a.distributorCount).slice(0, MAX_CATEGORIES);

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-line bg-white lg:flex">
      <Link to="/" aria-label="Search Distributor home" className="mx-3 mt-4 flex items-center gap-3 rounded-xl px-2 py-2">
        <LogoMark size={36} />
        <span className="min-w-0">
          <span className="block font-display text-[15px] font-extrabold leading-tight tracking-tight text-ink">Search Distributor</span>
          <span className="block text-xs text-muted">Find your perfect distributors</span>
        </span>
      </Link>

      <nav aria-label="Primary" className="scrollbar-none flex-1 overflow-y-auto px-3 pb-4">
        {top.length > 0 && (
          <Group title="Top Categories">
            {top.map((c) => (
              <Item key={c.slug} to={`/categories/${c.slug}`} icon={iconFor(c.name)} label={c.name} active={isActive(`/categories/${c.slug}`)} />
            ))}
            <li>
              <Link to="/categories" className="group mt-1 flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold text-primary hover:bg-primary-soft">
                Browse All Industries
                <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
            </li>
          </Group>
        )}

        <Group title="Explore">
          {EXPLORE.map((e) => (
            <Item key={e.to} {...e} active={isActive(e.to)} />
          ))}
        </Group>

        <Group title="Account">
          <Item to="/login" icon={LogIn} label="Login" active={isActive("/login")} />
          <Item to="/register" icon={UserPlus} label="Register Business" active={isActive("/register")} />
          <Item to="/about" icon={Building2} label="About" active={isActive("/about")} />
        </Group>
      </nav>
    </aside>
  );
}
