import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, m } from "framer-motion";
import { ArrowRight, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useApi } from "@/lib/context";
import { categoriesQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";

/** Structured category mega menu: category → subcategory. Roots in three columns, subcategories on the right. */
export function MegaMenu({ active }: { active: boolean }) {
  const api = useApi();
  const { data: tree = [] } = useQuery(categoriesQuery(api));
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const per = Math.ceil(tree.length / 3) || 1;
  const columns = [tree.slice(0, per), tree.slice(per, per * 2), tree.slice(per * 2)];
  const focus = tree.find((c) => c.slug === (hover ?? "")) ?? null;

  return (
    <div
      ref={wrap}
      className="relative"
      onMouseEnter={() => {
        clearTimeout(closeTimer.current);
        setOpen(true);
      }}
      onMouseLeave={() => {
        closeTimer.current = setTimeout(() => setOpen(false), 140);
      }}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls="mega-categories"
        onClick={() => setOpen((o) => !o)}
        className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-ink", (active || open) && "bg-primary-soft text-primary-dark hover:bg-primary-soft")}
      >
        Categories <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      <AnimatePresence>
        {open && (
          <m.div
            id="mega-categories"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.16 }}
            className="absolute left-1/2 top-[calc(100%+10px)] z-50 w-[min(860px,92vw)] -translate-x-1/2 overflow-hidden rounded-2xl border border-line bg-white shadow-panel"
          >
            <div className="grid grid-cols-[1fr_260px]">
              <div className="grid grid-cols-3 gap-x-2 p-5">
                {columns.map((col, i) => (
                  <ul key={i} className="space-y-0.5">
                    {col.map((c) => (
                      <li key={c.slug}>
                        <Link
                          to={`/categories/${c.slug}`}
                          onMouseEnter={() => setHover(c.slug)}
                          onFocus={() => setHover(c.slug)}
                          className={cn("block rounded-lg px-2.5 py-2 text-sm font-medium transition-colors", hover === c.slug ? "bg-primary-soft text-primary-dark" : "text-ink hover:bg-slate-50")}
                        >
                          {c.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ))}
              </div>
              <div className="border-l border-line bg-slate-50/70 p-5">
                {focus ? (
                  <>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">{focus.name}</p>
                    {focus.children.length ? (
                      <ul className="mt-3 space-y-1">
                        {focus.children.map((ch) => (
                          <li key={ch.slug}>
                            <Link to={`/categories/${ch.slug}`} className="block rounded-lg px-2 py-1.5 text-sm text-slate-700 hover:bg-white hover:text-primary">
                              {ch.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-3 text-sm text-muted">Browse all {focus.name.toLowerCase()} listings.</p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted">Point at a category to see its subcategories.</p>
                )}
              </div>
            </div>
            <div className="border-t border-line bg-white px-5 py-3">
              <Link to="/categories" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
                Browse All Categories <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
