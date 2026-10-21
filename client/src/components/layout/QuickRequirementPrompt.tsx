import { MessageCircle, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { matchPath, useLocation } from "react-router-dom";
import type { QuickIntent } from "@/components/forms/QuickRequirementDialog";
import { useSite } from "@/lib/context";
import { lazyClient } from "@/lib/lazyClient";
import { useHydrated } from "@/lib/useSearchState";

const dialog = lazyClient<{ open: boolean; onClose: () => void; onSubmitted: () => void; initialIntent?: QuickIntent }>(() =>
  import("@/components/forms/QuickRequirementDialog").then((m) => ({ default: m.QuickRequirementDialog })),
);

const STORAGE_KEY = "sd-quick-requirement";
const SNOOZE_MS = 7 * 86_400_000;
const DESKTOP_DELAY_MS = 3_000;
const MOBILE_DELAY_MS = 5_000;
const OPEN_EVENT = "sd:quick-requirement";

/** Pages that already are a form, or a flow the prompt must not interrupt. */
const NEVER_ON = ["/register", "/contact", "/post-requirement", "/enquiries/*", "/login", "/terms", "/privacy", "/cookies"];
/** Pages with their own sticky mobile action bar: no mobile teaser or chat bubble there. */
const STICKY_BAR = ["/distributors/:slug", "/brands/:slug", "/products/:slug"];
const onAny = (patterns: string[], pathname: string) => patterns.some((p) => matchPath({ path: p, end: true }, pathname));

interface Memory {
  dismissedAt?: number;
  submitted?: boolean;
}
const read = (): Memory => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Memory;
  } catch {
    return {};
  }
};
const write = (m: Memory) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(m));
  } catch {
    // Private mode or blocked storage: the prompt may show again next visit, which is acceptable.
  }
};

/** Open the quick requirement form from anywhere (e.g. a "Get matched" button). */
export function openQuickRequirement(intent: QuickIntent = "FIND_DISTRIBUTORS") {
  window.dispatchEvent(new CustomEvent<QuickIntent>(OPEN_EVENT, { detail: intent }));
}

/**
 * The timed "tell us your requirement" prompt, plus the "Chat with us" WhatsApp button.
 * Desktop: the form opens once, 3 s into the visit. Mobile: a small bar slides up instead of a full-screen
 * pop-up (Google penalises intrusive mobile interstitials). Closing it snoozes it for 7 days; submitting stops it.
 */
export function QuickRequirementPrompt() {
  const hydrated = useHydrated();
  const site = useSite();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [intent, setIntent] = useState<QuickIntent>("FIND_DISTRIBUTORS");
  const [teaser, setTeaser] = useState(false);
  const [mobile, setMobile] = useState(false);

  const blocked = onAny(NEVER_ON, pathname);
  const stickyPage = onAny(STICKY_BAR, pathname);

  useEffect(() => {
    if (!hydrated) return;
    const mq = window.matchMedia("(max-width: 639px)");
    const sync = () => setMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [hydrated]);

  // Explicit requests (buttons around the site) always open the form.
  useEffect(() => {
    const onOpen = (e: Event) => {
      setIntent((e as CustomEvent<QuickIntent>).detail ?? "FIND_DISTRIBUTORS");
      setTeaser(false);
      setOpen(true);
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  // The timed prompt: once per visit, not on excluded pages, not while another dialog is open.
  useEffect(() => {
    if (!hydrated) return;
    const m = read();
    if (m.submitted || (m.dismissedAt && Date.now() - m.dismissedAt < SNOOZE_MS)) return;
    const t = setTimeout(
      () => {
        if (onAny(NEVER_ON, window.location.pathname) || document.querySelector('[role="dialog"]')) return;
        if (mobile) setTeaser(true);
        else setOpen(true);
      },
      mobile ? MOBILE_DELAY_MS : DESKTOP_DELAY_MS,
    );
    return () => clearTimeout(t);
  }, [hydrated, mobile]);

  const dismiss = useCallback(() => {
    write({ ...read(), dismissedAt: Date.now() });
    setOpen(false);
    setTeaser(false);
  }, []);
  const submitted = useCallback(() => write({ ...read(), submitted: true }), []);

  if (!hydrated) return null;
  const showTeaser = teaser && !open && !blocked && !stickyPage;
  const showChat = site.supportWhatsapp && !open && !(mobile && (stickyPage || showTeaser));

  return (
    <>
      {/* Mounted only while open, so its code downloads on first use rather than on every page. */}
      {open && <dialog.Component open onClose={dismiss} onSubmitted={submitted} initialIntent={intent} />}

      {showTeaser && (
        <div role="region" aria-label="Get matched" className="anim-rise fixed inset-x-3 bottom-3 z-40 flex items-center gap-3 rounded-card border border-line bg-surface p-3 pl-4 shadow-2xl sm:hidden">
          <Sparkles className="h-5 w-5 shrink-0 text-primary" aria-hidden />
          <button type="button" onClick={() => setOpen(true)} className="min-w-0 flex-1 text-left">
            <span className="block text-sm font-semibold text-ink">Need distributors or a distributorship?</span>
            <span className="block text-xs text-muted">Tell us in 30 seconds. We'll match you, free.</span>
          </button>
          <button type="button" onClick={dismiss} aria-label="Not now" className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted hover:bg-slate-100">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
      )}

      {showChat && (
        <a
          href="/go/support"
          target="_blank"
          rel="noopener nofollow"
          className="fixed bottom-4 right-4 z-40 inline-flex h-12 items-center gap-2 rounded-full bg-[#128C7E] px-4 text-sm font-semibold text-white shadow-2xl transition-colors hover:bg-[#075E54] sm:bottom-6 sm:right-6"
        >
          <MessageCircle className="h-5 w-5" aria-hidden />
          <span className="max-sm:sr-only">Chat with us</span>
          <span className="sr-only"> on WhatsApp (opens WhatsApp)</span>
        </a>
      )}
    </>
  );
}
