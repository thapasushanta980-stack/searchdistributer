import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, m } from "framer-motion";
import { ArrowUpRight, ChevronLeft, ChevronRight, Megaphone, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { AdDTO, AdPlacement } from "@sd/shared";
import { Button } from "@/components/ui/button";
import { useApi } from "@/lib/context";
import { adsQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Measurement: an impression = at least 50% visible for 1 continuous  */
/* second, counted once per ad per page view (PRD).                    */
/* ------------------------------------------------------------------ */

const counted = new Set<string>();

function useImpression(id: string | undefined, active: boolean) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !id || !active || counted.has(id) || typeof IntersectionObserver === "undefined") return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const io = new IntersectionObserver(
      ([entry]) => {
        clearTimeout(timer);
        if (entry?.isIntersecting && entry.intersectionRatio >= 0.5) {
          timer = setTimeout(() => {
            if (counted.has(id)) return;
            counted.add(id);
            fetch(`/api/v1/ads/${id}/impression`, { method: "POST", keepalive: true }).catch(() => counted.delete(id));
            io.disconnect();
          }, 1000);
        }
      },
      { threshold: [0, 0.5, 1] },
    );
    io.observe(el);
    return () => {
      clearTimeout(timer);
      io.disconnect();
    };
  }, [id, active]);
  return ref;
}

/** Warm the cache for every creative so slides never appear blank while their image downloads. */
function usePreloadImages(ads: AdDTO[]) {
  useEffect(() => {
    for (const a of ads) {
      if (a.imageUrl) {
        const img = new Image();
        img.decoding = "async";
        img.src = a.imageUrl;
      }
    }
  }, [ads]);
}

/** Mouse parallax: the artwork drifts opposite to the pointer. Values are written as CSS variables (no re-renders). */
function parallax(strength: number) {
  return {
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      if (e.pointerType !== "mouse") return;
      const el = e.currentTarget;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--px", String(((e.clientX - r.left) / r.width - 0.5) * -strength));
      el.style.setProperty("--py", String(((e.clientY - r.top) / r.height - 0.5) * -strength * 0.6));
    },
    onPointerLeave: (e: React.PointerEvent<HTMLElement>) => {
      e.currentTarget.style.setProperty("--px", "0");
      e.currentTarget.style.setProperty("--py", "0");
    },
  };
}

/** A soft diagonal light sweep that crosses the creative every few seconds. */
const Shine = ({ delay = "0s" }: { delay?: string }) => <span aria-hidden className="ad-shine pointer-events-none absolute inset-y-0 left-0 z-[2] w-1/4" style={{ animationDelay: delay }} />;

/** Caption above every creative. The advertiser is named in the artwork and in the accessible label. */
function AdCaption() {
  return (
    <p className="mb-1.5 flex min-w-0 items-center gap-1.5 pl-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
      <Megaphone className="h-3 w-3" aria-hidden />
      Advertisement
    </p>
  );
}

/** Whole-creative link. Every click goes through the counted redirect. */
function ClickLayer({ ad }: { ad: AdDTO }) {
  return (
    <a href={ad.href} rel="sponsored nofollow noopener" className="absolute inset-0 z-[1] rounded-[inherit]">
      <span className="sr-only">
        {ad.headline}. {ad.ctaLabel} (sponsored, opens {ad.advertiser})
      </span>
    </a>
  );
}

/* ------------------------------------------------------------------ */
/* Large banner carousel (hero / search / footer)                      */
/* ------------------------------------------------------------------ */

function BannerCreative({ ad, big }: { ad: AdDTO; big: boolean }) {
  const ref = useImpression(ad.id, true);
  const ratio = big ? "aspect-[16/9] sm:aspect-[1600/640]" : "aspect-[16/7] sm:aspect-[1600/420]";
  return (
    <article ref={ref as never} aria-label={`Sponsored: ${ad.headline}`} {...parallax(8)} className={cn("relative isolate flex w-full overflow-hidden rounded-[20px] border border-line bg-night text-white transition-shadow duration-500 hover:shadow-[0_30px_80px_-30px_rgba(49,86,211,0.6)]", ratio, !big && "min-h-[150px]")}>
      {ad.imageUrl ? (
        <>
          <img src={ad.imageUrl} alt={ad.imageAlt ?? ad.headline} width={1600} height={640} loading="eager" decoding="async" className="ad-kenburns absolute -inset-1.5 h-[calc(100%+0.75rem)] w-[calc(100%+0.75rem)] max-w-none object-cover transition-[translate] duration-300 ease-out [translate:calc(var(--px,0)*1px)_calc(var(--py,0)*1px)]" />
          <Shine />
          <ClickLayer ad={ad} />
        </>
      ) : (
        <>
          <div aria-hidden className="absolute inset-0 bg-[radial-gradient(70%_120%_at_0%_0%,rgb(99_91_255/0.55),transparent_60%),radial-gradient(60%_100%_at_100%_100%,rgb(49_86_211/0.55),transparent_65%)]" />
          <div aria-hidden className="absolute inset-0 opacity-30 [background-image:linear-gradient(to_right,rgb(255_255_255/0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.08)_1px,transparent_1px)] [background-size:36px_36px] [mask-image:linear-gradient(to_right,#000,transparent_80%)]" />
          <div className="relative flex w-full flex-col justify-between gap-4 p-5 sm:flex-row sm:items-end sm:p-8">
            <div className="max-w-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/70">{ad.advertiser}</p>
              <h3 className="mt-2 text-xl text-white sm:text-3xl">{ad.headline}</h3>
              {ad.description && <p className="mt-1.5 line-clamp-2 text-sm text-slate-200 sm:text-base">{ad.description}</p>}
            </div>
            <span className="inline-flex h-11 items-center gap-2 self-start rounded-button bg-white px-4 text-sm font-medium text-night sm:self-end">
              {ad.ctaLabel}
              <ArrowUpRight className="h-4 w-4" aria-hidden />
            </span>
            <ClickLayer ad={ad} />
          </div>
        </>
      )}
    </article>
  );
}

const ROTATE_MS = 3800;
const DISMISS = "sd:ad-dismissed";
const readDismissed = (): string[] => {
  try {
    return JSON.parse(sessionStorage.getItem(DISMISS) ?? "[]") as string[];
  } catch {
    return [];
  }
};

const roundBtn = "flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow-md backdrop-blur transition-[background-color,transform] hover:bg-white active:scale-95";

export function AdBanner({ placement, fallback, dismissible, big, className }: { placement: AdPlacement; fallback?: boolean; dismissible?: boolean; big?: boolean; className?: string }) {
  const api = useApi();
  const { data: ads = [] } = useQuery(adsQuery(api, placement));
  usePreloadImages(ads);
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const [paused, setPaused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (dismissible) setDismissed(readDismissed().includes(placement));
  }, [dismissible, placement]);

  const n = ads.length;
  const go = useCallback(
    (d: number) => {
      setDir(d >= 0 ? 1 : -1);
      setI((x) => (x + d + n) % n);
    },
    [n],
  );
  // Auto-rotation only when allowed: more than one ad, not paused by hover/focus, no reduced-motion preference.
  useEffect(() => {
    if (n < 2 || paused || reduced.current) return;
    // The index is in the deps so the timer restarts after every change, including manual ones.
    const t = setTimeout(() => {
      setDir(1);
      setI((x) => (x + 1) % n);
    }, ROTATE_MS);
    return () => clearTimeout(t);
  }, [n, paused, i]);

  if (dismissed) return null;
  const close = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS, JSON.stringify([...readDismissed(), placement]));
    } catch {
      /* ignore */
    }
  };

  if (n === 0) {
    if (!fallback) return null;
    // House banner when no paid campaign is live. Labelled as an advertisement, never as content.
    return (
      <aside aria-label="Advertisement" className={className}>
        <div className="relative flex min-h-[150px] flex-col justify-between gap-4 overflow-hidden rounded-[20px] border border-dashed border-line-strong bg-white p-5 sm:flex-row sm:items-center sm:p-7">
          <div>
            <p className="inline-flex items-center gap-1.5 rounded-full bg-slate-900/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-700">
              <Megaphone className="h-3 w-3" aria-hidden /> Advertisement
            </p>
            <h3 className="mt-3 text-xl sm:text-2xl">Your brand could be here.</h3>
            <p className="mt-1.5 max-w-xl text-sm text-body">Reach distributors and business buyers with a clearly labelled, measurable placement.</p>
          </div>
          <Button asChild>
            <Link to="/advertising">Advertise with us</Link>
          </Button>
        </div>
      </aside>
    );
  }

  const idx = Math.min(i, n - 1);
  const ad = ads[idx]!;
  return (
    <aside
      aria-label="Advertisement"
      aria-roledescription="carousel"
      className={cn("relative", className)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <AdCaption />
      <div className="relative overflow-hidden rounded-[20px]">
      <AnimatePresence initial={false} custom={dir} mode="popLayout">
        <m.div
          key={ad.id}
          custom={dir}
          variants={{
            enter: (d: number) => ({ x: `${d * 100}%`, opacity: 0.6 }),
            center: { x: 0, opacity: 1 },
            exit: (d: number) => ({ x: `${d * -100}%`, opacity: 0.6 }),
          }}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ type: "spring", stiffness: 260, damping: 30, mass: 0.85 }}
        >
          <BannerCreative ad={ad} big={!!big} />
        </m.div>
      </AnimatePresence>

      {n > 1 && (
        <>
          <button type="button" onClick={() => go(-1)} aria-label="Previous advertisement" className={cn(roundBtn, "absolute left-3 top-1/2 z-10 -translate-y-1/2 sm:left-4")}>
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
          <button type="button" onClick={() => go(1)} aria-label="Next advertisement" className={cn(roundBtn, "absolute right-3 top-1/2 z-10 -translate-y-1/2 sm:right-4")}>
            <ChevronRight className="h-5 w-5" aria-hidden />
          </button>
          <div role="group" aria-label="Choose advertisement" className="absolute inset-x-0 bottom-3 z-10 flex items-center justify-center gap-2">
            {ads.map((a, k) => (
              <button
                key={a.id}
                type="button"
                onClick={() => {
                  setDir(k >= idx ? 1 : -1);
                  setI(k);
                }}
                aria-label={`Show advertisement ${k + 1} of ${n}`}
                aria-current={k === idx}
                className={cn("relative h-2 overflow-hidden rounded-full bg-white/60 shadow transition-[width] duration-300", k === idx ? "w-9" : "w-2 hover:bg-white")}
              >
                {k === idx && <span key={`${ad.id}-${i}`} className="ad-progress absolute inset-y-0 left-0 rounded-full bg-white" style={{ animationDuration: `${ROTATE_MS}ms`, animationPlayState: paused ? "paused" : "running" }} />}
              </button>
            ))}
          </div>
        </>
      )}
      {dismissible && (
        <button type="button" onClick={close} aria-label="Dismiss advertisement" className={cn(roundBtn, "absolute right-3 top-3 z-10 h-8 w-8")}>
          <X className="h-4 w-4" aria-hidden />
        </button>
      )}
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* Spotlight: up to two sponsored cards side by side                   */
/* ------------------------------------------------------------------ */

function SpotlightCard({ ad }: { ad: AdDTO }) {
  const ref = useImpression(ad.id, true);
  return (
    <li className="min-w-0 list-none">
      <AdCaption />
      <m.article
        ref={ref as never}
        whileHover={{ y: -3 }}
        transition={{ type: "spring", stiffness: 420, damping: 30 }}
        aria-label={`Sponsored: ${ad.headline}`}
        {...parallax(6)}
        className="group/ad relative isolate flex aspect-[2/1] min-h-[170px] w-full overflow-hidden rounded-[18px] border border-line bg-white shadow-card transition-[box-shadow,border-color] duration-300 hover:border-primary/40 hover:shadow-[0_26px_60px_-26px_rgba(49,86,211,0.55)]"
      >
        {ad.imageUrl ? (
          <>
            <img src={ad.imageUrl} alt={ad.imageAlt ?? ad.headline} width={1000} height={500} loading="lazy" decoding="async" className="absolute -inset-1.5 h-[calc(100%+0.75rem)] w-[calc(100%+0.75rem)] max-w-none object-cover transition-[translate,scale] duration-500 ease-out [translate:calc(var(--px,0)*1px)_calc(var(--py,0)*1px)] group-hover/ad:scale-[1.015]" />
            <Shine delay="2.5s" />
          </>
        ) : (
          <div className="relative flex w-full flex-col p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{ad.advertiser}</p>
            <h3 className="mt-2 text-lg">{ad.headline}</h3>
            {ad.description && <p className="mt-1.5 line-clamp-2 text-sm text-muted">{ad.description}</p>}
            <span className="mt-auto inline-flex items-center gap-1.5 pt-3 text-sm font-semibold text-primary">
              {ad.ctaLabel}
              <ArrowUpRight className="h-4 w-4" aria-hidden />
            </span>
          </div>
        )}
        <ClickLayer ad={ad} />
      </m.article>
    </li>
  );
}

export function AdSpotlight({ className }: { className?: string }) {
  const api = useApi();
  const { data: ads = [] } = useQuery(adsQuery(api, "HOME_SPOTLIGHT"));
  usePreloadImages(ads);
  if (!ads.length) return null;
  return (
    <aside aria-label="Advertisements" className={className}>
      <ul className={cn("grid grid-cols-[minmax(0,1fr)] gap-5", ads.length > 1 && "md:grid-cols-2")}>
        {ads.slice(0, 2).map((ad) => (
          <SpotlightCard key={ad.id} ad={ad} />
        ))}
      </ul>
    </aside>
  );
}
