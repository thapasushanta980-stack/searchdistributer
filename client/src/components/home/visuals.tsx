import { m } from "framer-motion";
import { BadgeCheck, Boxes, Building2, Factory, Globe2, LayoutDashboard, MessageSquare, Package, Settings, Truck, Users, Wallet, Megaphone, ClipboardList, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { LogoMark } from "@/components/layout/SiteHeader";
import { cn } from "@/lib/utils";

export function PreviewLabel({ children = "Illustrative preview" }: { children?: string }) {
  return <span className="rounded-full bg-slate-900/80 px-2.5 py-0.5 text-[11px] font-medium tracking-wide text-white">{children}</span>;
}

/* ------------------------------------------------------------------ */
/* Network visualisation                                               */
/* ------------------------------------------------------------------ */

interface NetNode {
  id: string;
  label: string;
  icon: LucideIcon;
  x: number;
  y: number;
  links: string[];
}

const NODES: NetNode[] = [
  { id: "brands", label: "Brands", icon: Factory, x: 400, y: 56, links: ["products", "markets"] },
  { id: "products", label: "Products", icon: Package, x: 680, y: 160, links: ["brands", "distributors"] },
  { id: "distributors", label: "Distributors", icon: Truck, x: 680, y: 360, links: ["products", "wholesalers"] },
  { id: "wholesalers", label: "Wholesalers", icon: Boxes, x: 400, y: 464, links: ["distributors", "buyers"] },
  { id: "buyers", label: "Buyers", icon: Users, x: 120, y: 360, links: ["wholesalers", "markets"] },
  { id: "markets", label: "Markets", icon: Globe2, x: 120, y: 160, links: ["buyers", "brands"] },
];
const C = { x: 400, y: 260 };

export function NetworkViz() {
  const [active, setActive] = useState<string | null>(null);
  const related = (id: string) => active === id || NODES.find((n) => n.id === active)?.links.includes(id);

  return (
    <div className="relative mx-auto w-full max-w-4xl">
      <svg viewBox="0 0 800 520" className="h-auto w-full" role="group" aria-label="Network of brands, products, distributors, wholesalers, buyers and markets connected through Search Distributor">
        {NODES.map((n) => {
          const on = active === n.id;
          return (
            <g key={`spoke-${n.id}`}>
              <line x1={C.x} y1={C.y} x2={n.x} y2={n.y} stroke={on ? "#3156D3" : "#CBD5E1"} strokeWidth={on ? 2 : 1.25} className={on ? "dash-flow" : undefined} style={{ transition: "stroke .25s" }} />
            </g>
          );
        })}
        {NODES.map((n) =>
          n.links
            .filter((l) => l > n.id)
            .map((l) => {
              const t = NODES.find((x) => x.id === l)!;
              const on = active === n.id || active === l;
              return <line key={`${n.id}-${l}`} x1={n.x} y1={n.y} x2={t.x} y2={t.y} stroke={on ? "#635BFF" : "#E2E8F0"} strokeWidth={on ? 2 : 1} className={on ? "dash-flow" : undefined} style={{ transition: "stroke .25s" }} />;
            }),
        )}

        <circle cx={C.x} cy={C.y} r="58" fill="#3156D3" opacity="0.08" className="node-pulse" />
        <circle cx={C.x} cy={C.y} r="46" fill="#fff" stroke="#3156D3" strokeWidth="2" />
        <g transform={`translate(${C.x - 20} ${C.y - 30})`}>
          <foreignObject width="40" height="40">
            <LogoMark size={40} />
          </foreignObject>
        </g>
        <text x={C.x} y={C.y + 32} textAnchor="middle" className="fill-ink font-display" fontSize="11" fontWeight="700">
          Search Distributor
        </text>

        {NODES.map((n) => {
          const dim = active && !related(n.id);
          return (
            <g
              key={n.id}
              tabIndex={0}
              role="button"
              aria-label={`${n.label}: connected to ${n.links.join(" and ")}`}
              onMouseEnter={() => setActive(n.id)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(n.id)}
              onBlur={() => setActive(null)}
              style={{ cursor: "pointer", opacity: dim ? 0.35 : 1, transition: "opacity .25s" }}
            >
              <rect x={n.x - 74} y={n.y - 26} width="148" height="52" rx="14" fill="#fff" stroke={active === n.id ? "#3156D3" : "#E2E8F0"} strokeWidth={active === n.id ? 2 : 1.25} />
              <foreignObject x={n.x - 62} y={n.y - 13} width="26" height="26">
                <n.icon width={22} height={22} color="#3156D3" aria-hidden />
              </foreignObject>
              <text x={n.x - 26} y={n.y + 5} className="fill-ink font-display" fontSize="15" fontWeight="700">
                {n.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Storefront preview (For businesses)                                 */
/* ------------------------------------------------------------------ */

export function StorefrontPreview() {
  const rise = (d: number) => ({ initial: { opacity: 0, y: 12 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: "-60px" }, transition: { duration: 0.5, delay: d, ease: [0.22, 1, 0.36, 1] as const } });
  return (
    <div className="relative">
      <div className="absolute -top-3 right-3 z-10">
        <PreviewLabel />
      </div>
      <div className="overflow-hidden rounded-[20px] border border-line bg-white shadow-panel">
        <div className="flex items-center gap-1.5 border-b border-line bg-slate-50 px-4 py-2.5" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
          <span className="ml-3 h-5 flex-1 rounded-md bg-white text-[11px] leading-5 text-slate-400">&nbsp;searchdistributor.com/distributors/your-company</span>
        </div>
        <div className="space-y-5 p-5 sm:p-6">
          <m.div {...rise(0)} className="flex items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-xl border border-line bg-primary-soft font-display text-lg font-bold text-primary-dark">YC</span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-display text-lg font-bold text-ink">Your Company</p>
                <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/15">
                  <BadgeCheck className="h-3.5 w-3.5" aria-hidden /> Verified
                </span>
              </div>
              <p className="text-sm text-muted">Manufacturer · Your city, Country</p>
            </div>
          </m.div>
          <m.div {...rise(0.12)} className="space-y-1.5" aria-hidden>
            <div className="h-2 w-full rounded-full bg-slate-100" />
            <div className="h-2 w-11/12 rounded-full bg-slate-100" />
            <div className="h-2 w-2/3 rounded-full bg-slate-100" />
          </m.div>
          <m.div {...rise(0.24)}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Product portfolio</p>
            <div className="grid grid-cols-3 gap-2.5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-xl border border-line p-2.5">
                  <div className="flex h-14 items-center justify-center rounded-lg bg-slate-50 text-slate-300">
                    <Package className="h-6 w-6" aria-hidden />
                  </div>
                  <div className="mt-2 h-1.5 w-4/5 rounded-full bg-slate-100" />
                </div>
              ))}
            </div>
          </m.div>
          <m.div {...rise(0.36)} className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">Categories</span>
            {["Category", "Category"].map((c, i) => (
              <span key={i} className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                {c}
              </span>
            ))}
            <span className="ml-2 text-xs font-semibold uppercase tracking-wide text-muted">Distribution areas</span>
            <span className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-0.5 text-xs text-slate-600">
              <Globe2 className="h-3 w-3 text-primary" aria-hidden /> Regions you serve
            </span>
          </m.div>
        </div>
      </div>
      <m.div
        initial={{ opacity: 0, y: 16, scale: 0.96 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true }}
        transition={{ type: "spring", stiffness: 300, damping: 22, delay: 0.9 }}
        className="absolute -bottom-5 left-4 flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3 shadow-card-hover sm:left-auto sm:-right-4"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-white">
          <MessageSquare className="h-4 w-4" aria-hidden />
        </span>
        <div>
          <p className="text-sm font-semibold text-ink">New enquiry</p>
          <p className="text-xs text-muted">From a business buyer</p>
        </div>
      </m.div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Dashboard preview                                                   */
/* ------------------------------------------------------------------ */

const SIDEBAR: Array<[string, LucideIcon]> = [
  ["Overview", LayoutDashboard],
  ["Company Profile", Building2],
  ["Products", Package],
  ["Enquiries", MessageSquare],
  ["Subscription", Wallet],
  ["Promotions", Megaphone],
  ["Settings", Settings],
];

export function DashboardPreview() {
  const pop = (d: number) => ({ initial: { opacity: 0, y: 14 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: "-50px" }, transition: { duration: 0.5, delay: d, ease: [0.22, 1, 0.36, 1] as const } });
  return (
    <div className="relative">
      <div className="absolute -top-3 right-3 z-10">
        <PreviewLabel>Illustrative preview · sample data</PreviewLabel>
      </div>
      <div className="grid overflow-hidden rounded-[20px] border border-line bg-white shadow-panel md:grid-cols-[200px_1fr]">
        <div className="hidden border-r border-line bg-slate-50/70 p-4 md:block" aria-hidden>
          <div className="mb-4 flex items-center gap-2">
            <LogoMark size={24} />
            <span className="font-display text-sm font-bold text-ink">Workspace</span>
          </div>
          <ul className="space-y-1">
            {SIDEBAR.map(([label, Icon], i) => (
              <li key={label} className={cn("flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium", i === 0 ? "bg-white text-primary-dark shadow-sm ring-1 ring-line" : "text-slate-500")}>
                <Icon className="h-4 w-4" /> {label}
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-4 p-5 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <m.div {...pop(0)} className="rounded-xl border border-line p-4">
              <p className="text-xs font-medium text-muted">Profile status</p>
              <p className="mt-1 font-display text-lg font-bold text-ink">Approved</p>
              <div className="mt-3 h-1.5 rounded-full bg-slate-100">
                <m.div initial={{ width: 0 }} whileInView={{ width: "86%" }} viewport={{ once: true }} transition={{ duration: 1, delay: 0.4 }} className="h-full rounded-full bg-primary" />
              </div>
              <p className="mt-1.5 text-[11px] text-muted">86% complete</p>
            </m.div>
            <m.div {...pop(0.1)} className="rounded-xl border border-line p-4">
              <p className="text-xs font-medium text-muted">Subscription</p>
              <p className="mt-1 font-display text-lg font-bold text-ink">Active</p>
              <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700">
                <BadgeCheck className="h-3 w-3" aria-hidden /> Renews in 9 months
              </p>
            </m.div>
            <m.div {...pop(0.2)} className="rounded-xl border border-line p-4">
              <p className="text-xs font-medium text-muted">Marketplace visibility</p>
              <p className="mt-1 font-display text-lg font-bold text-ink">Published</p>
              <p className="mt-3 text-[11px] text-muted">6 of 10 product slots used</p>
            </m.div>
          </div>
          <m.div {...pop(0.3)} className="rounded-xl border border-line p-4">
            <p className="text-xs font-medium text-muted">Product performance</p>
            <div className="mt-3 flex h-24 items-end gap-2" aria-hidden>
              {[38, 52, 44, 70, 58, 84, 76].map((h, i) => (
                <m.div key={i} initial={{ height: 0 }} whileInView={{ height: `${h}%` }} viewport={{ once: true }} transition={{ duration: 0.7, delay: 0.4 + i * 0.06 }} className={cn("flex-1 rounded-t-md", i === 5 ? "bg-primary" : "bg-primary/25")} />
              ))}
            </div>
          </m.div>
          <m.div {...pop(0.4)} className="rounded-xl border border-line p-4">
            <p className="mb-2 text-xs font-medium text-muted">Recent enquiries</p>
            <ul className="divide-y divide-line text-sm" aria-hidden>
              {["New", "Contacted", "Closed"].map((s, i) => (
                <li key={s} className="flex items-center justify-between py-2">
                  <span className="flex items-center gap-2 text-slate-600">
                    <ClipboardList className="h-4 w-4 text-slate-400" /> Enquiry from a business buyer
                  </span>
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", i === 0 ? "bg-primary-soft text-primary-dark" : "bg-slate-100 text-slate-600")}>{s}</span>
                </li>
              ))}
            </ul>
          </m.div>
        </div>
      </div>
    </div>
  );
}


/* ------------------------------------------------------------------ */
/* Hero network: Search Distributor at the centre of the ecosystem     */
/* ------------------------------------------------------------------ */

const HERO_NODES: Array<{ label: string; icon: LucideIcon; x: number; y: number }> = [
  { label: "Brands", icon: Factory, x: 22, y: 14 },
  { label: "Products", icon: Package, x: 78, y: 14 },
  { label: "Distributors", icon: Truck, x: 22, y: 86 },
  { label: "Markets", icon: Globe2, x: 78, y: 86 },
];

/**
 * Layout (percent of a square): hub in the centre, four equal nodes in the corners joined to it by flowing lines,
 * and two status chips parked in the empty gaps at left/right middle so nothing overlaps.
 */
export function HeroNetwork() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[440px]" role="img" aria-label="Search Distributor connects brands, products, distributors and markets.">
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
        {HERO_NODES.map((n) => (
          <line key={n.label} x1="50" y1="50" x2={n.x} y2={n.y} stroke="#3156D3" strokeOpacity="0.45" strokeWidth="0.45" className="dash-flow" />
        ))}
        <circle cx="50" cy="50" r="15" fill="#3156D3" opacity="0.08" className="node-pulse" />
        <circle cx="50" cy="50" r="11.5" fill="#fff" stroke="#3156D3" strokeWidth="0.5" />
      </svg>

      {/* Hub */}
      <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
        <LogoMark size={44} />
      </div>
      <p className="absolute left-1/2 top-[65%] -translate-x-1/2 whitespace-nowrap font-display text-[13px] font-bold text-ink">Search Distributor</p>

      {/* Nodes */}
      {HERO_NODES.map((n, i) => (
        <m.div
          key={n.label}
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.3 + i * 0.1, ease: [0.22, 1, 0.36, 1] }}
          style={{ left: `${n.x}%`, top: `${n.y}%` }}
          className="absolute flex w-[40%] -translate-x-1/2 -translate-y-1/2 items-center gap-2.5 rounded-2xl border border-line bg-white px-3 py-2.5 shadow-card-hover"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <n.icon className="h-[18px] w-[18px]" aria-hidden />
          </span>
          <span className="truncate font-display text-sm font-bold text-ink">{n.label}</span>
        </m.div>
      ))}

      {/* Status chips, in the clear gaps */}
      <m.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: [0, -4, 0] }}
        transition={{ opacity: { delay: 0.9, duration: 0.4 }, y: { delay: 1.3, duration: 5, repeat: Infinity, ease: "easeInOut" } }}
        className="absolute left-[2%] top-1/2 hidden -translate-y-1/2 items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 shadow-card-hover sm:flex"
      >
        <BadgeCheck className="h-4 w-4 text-success" aria-hidden />
        <span className="whitespace-nowrap text-xs font-semibold text-ink">Verified profile</span>
      </m.div>
      <m.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: [0, 4, 0] }}
        transition={{ opacity: { delay: 1.0, duration: 0.4 }, y: { delay: 1.5, duration: 6, repeat: Infinity, ease: "easeInOut" } }}
        className="absolute right-[2%] top-1/2 hidden -translate-y-1/2 items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 shadow-card-hover sm:flex"
      >
        <MessageSquare className="h-4 w-4 text-primary" aria-hidden />
        <span className="whitespace-nowrap text-xs font-semibold text-ink">New enquiry</span>
      </m.div>
    </div>
  );
}
