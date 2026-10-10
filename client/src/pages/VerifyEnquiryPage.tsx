import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useSite } from "@/lib/context";
import { ApiError, verifyEnquiryToken } from "@/lib/api";
import { PageHead } from "@/seo/head";
import { abs } from "@/seo/builders";

type State = { kind: "loading" } | { kind: "ok"; reference: string; name: string } | { kind: "error"; message: string };

export function VerifyEnquiryPage() {
  const site = useSite();
  const [sp] = useSearchParams();
  const token = sp.get("token") ?? "";
  const [state, setState] = useState<State>(token ? { kind: "loading" } : { kind: "error", message: "This confirmation link is incomplete." });
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    verifyEnquiryToken(token)
      .then((r) => setState({ kind: "ok", reference: r.reference, name: r.distributorName }))
      .catch((err) => setState({ kind: "error", message: err instanceof ApiError ? err.message : "We could not confirm your enquiry. Please try again." }));
  }, [token]);

  return (
    <>
      <PageHead spec={{ title: "Confirm your enquiry | Search Distributors", description: "Confirm your email address to deliver your enquiry.", canonical: abs(site, "/enquiries/verify"), robots: "noindex,nofollow" }} site={site} />
      <div className="container-page max-w-xl py-20 text-center" role="status" aria-live="polite">
        {state.kind === "loading" && (
          <>
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" aria-hidden />
            <h1 className="mt-5 text-2xl">Confirming your enquiry…</h1>
          </>
        )}
        {state.kind === "ok" && (
          <>
            <CheckCircle2 className="mx-auto h-14 w-14 text-success" aria-hidden />
            <h1 className="mt-5 text-3xl">Enquiry sent successfully</h1>
            <p className="mt-3 text-slate-600">
              Your email is confirmed and {state.name} can now contact you using the information you provided.
            </p>
            <p className="mt-4 text-sm">
              Reference <strong className="font-mono">{state.reference}</strong>
            </p>
            <Button asChild className="mt-7">
              <Link to="/distributors">Continue searching</Link>
            </Button>
          </>
        )}
        {state.kind === "error" && (
          <>
            <AlertCircle className="mx-auto h-14 w-14 text-danger" aria-hidden />
            <h1 className="mt-5 text-3xl">We couldn’t confirm this enquiry</h1>
            <p className="mt-3 text-slate-600">{state.message}</p>
            <Button asChild className="mt-7">
              <Link to="/distributors">Back to search</Link>
            </Button>
          </>
        )}
      </div>
    </>
  );
}
