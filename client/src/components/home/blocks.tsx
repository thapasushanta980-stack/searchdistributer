import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";

/** Closing call to action shared by listing pages and the homepage. */
export function CtaBand({ headline = "Ready to find your next distribution opportunity?", text = "Search smarter. Connect faster. Grow your distribution network." }: { headline?: string; text?: string }) {
  return (
    <Reveal as="section" className="container-page pb-16">
      <div className="relative overflow-hidden rounded-[28px] bg-night px-6 py-14 text-center sm:px-12 sm:py-16">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_50%_0%,rgb(49_86_211/0.45),transparent_70%)]" />
        <div className="relative">
          <h2 className="mx-auto max-w-2xl text-3xl text-white sm:text-4xl">{headline}</h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-slate-300">{text}</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
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
