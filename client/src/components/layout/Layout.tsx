import { ChevronRight, WifiOff } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useOnlineStatus } from "@/lib/utils";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

export function Layout({ children }: { children: ReactNode }) {
  const online = useOnlineStatus();
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <SiteHeader />
      {!online && (
        <div role="status" className="flex items-center justify-center gap-2 bg-amber-100 px-4 py-2 text-sm font-medium text-amber-900">
          <WifiOff className="h-4 w-4" aria-hidden /> You are offline. Showing the last results loaded; new searches will resume when you reconnect.
        </div>
      )}
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}

export function Breadcrumbs({ items }: { items: Array<{ name: string; to?: string }> }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm">
      <ol className="scrollbar-none relative -mx-4 flex items-center gap-1.5 overflow-x-auto whitespace-nowrap px-4 text-muted sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={item.name} className="flex shrink-0 items-center gap-1.5">
              {item.to && !last ? (
                <Link to={item.to} className="inline-flex min-h-11 items-center rounded transition-colors hover:text-primary sm:min-h-0">
                  {item.name}
                </Link>
              ) : (
                <span aria-current={last ? "page" : undefined} className={last ? "font-medium text-ink" : undefined}>
                  {item.name}
                </span>
              )}
              {!last && <ChevronRight className="h-3.5 w-3.5 text-slate-400" aria-hidden />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
