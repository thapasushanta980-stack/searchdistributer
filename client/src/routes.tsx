import type { QueryClient } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { parseProductSearch, parseRequirementSearch, parseSearch, type ApiClient } from "@sd/shared";
import { adsQuery, categoriesQuery, distributorQuery, distributorsQuery, facetsQuery, featuredQuery, productQuery, productsQuery, requirementQuery, requirementsQuery } from "@/lib/queries";
import { CategoriesPage, CategoryPage } from "@/pages/CategoryPages";
import { DistributorsPage } from "@/pages/DistributorsPage";
import { SHOWCASE_COMPANIES, SHOWCASE_PRODUCTS } from "@/components/home/Showcase";
import { HOME_LEADS, HomePage } from "@/pages/HomePage";
import { AboutPage, AdvertisingPage, HelpPage, LeadPage, LegalPage, LoginPage, PricingPage } from "@/pages/InfoPages";
import { BrandsPage } from "@/pages/BrandsPage";
import { LeadDetailPage, LeadsPage } from "@/pages/LeadPages";
import { ProductDetailPage, ProductsPage } from "@/pages/ProductPages";
import { PostRequirementPage } from "@/pages/RequirementPages";
import { ProfilePage } from "@/pages/ProfilePage";
import { VerifyEnquiryPage } from "@/pages/VerifyEnquiryPage";

interface PrefetchCtx {
  qc: QueryClient;
  api: ApiClient;
  params: Record<string, string>;
  search: URLSearchParams;
}

export interface AppRoute {
  path: string;
  element: ReactElement;
  /** Data the page needs on first paint. Server renders with it; the client hydrates from it. */
  prefetch?: (ctx: PrefetchCtx) => Promise<unknown>;
}

export const routes: AppRoute[] = [
  {
    path: "/",
    element: <HomePage />,
    prefetch: ({ qc, api }) =>
      Promise.all([
        qc.prefetchQuery(categoriesQuery(api)),
        qc.prefetchQuery(requirementsQuery(api, HOME_LEADS)),
        qc.prefetchQuery(distributorsQuery(api, SHOWCASE_COMPANIES)),
        qc.prefetchQuery(productsQuery(api, SHOWCASE_PRODUCTS)),
        qc.prefetchQuery(adsQuery(api, "HOME_HERO_BANNER")),
        qc.prefetchQuery(adsQuery(api, "HOME_SPOTLIGHT")),
        qc.prefetchQuery(adsQuery(api, "HOME_FOOTER_BANNER")),
      ]),
  },
  {
    path: "/distributors",
    element: <DistributorsPage />,
    prefetch: ({ qc, api, search }) =>
      Promise.all([
        qc.prefetchQuery(distributorsQuery(api, parseSearch(search))),
        qc.prefetchQuery(categoriesQuery(api)),
        qc.prefetchQuery(facetsQuery(api)),
        qc.prefetchQuery(featuredQuery(api)),
        qc.prefetchQuery(adsQuery(api, "SEARCH_TOP_BANNER")),
      ]),
  },
  {
    path: "/distributors/:slug",
    element: <ProfilePage />,
    prefetch: ({ qc, api, params }) => qc.prefetchQuery(distributorQuery(api, params.slug!)),
  },
  { path: "/categories", element: <CategoriesPage />, prefetch: ({ qc, api }) => qc.prefetchQuery(categoriesQuery(api)) },
  {
    path: "/categories/:slug",
    element: <CategoryPage />,
    prefetch: ({ qc, api, params, search }) =>
      Promise.all([
        qc.prefetchQuery(distributorsQuery(api, { ...parseSearch(search), category: [params.slug!] })),
        qc.prefetchQuery(categoriesQuery(api)),
        qc.prefetchQuery(facetsQuery(api)),
        qc.prefetchQuery(featuredQuery(api)),
      ]),
  },
  {
    path: "/products",
    element: <ProductsPage />,
    prefetch: ({ qc, api, search }) => Promise.all([qc.prefetchQuery(productsQuery(api, parseProductSearch(search))), qc.prefetchQuery(categoriesQuery(api))]),
  },
  { path: "/products/:slug", element: <ProductDetailPage />, prefetch: ({ qc, api, params }) => qc.prefetchQuery(productQuery(api, params.slug!)) },
  {
    path: "/brands",
    element: <BrandsPage />,
    prefetch: ({ qc, api, search }) =>
      Promise.all([
        qc.prefetchQuery(distributorsQuery(api, { ...parseSearch(search), businessType: ["MANUFACTURER"] })),
        qc.prefetchQuery(categoriesQuery(api)),
        qc.prefetchQuery(facetsQuery(api)),
      ]),
  },
  { path: "/brands/:slug", element: <ProfilePage />, prefetch: ({ qc, api, params }) => qc.prefetchQuery(distributorQuery(api, params.slug!)) },
  {
    path: "/leads",
    element: <LeadsPage />,
    prefetch: ({ qc, api, search }) => Promise.all([qc.prefetchQuery(requirementsQuery(api, parseRequirementSearch(search))), qc.prefetchQuery(categoriesQuery(api))]),
  },
  { path: "/leads/:slug", element: <LeadDetailPage />, prefetch: ({ qc, api, params }) => qc.prefetchQuery(requirementQuery(api, params.slug!)) },
  { path: "/post-requirement", element: <PostRequirementPage />, prefetch: ({ qc, api }) => qc.prefetchQuery(categoriesQuery(api)) },
  { path: "/about", element: <AboutPage /> },
  { path: "/cookies", element: <LegalPage kind="cookies" /> },
  { path: "/pricing", element: <PricingPage /> },
  { path: "/advertising", element: <AdvertisingPage /> },
  { path: "/help", element: <HelpPage /> },
  { path: "/terms", element: <LegalPage kind="terms" /> },
  { path: "/privacy", element: <LegalPage kind="privacy" /> },
  { path: "/contact", element: <LeadPage kind="contact" />, prefetch: ({ qc, api }) => qc.prefetchQuery(categoriesQuery(api)) },
  { path: "/register", element: <LeadPage kind="register" />, prefetch: ({ qc, api }) => qc.prefetchQuery(categoriesQuery(api)) },
  { path: "/login", element: <LoginPage /> },
  { path: "/enquiries/verify", element: <VerifyEnquiryPage /> },
];
