import { createContext, useContext, useEffect } from "react";
import type { HeadSpec, SiteConfigDTO } from "@sd/shared";

/** Collects the head spec during server rendering so it can be written into the HTML. */
export interface HeadCollector {
  spec: HeadSpec | null;
}
export const HeadCollectorContext = createContext<HeadCollector | null>(null);

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Safe to embed inside <script>: neutralise sequences that could close the tag. */
export const safeJson = (value: unknown): string =>
  JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");

interface Tag {
  kind: "meta" | "link";
  attrs: Record<string, string>;
}

function tagsFor(spec: HeadSpec, site: SiteConfigDTO): Tag[] {
  const image = spec.ogImage ?? `${site.siteUrl}/og-default.png`;
  const tags: Tag[] = [
    { kind: "meta", attrs: { name: "description", content: spec.description } },
    { kind: "meta", attrs: { name: "robots", content: spec.robots } },
    { kind: "link", attrs: { rel: "canonical", href: spec.canonical } },
    { kind: "meta", attrs: { property: "og:title", content: spec.title } },
    { kind: "meta", attrs: { property: "og:description", content: spec.description } },
    { kind: "meta", attrs: { property: "og:type", content: spec.ogType ?? "website" } },
    { kind: "meta", attrs: { property: "og:url", content: spec.canonical } },
    { kind: "meta", attrs: { property: "og:site_name", content: site.siteName } },
    { kind: "meta", attrs: { property: "og:image", content: image } },
    { kind: "meta", attrs: { name: "twitter:card", content: "summary_large_image" } },
    { kind: "meta", attrs: { name: "twitter:title", content: spec.title } },
    { kind: "meta", attrs: { name: "twitter:description", content: spec.description } },
    { kind: "meta", attrs: { name: "twitter:image", content: image } },
  ];
  if (site.twitter) tags.push({ kind: "meta", attrs: { name: "twitter:site", content: site.twitter } });
  return tags;
}

/** HTML string injected into <head> on the server. Every tag is marked so the client can replace it. */
export function headToHtml(spec: HeadSpec, site: SiteConfigDTO): string {
  const parts = [`<title data-seo>${esc(spec.title)}</title>`];
  for (const t of tagsFor(spec, site)) {
    const attrs = Object.entries(t.attrs)
      .map(([k, v]) => `${k}="${esc(v)}"`)
      .join(" ");
    parts.push(`<${t.kind} ${attrs} data-seo>`);
  }
  for (const ld of spec.jsonLd ?? []) {
    parts.push(`<script type="application/ld+json" data-seo>${safeJson(ld)}</script>`);
  }
  return parts.join("\n    ");
}

function applyHead(spec: HeadSpec, site: SiteConfigDTO) {
  document.title = spec.title;
  document.head.querySelectorAll("[data-seo]:not(title)").forEach((n) => n.remove());
  for (const t of tagsFor(spec, site)) {
    const el = document.createElement(t.kind);
    for (const [k, v] of Object.entries(t.attrs)) el.setAttribute(k, v);
    el.setAttribute("data-seo", "");
    document.head.appendChild(el);
  }
  for (const ld of spec.jsonLd ?? []) {
    const el = document.createElement("script");
    el.type = "application/ld+json";
    el.setAttribute("data-seo", "");
    el.textContent = JSON.stringify(ld);
    document.head.appendChild(el);
  }
}

/**
 * Declares the document head for the current page.
 * Server: records the spec. Browser: updates <head> after client-side navigations.
 */
export function PageHead({ spec, site }: { spec: HeadSpec; site: SiteConfigDTO }) {
  const collector = useContext(HeadCollectorContext);
  if (collector) collector.spec = spec;
  const key = JSON.stringify(spec);
  useEffect(() => {
    applyHead(spec, site);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}
