import { Router } from "express";
import { config } from "../config.js";
import { ah } from "../middleware/common.js";
import { getCategoryTree } from "../modules/categories/service.js";
import { listPublicSlugs } from "../modules/distributors/service.js";
import { listPublicProductSlugs } from "../modules/products/service.js";
import { listPublicRequirementSlugs } from "../modules/requirements/service.js";

export const seoRoutes = Router();

/** Static public pages that are indexable. Keep in sync with client routes. */
export const STATIC_SITEMAP_PATHS = ["/", "/distributors", "/leads", "/products", "/brands", "/categories", "/pricing", "/advertising", "/contact", "/register", "/post-requirement", "/help"];

seoRoutes.get("/robots.txt", (_req, res) => {
  const lines = [
    "User-agent: *",
    "Allow: /",
    // Private and transactional areas stay out of the index. Public search pages are NOT blocked,
    // so crawlers can read their noindex/canonical signals.
    "Disallow: /api/",
    "Disallow: /admin",
    "Disallow: /dashboard",
    "Disallow: /enquiries/",
    "Disallow: /go/",
    "",
    `Sitemap: ${config.siteUrl}/sitemap.xml`,
    "",
  ];
  res.type("text/plain").setHeader("Cache-Control", "public, max-age=3600").send(lines.join("\n"));
});

const xmlEscape = (s: string) => s.replace(/[<>&'"]/g, (c) => `&#${c.charCodeAt(0)};`);

seoRoutes.get(
  "/sitemap.xml",
  ah(async (_req, res) => {
    const [slugs, tree, products, leads] = await Promise.all([listPublicSlugs(), getCategoryTree(), listPublicProductSlugs(), listPublicRequirementSlugs()]);
    const urls: Array<{ loc: string; lastmod?: string }> = STATIC_SITEMAP_PATHS.map((p) => ({ loc: `${config.siteUrl}${p === "/" ? "" : p}` }));
    // Only categories that currently have discoverable distributors, so we never publish thin pages.
    for (const root of tree) {
      if (root.distributorCount > 0) urls.push({ loc: `${config.siteUrl}/categories/${root.slug}` });
      for (const child of root.children) {
        if (child.distributorCount > 0) urls.push({ loc: `${config.siteUrl}/categories/${child.slug}` });
      }
    }
    for (const s of slugs) urls.push({ loc: `${config.siteUrl}/distributors/${s.slug}`, lastmod: new Date(s.updatedAt).toISOString() });

    for (const p of products) urls.push({ loc: `${config.siteUrl}/products/${p.publicSlug}`, lastmod: new Date(p.updatedAt).toISOString() });
    for (const l of leads) urls.push({ loc: `${config.siteUrl}/leads/${l.slug}`, lastmod: new Date(l.updatedAt).toISOString() });

    const body =
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      urls
        .map((u) => `  <url><loc>${xmlEscape(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}</url>`)
        .join("\n") +
      `\n</urlset>\n`;
    res.type("application/xml").setHeader("Cache-Control", "public, max-age=900").send(body);
  }),
);
