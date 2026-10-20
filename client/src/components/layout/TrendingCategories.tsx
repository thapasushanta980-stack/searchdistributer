import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, m } from "framer-motion";
import { ArrowRight, Car, ChevronDown, ChevronRight, Cpu, FlaskConical, HeartPulse, LayoutGrid, Leaf, Megaphone, Package, Shirt, SprayCan, Utensils, UserPlus, Wheat, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useApi } from "@/lib/context";
import { categoriesQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";

const MAX_ITEMS = 10;

/** Pick an icon from the category name; falls back to a generic one so new categories never look broken. */
const ICONS: Array<[RegExp, LucideIcon]> = [
  [/food|beverage|snack|dairy/i, Utensils],
  [/health|medic|pharma|personal care/i, HeartPulse],
  [/ayurved|herbal/i, Leaf],
  [/home|clean|house/i, SprayCan],
  [/agri|farm/i, Wheat],
  [/apparel|fashion|cloth|textile/i, Shirt],
  [/auto|spare|vehicle|lubricant|transport/i, Car],
  [/chemical|lab/i, FlaskConical],
  [/electronic|mobile|appliance|accessor/i, Cpu],
];
export const iconFor = (name: string) => ICONS.find(([re]) => re.test(name))?.[1] ?? Package;

/** "Trending Categories" bar under the header: top industries by listing count, plus two sign-up prompts. */
export function TrendingCategories() {
  const api = useApi();
  const { data: tree = [] } = useQuery(categoriesQuery(api));
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown, { passive: true });
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const top = [...tree].sort((a, b) => b.distributorCount - a.distributorCount).slice(0, MAX_ITEMS);

  return (
    <div className="container-page relative z-30 pt-2 sm:pt-3">
      <div ref={wrap} className="relative w-full sm:max-w-xs">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="trending-categories"
          onClick={() => setOpen((o) => !o)}
          className="flex h-11 w-full items-center justify-between gap-3 rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-card transition-colors hover:bg-primary-dark"
        >
          <span className="flex items-center gap-2.5">
            <LayoutGrid className="h-[18px] w-[18px] text-white/80" aria-hidden />
            Trending Categories
          </span>
          <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", open && "rotate-180")} aria-hidden />
        </button>

        <AnimatePresence>
          {open && (
            <m.div
              id="trending-categories"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16 }}
              className="absolute left-0 right-0 top-[calc(100%+8px)] max-h-[75dvh] overflow-y-auto overscroll-contain rounded-2xl border border-line bg-white p-2 shadow-panel sm:w-[360px] sm:right-auto"
            >
              <ul>
                {top.map((c) => {
                  const Icon = iconFor(c.name);
                  return (
                    <li key={c.slug}>
                      <Link to={`/categories/${c.slug}`} className="group flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-ink transition-colors hover:bg-primary-soft hover:text-primary-dark">
                        <Icon className="h-5 w-5 shrink-0 text-slate-600 group-hover:text-primary" aria-hidden />
                        <span className="min-w-0 flex-1 truncate">{c.name}</span>
                        {c.distributorCount > 0 && <span className="text-xs tabular-nums text-muted">{c.distributorCount}</span>}
                        <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                      </Link>
                    </li>
                  );
                })}
                <li>
                  <Link to="/categories" className="group flex min-h-11 items-center justify-between rounded-lg px-3 text-sm font-semibold text-primary hover:bg-primary-soft">
                    Browse All Categories <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </Link>
                </li>
              </ul>

              <div className="mt-1 grid gap-2 border-t border-line p-1 pt-2">
                <Link to="/register" className="group flex min-h-[72px] items-center justify-between gap-3 rounded-xl bg-gradient-to-r from-pink-50 to-indigo-50 px-4 py-3">
                  <span>
                    <span className="block text-sm font-bold text-ink">Sign Up &amp; Grow your Business</span>
                    <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary-dark">
                      Register Now <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </span>
                  </span>
                  <UserPlus className="h-9 w-9 shrink-0 text-primary/60" aria-hidden />
                </Link>
                <Link to="/post-requirement" className="group flex min-h-[72px] items-center justify-between gap-3 rounded-xl bg-gradient-to-r from-amber-50 to-rose-50 px-4 py-3">
                  <span>
                    <span className="block text-sm font-bold text-ink">Looking for a distributor?</span>
                    <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary-dark">
                      Post Requirement <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </span>
                  </span>
                  <Megaphone className="h-9 w-9 shrink-0 text-rose-400/70" aria-hidden />
                </Link>
              </div>
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
