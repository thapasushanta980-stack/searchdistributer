import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Reveal } from "@/components/ui/reveal";
import { Button } from "@/components/ui/button";
import type { CategoryDTO } from "@sd/shared";

export function HeroShell({ eyebrow, headline, highlight, sub, children, top }: { eyebrow: string; headline: string; highlight: string; sub: string; children: ReactNode; top?: ReactNode }) {
  return (
    <section className="relative isolate">
      <div className="hero-bg" aria-hidden>
        <div className="hero-grid" />
      </div>
      <div className="mx-auto max-w-[1200px] px-4 pb-8 pt-4 sm:px-6 sm:pb-16 sm:pt-6">
        {top && <div className="mb-5 sm:mb-10">{top}</div>}
        <div className="mx-auto max-w-3xl text-center">
          <p className="anim-rise text-xs font-bold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
          <h1 className="anim-rise mt-3 text-[1.75rem] leading-[1.12] tracking-tight sm:mt-4 sm:text-5xl lg:text-[3.5rem]" style={{ animationDelay: "60ms" }}>
            {headline}
            <br />
            <span className="text-primary">{highlight}</span>
          </h1>
          <p className="anim-rise mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 sm:mt-5 sm:text-lg" style={{ animationDelay: "120ms" }}>
            {sub}
          </p>
        </div>
        {children}
      </div>
    </section>
  );
}

export function PopularChips({ categories }: { categories: CategoryDTO[] }) {
  const popular = [...categories].filter((c) => c.distributorCount > 0).sort((a, b) => b.distributorCount - a.distributorCount).slice(0, 5);
  if (!popular.length) return null;
  return (
    <div className="scrollbar-none relative -mx-4 mt-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:mt-6 sm:flex-wrap sm:justify-center sm:gap-2.5 sm:overflow-visible sm:px-0 sm:pb-0">
      <span className="anim-chip shrink-0 text-[13px] font-medium text-muted sm:text-sm" style={{ ["--i" as string]: 0 }}>
        Popular:
      </span>
      {popular.map((c, i) => (
        <Link
          key={c.slug}
          to={`/distributors?category=${c.slug}`}
          style={{ ["--i" as string]: i + 1 }}
          className="anim-chip shrink-0 whitespace-nowrap rounded-full border border-line-strong bg-white/90 px-3.5 py-2 text-[13px] sm:px-3.5 sm:py-1.5 sm:text-sm font-medium text-slate-700 shadow-sm transition-[border-color,color,background-color,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:bg-primary-soft hover:text-primary-dark"
        >
          {c.name}
        </Link>
      ))}
    </div>
  );
}

export function CtaSection() {
  return (
    <Reveal as="section" className="container-page pb-10 sm:pb-16">
      <div className="relative overflow-hidden rounded-[20px] bg-night px-5 py-9 text-center sm:rounded-[28px] sm:px-12 sm:py-16">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_50%_0%,rgb(49_86_211/0.45),transparent_70%)]" />
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(to_right,rgb(255_255_255/0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.06)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(ellipse_70%_90%_at_50%_0%,#000,transparent_80%)]" />
        <div className="relative">
          <h2 className="mx-auto max-w-2xl text-2xl text-white sm:text-4xl">Can’t find the right distributor?</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-slate-300 sm:mt-4 sm:text-base">Tell us what you are looking for and discover relevant business opportunities.</p>
          <div className="mt-6 flex flex-col items-stretch justify-center gap-3 sm:mt-8 sm:flex-row sm:items-center">
            <Button asChild variant="dark" size="lg">
              <Link to="/post-requirement">Send Your Requirement</Link>
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
