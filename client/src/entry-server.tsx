import { QueryClient, QueryClientProvider, dehydrate } from "@tanstack/react-query";
import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router";
import { matchPath } from "react-router-dom";
import type { ApiClient, HeadSpec, SiteConfigDTO } from "@sd/shared";
import { App } from "./App";
import { AppContextProvider } from "./lib/context";
import { HeadCollectorContext, headToHtml, safeJson, type HeadCollector } from "./seo/head";
import { routes } from "./routes";
import { categoriesQuery } from "./lib/queries";

interface RenderOptions {
  url: string;
  api: ApiClient;
  site: SiteConfigDTO;
}

export async function render({ url, api, site }: RenderOptions) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: false } } });
  const { pathname, searchParams } = new URL(url, "http://local");

  await queryClient.prefetchQuery(categoriesQuery(api));
  for (const route of routes) {
    const match = matchPath({ path: route.path, end: true }, pathname);
    if (match && route.prefetch) {
      await route.prefetch({ qc: queryClient, api, params: match.params as Record<string, string>, search: searchParams });
      break;
    }
  }

  const collector: HeadCollector = { spec: null };
  const html = renderToString(
    <HeadCollectorContext.Provider value={collector}>
      <QueryClientProvider client={queryClient}>
        <AppContextProvider api={api} site={site}>
          <StaticRouter location={url}>
            <App />
          </StaticRouter>
        </AppContextProvider>
      </QueryClientProvider>
    </HeadCollectorContext.Provider>,
  );

  const spec: HeadSpec = collector.spec ?? {
    title: "Search Distributor",
    description: "Find distributors and business partners by product, category and location.",
    canonical: site.siteUrl + pathname,
    robots: "noindex,follow",
  };

  const state = { query: dehydrate(queryClient), site };
  return {
    html,
    head: headToHtml(spec, site),
    state: `<script type="application/json" id="__SD_STATE__">${safeJson(state)}</script>`,
    status: spec.status ?? 200,
  };
}
