import { Compass } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useSite } from "@/lib/context";
import { PageHead } from "@/seo/head";
import { notFoundSpec } from "@/seo/builders";

export function NotFoundPage() {
  const site = useSite();
  const { pathname } = useLocation();
  return (
    <>
      <PageHead spec={notFoundSpec(site, pathname)} site={site} />
      <div className="container-page py-24 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <Compass className="h-7 w-7" aria-hidden />
        </span>
        <h1 className="mt-5 text-3xl sm:text-4xl">Page not found</h1>
        <p className="mx-auto mt-3 max-w-md text-muted">The page you were looking for does not exist or has moved. Try searching for a distributor instead.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild>
            <Link to="/distributors">Find distributors</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link to="/categories">Browse categories</Link>
          </Button>
        </div>
      </div>
    </>
  );
}
