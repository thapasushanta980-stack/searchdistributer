import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";

/** Closing call to action shared by listing pages and the homepage. */
export function CtaBand({ headline = "Ready to find your next distribution opportunity?", text = "Search smarter. Connect faster. Grow your distribution network." }: { headline?: string; text?: string }) {
  return (
    <Reveal as="section" className="container-page pb-10 sm:pb-16">
      <div className="relative overflow-hidden rounded-[20px] bg-night px-5 py-9 text-center sm:rounded-[28px] sm:px-12 sm:py-16">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_50%_0%,rgb(49_86_211/0.45),transparent_70%)]" />
        <div className="relative">
          <h2 className="mx-auto max-w-2xl text-2xl text-white sm:text-4xl">{headline}</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-slate-300 sm:mt-4 sm:text-base">{text}</p>
          <div className="mt-6 flex flex-col items-stretch justify-center gap-3 sm:mt-8 sm:flex-row sm:items-center">
            <Button asChild variant="dark" size="lg">
              <Link to="/distributors">Start Searching</Link>
            </Button>
            <Button asChild variant="outlineLight" size="lg">
              <Link to="/register">Register Your Business</Link>
            </Button>
          </div>
        </div>
      </div>
    </Reveal>
  );
}
