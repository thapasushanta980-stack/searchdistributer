import { createContext, useContext, type ReactNode } from "react";
import type { ApiClient, SiteConfigDTO } from "@sd/shared";

const ApiContext = createContext<ApiClient | null>(null);
const SiteContext = createContext<SiteConfigDTO | null>(null);

export function AppContextProvider({ api, site, children }: { api: ApiClient; site: SiteConfigDTO; children: ReactNode }) {
  return (
    <ApiContext.Provider value={api}>
      <SiteContext.Provider value={site}>{children}</SiteContext.Provider>
    </ApiContext.Provider>
  );
}

export function useApi(): ApiClient {
  const api = useContext(ApiContext);
  if (!api) throw new Error("ApiContext missing");
  return api;
}

export function useSite(): SiteConfigDTO {
  const site = useContext(SiteContext);
  if (!site) throw new Error("SiteContext missing");
  return site;
}
