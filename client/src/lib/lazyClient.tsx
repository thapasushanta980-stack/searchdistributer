import { lazy, Suspense, useEffect, type ComponentType, type ReactNode } from "react";
import { useHydrated } from "./useSearchState";

interface Loadable<P> {
  Component: ComponentType<P>;
  /** Start downloading the chunk ahead of use (idle time / hover). */
  preload: () => void;
}

/**
 * Code-split a component that is only needed after user interaction or after hydration.
 * It renders nothing on the server and on the first client render (so hydration matches),
 * then mounts the lazy chunk.
 */
export function lazyClient<P extends object>(loader: () => Promise<{ default: ComponentType<P> }>, fallback: ReactNode = null): Loadable<P> {
  const Lazy = lazy(loader);
  const Component = (props: P) => {
    const hydrated = useHydrated();
    return hydrated ? (
      <Suspense fallback={fallback}>
        <Lazy {...(props as P & object)} />
      </Suspense>
    ) : null;
  };
  return { Component, preload: () => void loader() };
}

/** Preload a chunk once the browser is idle after the page has loaded. */
export function usePreloadWhenIdle(preload: () => void) {
  useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(preload, { timeout: 4000 });
      return () => (window as Window & { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback?.(id);
    }
    const t = setTimeout(preload, 2500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
