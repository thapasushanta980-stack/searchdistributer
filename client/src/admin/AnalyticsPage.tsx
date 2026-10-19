import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Minus, Table2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ANALYTICS_RANGES, type AnalyticsDTO, type AnalyticsKpi, type AnalyticsRange } from "@sd/shared";
import { cn } from "@/lib/utils";
import { adminApi } from "./api";
import { Card, PageHeader, useFilters } from "./ui";

/* Chart tokens. Categorical slots 1-3 validated on the white surface (scripts/validate_palette.js): all checks pass;
   slot 3 is under 3:1 contrast, so lines carry end labels and the chart has a table view. */
const VIZ = {
  surface: "#ffffff",
  grid: "#e9e9e4",
  axis: "#c3c2b7",
  muted: "#898781",
  ink: "#0b0b0b",
  ink2: "#52514e",
  series: ["#2a78d6", "#eb6834", "#1baf7a"],
  /** Sequential blue, light -> dark, for the heatmap. */
  ramp: ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"],
  empty: "#f3f3f0",
};

const compact = (v: number) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 10_000 ? `${Math.round(v / 1000)}K` : v >= 1000 ? `${(v / 1000).toFixed(1)}K` : String(Math.round(v)));
const pct = (v: number) => `${(v * 100).toFixed(v > 0 && v < 0.1 ? 1 : 0)}%`;
const shortDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function AnalyticsPage() {
  const { values, set } = useFilters(["range"] as const);
  const range = (ANALYTICS_RANGES as readonly number[]).includes(Number(values.range)) ? (Number(values.range) as AnalyticsRange) : 30;
  const q = useQuery({ queryKey: ["admin", "analytics", range], queryFn: () => adminApi.analytics(range), placeholderData: (p) => p, refetchInterval: 5 * 60_000 });
  const a = q.data;
  const empty = a && a.kpis.visitors.current === 0 && a.kpis.searches.current === 0;

  return (
    <>
      <PageHeader title="Analytics" description="What visitors search for, when they're active, and where supply is missing. Anonymous: no cookies, no stored IP addresses." />

      <div className="mt-5 flex flex-wrap items-center gap-2" role="group" aria-label="Date range">
        {ANALYTICS_RANGES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => set({ range: String(r) })}
            aria-pressed={range === r}
            className={cn("h-9 rounded-button border px-3 text-sm font-medium transition-colors", range === r ? "border-primary bg-primary-soft text-primary-dark" : "border-line-strong bg-surface text-body hover:bg-slate-50")}
          >
            Last {r} days
          </button>
        ))}
        {a && <span className="ml-auto text-xs text-muted">Times in {a.timezone.replace("_", " ")}</span>}
      </div>

      {q.isLoading && <div className="skeleton mt-5 h-96 w-full rounded-card" aria-busy="true" />}
      {q.isError && !a && (
        <p role="alert" className="mt-5 rounded-input border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
          Couldn't load analytics. Please refresh.
        </p>
      )}

      {a && (
        // Refetch keeps the frame: the previous render stays, dimmed, while new numbers load.
        <div className={cn("transition-opacity", q.isFetching && q.isPlaceholderData && "opacity-60")}>
          {empty && (
            <Card className="mt-5 border-dashed text-center text-sm text-muted">
              No visitor activity in the last {range} days yet. Numbers appear here as people search and browse the site.
            </Card>
          )}
          <Kpis a={a} />
          <Card className="mt-5">
            <TrendChart daily={a.daily} />
          </Card>
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <Card>
              <Heatmap cells={a.heatmap} />
            </Card>
            <Card>
              <UnmetSearches rows={a.unmetSearches} />
            </Card>
          </div>
          <Card className="mt-5">
            <CategoryDemand rows={a.categories} />
          </Card>
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <Card>
              <TopSearches rows={a.topSearches} />
            </Card>
            <Card>
              <BarList title="Top searched locations" empty="No location searches yet." rows={a.topLocations.map((l) => ({ label: titleCase(l.location), value: l.count }))} />
            </Card>
          </div>
          <Card className="mt-5">
            <TopListings rows={a.topListings} />
          </Card>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <Card>
              <BarList title="Visitors by device" empty="No visitors yet." rows={a.devices.map((d) => ({ label: titleCase(d.device), value: d.count }))} />
            </Card>
            <Card>
              <BarList title="Visitors by country" empty="No visitors yet." rows={a.countries.map((c) => ({ label: countryName(c.country), value: c.count }))} />
            </Card>
          </div>
        </div>
      )}
    </>
  );
}

const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());
const countryName = (code: string) => {
  try {
    return new Intl.DisplayNames(undefined, { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
};

/* ------------------------------ KPIs ------------------------------- */

function Kpis({ a }: { a: AnalyticsDTO }) {
  const k = a.kpis;
  const tiles: Array<{ label: string; kpi: AnalyticsKpi; format?: "pct"; upIsGood?: boolean; hint: string }> = [
    { label: "Visitors", kpi: k.visitors, hint: "Unique per day, added up" },
    { label: "Searches", kpi: k.searches, hint: "Settled searches with a keyword, place or category" },
    { label: "Searches with no results", kpi: k.zeroResultRate, format: "pct", upIsGood: false, hint: "Demand you can't serve yet" },
    { label: "Listing views", kpi: k.listingViews, hint: "Distributor and brand pages opened" },
    { label: "WhatsApp chats", kpi: k.whatsappClicks, hint: "Clicks through to WhatsApp" },
    { label: "Enquiries", kpi: k.enquiries, hint: "Enquiry forms sent" },
    { label: "Contact rate", kpi: k.contactRate, format: "pct", hint: "WhatsApp + enquiries per listing view" },
    { label: "New registrations and messages", kpi: k.newLeads, hint: "Register and contact forms" },
  ];
  return (
    <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {tiles.map((t) => (
        <StatTile key={t.label} {...t} />
      ))}
    </div>
  );
}

function StatTile({ label, kpi, format, upIsGood = true, hint }: { label: string; kpi: AnalyticsKpi; format?: "pct"; upIsGood?: boolean; hint: string }) {
  const value = format === "pct" ? pct(kpi.current) : kpi.current.toLocaleString();
  const diff = kpi.current - kpi.previous;
  const flat = Math.abs(diff) < (format === "pct" ? 0.005 : 0.5);
  const good = flat ? null : diff > 0 === upIsGood;
  const change = format === "pct" ? `${diff > 0 ? "+" : ""}${(diff * 100).toFixed(1)} pts` : kpi.previous ? `${diff > 0 ? "+" : ""}${Math.round((diff / kpi.previous) * 100)}%` : diff > 0 ? "New" : "—";
  const Icon = flat ? Minus : diff > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <div className="rounded-card border border-line bg-surface p-4 shadow-card" title={hint}>
      <div className="text-sm text-body">{label}</div>
      <div className="mt-1.5 text-2xl font-semibold text-ink sm:text-3xl">{value}</div>
      <div className={cn("mt-1 inline-flex items-center gap-0.5 text-xs font-medium", good === null ? "text-muted" : good ? "text-[#006300]" : "text-danger")}>
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {flat ? "No change" : change}
        <span className="ml-1 font-normal text-muted">vs previous</span>
      </div>
    </div>
  );
}

/* --------------------------- Trend chart --------------------------- */

const SERIES = [
  { key: "searches", label: "Searches" },
  { key: "listingViews", label: "Listing views" },
  { key: "contacts", label: "Contacts" },
] as const;

function niceMax(v: number) {
  if (v <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(v));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => v <= s * 4) ?? 10 * pow;
  return step * 4;
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(640);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => e && setW(Math.max(280, Math.floor(e.contentRect.width))));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function TrendChart({ daily }: { daily: AnalyticsDTO["daily"] }) {
  const [wrap, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  const H = 240;
  const pad = { l: 40, r: 96, t: 12, b: 28 };
  const iw = width - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const max = niceMax(Math.max(1, ...daily.flatMap((d) => SERIES.map((s) => d[s.key]))));
  const x = (i: number) => pad.l + (daily.length <= 1 ? iw / 2 : (i / (daily.length - 1)) * iw);
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const every = Math.max(1, Math.ceil(daily.length / Math.max(2, Math.floor(iw / 80))));

  // End labels: direct-label each line in legend order, skipping any that would collide with one already placed
  // (the legend and tooltip still name it). Legend order, not position, decides who keeps the label.
  const last = daily[daily.length - 1];
  const ends = useMemo(() => {
    if (!last) return [];
    const placed: Array<{ i: number; y: number }> = [];
    SERIES.forEach((s, i) => {
      const e = { i, y: y(last[s.key]) };
      if (placed.every((p) => Math.abs(p.y - e.y) >= 14)) placed.push(e);
    });
    return placed;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [last, max, width]);

  const pick = (e: PointerEvent<SVGRectElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    setHover(Math.max(0, Math.min(daily.length - 1, Math.round(((px - 0) / r.width) * (daily.length - 1)))));
  };
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key === "ArrowRight") setHover((h) => Math.min(daily.length - 1, (h ?? -1) + 1));
    else if (e.key === "ArrowLeft") setHover((h) => Math.max(0, (h ?? daily.length) - 1));
    else if (e.key === "Escape") setHover(null);
    else return;
    e.preventDefault();
  };
  const hv = hover !== null ? daily[hover] : null;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 className="text-base">Daily activity</h2>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-body" aria-label="Legend">
          {SERIES.map((s, i) => (
            <li key={s.key} className="inline-flex items-center gap-1.5">
              <span aria-hidden className="inline-block h-0.5 w-4 rounded" style={{ background: VIZ.series[i] }} />
              {s.label}
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => setAsTable((v) => !v)} className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline" aria-pressed={asTable}>
          <Table2 className="h-3.5 w-3.5" aria-hidden /> {asTable ? "Show chart" : "Show as table"}
        </button>
      </div>

      {asTable ? (
        <div className="mt-3 max-h-80 overflow-auto">
          <table className="w-full text-sm tabular-nums">
            <thead className="sticky top-0 bg-surface text-left text-xs text-muted">
              <tr>
                <th className="py-1.5 font-medium">Day</th>
                <th className="py-1.5 text-right font-medium">Visitors</th>
                {SERIES.map((s) => (
                  <th key={s.key} className="py-1.5 text-right font-medium">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...daily].reverse().map((d) => (
                <tr key={d.date} className="border-t border-line">
                  <td className="py-1.5">{shortDate(d.date)}</td>
                  <td className="py-1.5 text-right">{d.visitors}</td>
                  {SERIES.map((s) => (
                    <td key={s.key} className="py-1.5 text-right">
                      {d[s.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={wrap} className="relative mt-3">
          <svg
            width={width}
            height={H}
            role="img"
            aria-label={`Daily searches, listing views and contacts over ${daily.length} days. Use the left and right arrow keys to read each day.`}
            tabIndex={0}
            onKeyDown={onKey}
            onBlur={() => setHover(null)}
            className="block focus-visible:outline-primary"
          >
            {ticks.map((t) => (
              <g key={t}>
                <line x1={pad.l} x2={pad.l + iw} y1={y(t)} y2={y(t)} stroke={t === 0 ? VIZ.axis : VIZ.grid} strokeWidth={1} />
                <text x={pad.l - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={VIZ.muted} className="tabular-nums">
                  {compact(t)}
                </text>
              </g>
            ))}
            {daily.map((d, i) =>
              i % every === 0 || i === daily.length - 1 ? (
                <text key={d.date} x={x(i)} y={H - 8} textAnchor="middle" fontSize={11} fill={VIZ.muted}>
                  {shortDate(d.date)}
                </text>
              ) : null,
            )}
            {SERIES.map((s, si) => (
              <polyline
                key={s.key}
                points={daily.map((d, i) => `${x(i)},${y(d[s.key])}`).join(" ")}
                fill="none"
                stroke={VIZ.series[si]}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}
            {last &&
              ends.map(({ i }) => {
                const s = SERIES[i]!;
                return (
                  <g key={s.key}>
                    <circle cx={x(daily.length - 1)} cy={y(last[s.key])} r={4} fill={VIZ.series[i]} stroke={VIZ.surface} strokeWidth={2} />
                    <text x={x(daily.length - 1) + 10} y={y(last[s.key])} dy="0.32em" fontSize={11} fill={VIZ.ink2}>
                      {s.label} {compact(last[s.key])}
                    </text>
                  </g>
                );
              })}
            {hv && hover !== null && (
              <g pointerEvents="none">
                <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} stroke={VIZ.axis} strokeWidth={1} />
                {SERIES.map((s, si) => (
                  <circle key={s.key} cx={x(hover)} cy={y(hv[s.key])} r={4} fill={VIZ.series[si]} stroke={VIZ.surface} strokeWidth={2} />
                ))}
              </g>
            )}
            <rect x={pad.l} y={pad.t} width={iw} height={ih} fill="transparent" onPointerMove={pick} onPointerLeave={() => setHover(null)} />
          </svg>
          {hv && hover !== null && (
            <div
              role="status"
              className="pointer-events-none absolute top-2 z-10 min-w-40 rounded-input border border-line bg-surface px-3 py-2 text-xs shadow-panel"
              style={{ left: Math.min(width - 170, Math.max(0, x(hover) + 12)) }}
            >
              <div className="mb-1 font-medium text-ink">{shortDate(hv.date)}</div>
              <div className="flex items-center justify-between gap-4 text-muted">
                <span>Visitors</span>
                <strong className="text-ink tabular-nums">{hv.visitors}</strong>
              </div>
              {SERIES.map((s, si) => (
                <div key={s.key} className="flex items-center justify-between gap-4">
                  <span className="inline-flex items-center gap-1.5 text-muted">
                    <span aria-hidden className="inline-block h-0.5 w-3 rounded" style={{ background: VIZ.series[si] }} />
                    {s.label}
                  </span>
                  <strong className="text-ink tabular-nums">{hv[s.key]}</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ----------------------------- Heatmap ----------------------------- */

function Heatmap({ cells }: { cells: AnalyticsDTO["heatmap"] }) {
  const [tip, setTip] = useState<{ dow: number; hour: number; count: number } | null>(null);
  const grid = new Map(cells.map((c) => [`${c.dow}-${c.hour}`, c.count]));
  const max = Math.max(0, ...cells.map((c) => c.count));
  const color = (v: number) => (v === 0 || max === 0 ? VIZ.empty : VIZ.ramp[Math.min(VIZ.ramp.length - 1, Math.floor((v / max) * (VIZ.ramp.length - 0.001)))]!);
  const peak = cells.reduce<(typeof cells)[number] | null>((b, c) => (!b || c.count > b.count ? c : b), null);
  const hourLabel = (h: number) => `${h % 12 || 12}${h < 12 ? "am" : "pm"}`;
  const order = [1, 2, 3, 4, 5, 6, 0]; // Monday first

  return (
    <div>
      <h2 className="text-base">Peak hours</h2>
      <p className="mt-0.5 text-xs text-muted">{peak && peak.count > 0 ? `Busiest: ${DAYS[peak.dow]} around ${hourLabel(peak.hour)}.` : "All activity by weekday and hour."}</p>
      <div className="mt-3 overflow-x-auto">
        <div className="relative min-w-[420px]">
          <div className="grid grid-cols-[32px_repeat(24,minmax(0,1fr))] gap-[2px] text-[10px] text-muted">
            <span />
            {Array.from({ length: 24 }, (_, h) => (
              <span key={h} className="text-center">
                {h % 6 === 0 ? hourLabel(h) : ""}
              </span>
            ))}
            {order.map((d) => (
              <Row key={d} label={DAYS[d]!}>
                {Array.from({ length: 24 }, (_, h) => {
                  const v = grid.get(`${d}-${h}`) ?? 0;
                  return (
                    <button
                      key={h}
                      type="button"
                      aria-label={`${DAYS[d]} ${hourLabel(h)}: ${v} events`}
                      onPointerEnter={() => setTip({ dow: d, hour: h, count: v })}
                      onFocus={() => setTip({ dow: d, hour: h, count: v })}
                      onPointerLeave={() => setTip(null)}
                      onBlur={() => setTip(null)}
                      className="aspect-square rounded-[3px] outline-offset-1 hover:outline hover:outline-2 hover:outline-ink/40 focus-visible:outline-primary"
                      style={{ background: color(v) }}
                    />
                  );
                })}
              </Row>
            ))}
          </div>
          {tip && (
            <div role="status" className="pointer-events-none absolute right-0 top-0 rounded-input border border-line bg-surface px-2.5 py-1.5 text-xs shadow-panel">
              <strong className="tabular-nums text-ink">{tip.count}</strong> <span className="text-muted">events · {DAYS[tip.dow]} {hourLabel(tip.hour)}</span>
            </div>
          )}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 text-[11px] text-muted" aria-hidden>
        Less
        <span className="flex gap-[2px]">
          {[VIZ.empty, ...VIZ.ramp].map((c) => (
            <span key={c} className="h-3 w-3 rounded-[2px]" style={{ background: c }} />
          ))}
        </span>
        More
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <span className="self-center">{label}</span>
      {children}
    </>
  );
}

/* ------------------------------ Tables ----------------------------- */

function InlineBar({ value, max, color = VIZ.series[0] }: { value: number; max: number; color?: string }) {
  return (
    <span aria-hidden className="block h-1.5 w-full rounded-full" style={{ background: VIZ.empty }}>
      <span className="block h-1.5 rounded-full" style={{ width: `${max ? Math.max(2, (value / max) * 100) : 0}%`, background: color }} />
    </span>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="mt-3 rounded-input bg-background p-4 text-center text-sm text-muted">{children}</p>;
}

function UnmetSearches({ rows }: { rows: AnalyticsDTO["unmetSearches"] }) {
  return (
    <div>
      <h2 className="text-base">Searched for, not found</h2>
      <p className="mt-0.5 text-xs text-muted">Every search below returned nothing. These are the brands and distributors to recruit next.</p>
      {rows.length === 0 ? (
        <Empty>No unmet searches in this period.</Empty>
      ) : (
        <table className="mt-3 w-full text-sm">
          <thead className="text-left text-xs text-muted">
            <tr>
              <th className="pb-1.5 font-medium">Search</th>
              <th className="pb-1.5 font-medium">Usual location</th>
              <th className="pb-1.5 text-right font-medium">Times</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.query} className="border-t border-line">
                <td className="py-1.5 font-medium text-ink">{r.query}</td>
                <td className="py-1.5 text-body">{r.location ? titleCase(r.location) : "—"}</td>
                <td className="py-1.5 text-right tabular-nums">{r.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function TopSearches({ rows }: { rows: AnalyticsDTO["topSearches"] }) {
  const max = Math.max(0, ...rows.map((r) => r.count));
  return (
    <div>
      <h2 className="text-base">Top searches</h2>
      {rows.length === 0 ? (
        <Empty>No keyword searches yet.</Empty>
      ) : (
        <table className="mt-3 w-full text-sm">
          <thead className="text-left text-xs text-muted">
            <tr>
              <th className="pb-1.5 font-medium">Search</th>
              <th className="w-1/3 pb-1.5 font-medium">
                <span className="sr-only">Share</span>
              </th>
              <th className="pb-1.5 text-right font-medium">Times</th>
              <th className="pb-1.5 text-right font-medium">Avg. results</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.query} className="border-t border-line">
                <td className="py-1.5 pr-2 font-medium text-ink">
                  {r.query}
                  {r.zeroResults === r.count && (
                    <span className="ml-1.5 inline-flex items-center gap-0.5 text-[11px] font-normal text-danger">
                      <AlertTriangle className="h-3 w-3" aria-hidden /> no results
                    </span>
                  )}
                </td>
                <td className="py-1.5 pr-2">
                  <InlineBar value={r.count} max={max} />
                </td>
                <td className="py-1.5 text-right tabular-nums">{r.count}</td>
                <td className="py-1.5 text-right tabular-nums">{r.avgResults}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function CategoryDemand({ rows }: { rows: AnalyticsDTO["categories"] }) {
  const [all, setAll] = useState(false);
  const active = rows.filter((r) => r.searches + r.views + r.contacts > 0);
  const shown = all ? rows : active.slice(0, 15);
  const max = Math.max(0, ...rows.map((r) => r.searches + r.views));
  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h2 className="text-base">Demand and supply by category</h2>
        <button type="button" onClick={() => setAll((v) => !v)} className="ml-auto text-xs font-medium text-primary hover:underline">
          {all ? "Only categories with activity" : `Show all ${rows.length} categories`}
        </button>
      </div>
      <p className="mt-0.5 text-xs text-muted">Interest (searches and page views) against listings currently on the site. "Needs listings" marks demand with nothing to show.</p>
      {shown.length === 0 ? (
        <Empty>No category activity yet.</Empty>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="text-left text-xs text-muted">
              <tr>
                <th className="pb-1.5 font-medium">Category</th>
                <th className="w-1/4 pb-1.5 font-medium">Interest</th>
                <th className="pb-1.5 text-right font-medium">Searches</th>
                <th className="pb-1.5 text-right font-medium">Views</th>
                <th className="pb-1.5 text-right font-medium">Contacts</th>
                <th className="pb-1.5 text-right font-medium">Listings live</th>
                <th className="pb-1.5 pl-3 font-medium">Signal</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const interest = r.searches + r.views;
                const needs = interest > 0 && r.liveListings === 0;
                const thin = !needs && r.liveListings > 0 && interest / r.liveListings >= 20;
                return (
                  <tr key={r.slug} className="border-t border-line">
                    <td className="py-1.5 pr-2">
                      {r.parentName && <span className="text-muted">{r.parentName} › </span>}
                      <span className="font-medium text-ink">{r.name}</span>
                    </td>
                    <td className="py-1.5 pr-2">
                      <InlineBar value={interest} max={max} />
                    </td>
                    <td className="py-1.5 text-right tabular-nums">{r.searches}</td>
                    <td className="py-1.5 text-right tabular-nums">{r.views}</td>
                    <td className="py-1.5 text-right tabular-nums">{r.contacts}</td>
                    <td className="py-1.5 text-right tabular-nums">{r.liveListings}</td>
                    <td className="py-1.5 pl-3 text-xs">
                      {needs ? (
                        <span className="inline-flex items-center gap-1 font-medium text-danger">
                          <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> Needs listings
                        </span>
                      ) : thin ? (
                        <span className="inline-flex items-center gap-1 font-medium text-[#9a5b00]">
                          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden /> High demand
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TopListings({ rows }: { rows: AnalyticsDTO["topListings"] }) {
  return (
    <div>
      <h2 className="text-base">Top listings</h2>
      <p className="mt-0.5 text-xs text-muted">Most viewed distributors and brands, and how often visitors reached out. Useful when offering featured placements.</p>
      {rows.length === 0 ? (
        <Empty>No listing activity yet.</Empty>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="text-left text-xs text-muted">
              <tr>
                <th className="pb-1.5 font-medium">Listing</th>
                <th className="pb-1.5 text-right font-medium">Views</th>
                <th className="pb-1.5 text-right font-medium">WhatsApp</th>
                <th className="pb-1.5 text-right font-medium">Enquiries</th>
                <th className="pb-1.5 text-right font-medium">Contact rate</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-line">
                  <td className="py-1.5 pr-2 font-medium">
                    {r.slug ? (
                      <Link to={`/listings/${r.id}`} className="text-primary hover:underline">
                        {r.name}
                      </Link>
                    ) : (
                      <span className="text-muted">{r.name}</span>
                    )}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{r.views}</td>
                  <td className="py-1.5 text-right tabular-nums">{r.whatsapp}</td>
                  <td className="py-1.5 text-right tabular-nums">{r.enquiries}</td>
                  <td className="py-1.5 text-right tabular-nums">{r.views ? pct((r.whatsapp + r.enquiries) / r.views) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function BarList({ title, rows, empty }: { title: string; rows: Array<{ label: string; value: number }>; empty: string }) {
  const max = Math.max(0, ...rows.map((r) => r.value));
  return (
    <div>
      <h2 className="text-base">{title}</h2>
      {rows.length === 0 ? (
        <Empty>{empty}</Empty>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {rows.map((r) => (
            <li key={r.label} className="text-sm">
              <div className="flex justify-between gap-3">
                <span className="truncate text-ink">{r.label}</span>
                <span className="tabular-nums text-body">{r.value.toLocaleString()}</span>
              </div>
              <div className="mt-1">
                <InlineBar value={r.value} max={max} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
