import { QueryClient, QueryClientProvider, hydrate, type DehydratedState } from "@tanstack/react-query";
import { hydrateRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import type { SiteConfigDTO } from "@sd/shared";
import { App } from "./App";
import { browserApi } from "./lib/api";
import { AppContextProvider } from "./lib/context";
import "./index.css";

const stateEl = document.getElementById("__SD_STATE__");
const state = JSON.parse(stateEl?.textContent || "{}") as { query?: DehydratedState; site: SiteConfigDTO };

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
});
if (state.query) hydrate(queryClient, state.query);

// Intentionally not wrapped in <StrictMode>: effects such as email confirmation must run once.
hydrateRoot(
  document.getElementById("root")!,
  <QueryClientProvider client={queryClient}>
    <AppContextProvider api={browserApi} site={state.site}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AppContextProvider>
  </QueryClientProvider>,
);
