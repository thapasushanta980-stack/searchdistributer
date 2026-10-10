import { Link } from "react-router-dom";
import type { HeadSpec } from "@sd/shared";
import { LazyRequirementWizard } from "@/components/forms/lazy";
import { Breadcrumbs } from "@/components/layout/Layout";
import { Skeleton } from "@/components/ui/misc";
import { useSite } from "@/lib/context";
import { useHydrated } from "@/lib/useSearchState";
import { PageHead } from "@/seo/head";
import { abs, breadcrumbLd } from "@/seo/builders";

export function PostRequirementPage() {
  const site = useSite();
  const hydrated = useHydrated();
  const spec: HeadSpec = {
    title: "Post a Requirement | Search Distributors",
    description: "Tell businesses what you are looking for. Submit your requirement and let relevant distributors or brands discover your opportunity.",
    canonical: abs(site, "/post-requirement"),
    robots: "index,follow",
    jsonLd: [
      breadcrumbLd(site, [
        { name: "Home", path: "/" },
        { name: "Post a Requirement", path: "/post-requirement" },
      ]),
    ],
  };
  return (
    <>
      <PageHead spec={spec} site={site} />
      <div className="container-page max-w-3xl py-10 sm:py-14">
        <Breadcrumbs items={[{ name: "Home", to: "/" }, { name: "Post a Requirement" }]} />
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-primary">POST A REQUIREMENT</p>
        <h1 className="mt-3 text-3xl sm:text-4xl">Tell businesses what you are looking for.</h1>
        <p className="mt-3 text-lg text-body">Submit your requirement and let relevant distributors or brands discover your opportunity.</p>
        <p className="mt-2 text-sm text-muted">
          Requirements are reviewed before they are published. Your contact details stay private.{" "}
          <Link to="/leads" className="font-medium text-primary hover:underline">
            See current opportunities
          </Link>
        </p>
        <div className="mt-8">{hydrated ? <LazyRequirementWizard /> : <Skeleton className="h-[480px] w-full rounded-card" />}</div>
      </div>
    </>
  );
}
