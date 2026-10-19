import { useEffect, useRef } from "react";
import type { TrackEvent } from "@sd/shared";

const recent = new Map<string, number>();
const REPEAT_WINDOW_MS = 30 * 60_000;

/**
 * Report an anonymous usage event for the admin analytics. Never throws and never delays the page:
 * it rides navigator.sendBeacon, and an identical event within 30 minutes in this tab is skipped,
 * so back-and-forth navigation doesn't inflate the numbers.
 */
export function track(event: TrackEvent): void {
  if (typeof window === "undefined") return;
  const key = JSON.stringify(event);
  const now = Date.now();
  const last = recent.get(key);
  if (last && now - last < REPEAT_WINDOW_MS) return;
  recent.set(key, now);
  try {
    const body = new Blob([key], { type: "application/json" });
    if (!navigator.sendBeacon?.("/api/v1/events", body)) {
      void fetch("/api/v1/events", { method: "POST", body, keepalive: true, headers: { "content-type": "application/json" } }).catch(() => undefined);
    }
  } catch {
    // Analytics must never break the page.
  }
}

/**
 * Records a search once its results have settled for a moment, so typing "t", "te", "tea" counts once as "tea".
 * Pass `ready: false` while results are loading or are placeholders from the previous query.
 */
export function useTrackSearch(event: Extract<TrackEvent, { type: "SEARCH" }> | null, ready: boolean, settleMs = 1200) {
  const key = event ? JSON.stringify(event) : "";
  const latest = useRef(event);
  latest.current = event;
  useEffect(() => {
    if (!ready || !latest.current) return;
    const e = latest.current;
    // Plain browsing (no keyword, place or category) is a page view, not a search.
    if (!e.query && !e.location && !e.categorySlug) return;
    const t = setTimeout(() => track(e), settleMs);
    return () => clearTimeout(t);
  }, [key, ready, settleMs]);
}

/** Records a page view once per mount for the given id. */
export function useTrackView(event: TrackEvent | null) {
  const key = event ? JSON.stringify(event) : "";
  useEffect(() => {
    if (event) track(event);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
