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
      <div className="mx-auto max-w-[1200px] px-4 pb-14 pt-6 sm:px-6 sm:pb-16">
        {top && <div className="mb-8 sm:mb-10">{top}</div>}
        <div className="mx-auto max-w-3xl text-center">
          <p className="anim-rise text-xs font-bold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
          <h1 className="anim-rise mt-4 text-[2.15rem] leading-[1.08] sm:text-5xl lg:text-[3.5rem]" style={{ animationDelay: "60ms" }}>
            {headline}
            <br />
            <span className="text-primary">{highlight}</span>
          </h1>
          <p className="anim-rise mx-auto mt-5 max-w-2xl text-base text-slate-600 sm:text-lg" style={{ animationDelay: "120ms" }}>
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
    <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
      <span className="anim-chip text-sm font-medium text-muted" style={{ ["--i" as string]: 0 }}>
        Popular:
      </span>
      {popular.map((c, i) => (
        <Link
          key={c.slug}
          to={`/distributors?category=${c.slug}`}
          style={{ ["--i" as string]: i + 1 }}
          className="anim-chip rounded-full border border-line-strong bg-white/90 px-3.5 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-[border-color,color,background-color,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:bg-primary-soft hover:text-primary-dark"
        >
          {c.name}
        </Link>
      ))}
    </div>
  );
}

export function CtaSection() {
  return (
    <Reveal as="section" className="container-page pb-16">
      <div className="relative overflow-hidden rounded-[28px] bg-night px-6 py-14 text-center sm:px-12 sm:py-16">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_50%_0%,rgb(49_86_211/0.45),transparent_70%)]" />
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(to_right,rgb(255_255_255/0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.06)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(ellipse_70%_90%_at_50%_0%,#000,transparent_80%)]" />
        <div className="relative">
          <h2 className="mx-auto max-w-2xl text-3xl text-white sm:text-4xl">Can’t find the right distributor?</h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-slate-300">Tell us what you are looking for and discover relevant business opportunities.</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
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
