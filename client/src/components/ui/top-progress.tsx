import { useIsFetching, useIsMutating } from "@tanstack/react-query";
import { useEffect, useState } from "react";

/**
 * Thin bar at the top of the viewport while data loads or a form submits.
 * Waits 150 ms before showing so fast responses don't flash, and lingers briefly to finish its sweep.
 */
export function TopProgress() {
  const busy = useIsFetching() + useIsMutating() > 0;
  const [phase, setPhase] = useState<"idle" | "loading" | "done">("idle");

  useEffect(() => {
    if (busy) {
      const t = setTimeout(() => setPhase("loading"), 150);
      return () => clearTimeout(t);
    }
    if (phase !== "loading") return;
    setPhase("done");
    const t = setTimeout(() => setPhase("idle"), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy]);

  if (phase === "idle") return null;
  return (
    <div className="top-progress" data-phase={phase} role="progressbar" aria-label="Loading" aria-busy={phase === "loading"}>
      <div className="top-progress-bar" />
    </div>
  );
}
