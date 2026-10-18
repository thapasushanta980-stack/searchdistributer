import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { Express, Request, Response, NextFunction } from "express";
import express from "express";
import sirv from "sirv";
import type { ApiClient, SiteConfigDTO } from "@sd/shared";
import { config, siteConfig } from "./config.js";
import { logger } from "./logger.js";
import { getCategoryTree } from "./modules/categories/service.js";
import { getDistributorBySlug, getFacets, getFeatured, searchDistributors, suggest } from "./modules/distributors/service.js";
import { listActiveAds } from "./modules/ads/service.js";
import { getProductBySlug, listProducts } from "./modules/products/service.js";
import { getRequirement, searchRequirements } from "./modules/requirements/service.js";

/** In-process data access used while rendering on the server (no HTTP round trip). */
const serverApi: ApiClient = {
  listDistributors: (p) => searchDistributors(p),
  getDistributor: (slug) => getDistributorBySlug(slug),
  getCategories: () => getCategoryTree(),
  getFeatured: () => getFeatured(),
  getFacets: () => getFacets(),
  suggest: (q) => suggest(q),
  listProducts: (p) => listProducts(p),
  getProduct: (slug) => getProductBySlug(slug),
  listRequirements: (p) => searchRequirements(p),
  listAds: (placement) => listActiveAds(placement),
  getRequirement: (slug) => getRequirement(slug),
};

interface RenderResult {
  html: string;
  head: string;
  state: string;
  status: number;
  redirect?: string;
}
type RenderFn = (opts: { url: string; api: ApiClient; site: SiteConfigDTO }) => Promise<RenderResult>;

const clientDir = path.join(config.rootDir, "client");
const distClient = path.join(clientDir, "dist/client");
const distServer = path.join(clientDir, "dist/server");

export async function mountSsr(app: Express): Promise<void> {
  type ViteDev = import("vite").ViteDevServer;
  let vite: ViteDev | undefined;
  let prodTemplate = "";
  let prodAdminTemplate = "";
  let prodRender: RenderFn | undefined;

  if (config.isProd) {
    if (!fs.existsSync(path.join(distClient, "index.html"))) {
      throw new Error("Client build not found. Run `npm run build` before starting in production.");
    }
    prodTemplate = fs.readFileSync(path.join(distClient, "index.html"), "utf-8");
    prodAdminTemplate = fs.readFileSync(path.join(distClient, "admin.html"), "utf-8");
    prodRender = (await import(pathToFileURL(path.join(distServer, "entry-server.js")).href)).render as RenderFn;
    // Hashed assets are immutable; everything else revalidates.
    app.use(
      sirv(distClient, {
        gzip: true,
        brotli: true,
        etag: true,
        dev: false,
        immutable: true,
        maxAge: 31536000,
        extensions: [],
        setHeaders(res, pathname) {
          if (!pathname.startsWith("/assets/")) res.setHeader("Cache-Control", "public, max-age=3600");
        },
      }),
    );
  } else {
    const { createServer } = await import("vite");
    vite = await createServer({ root: clientDir, appType: "custom", server: { middlewareMode: true } });
    app.use(vite.middlewares);
  }

  app.use(express.static(path.join(clientDir, "public"), { index: false, maxAge: config.isProd ? "1d" : 0 }));

  // Back office: a client-only app, never server-rendered or indexed. Data comes from /api/admin/v1 behind the login.
  app.get(["/admin", "/admin/*"], async (req: Request, res: Response, next: NextFunction) => {
    try {
      const html = vite ? await vite.transformIndexHtml(req.originalUrl, fs.readFileSync(path.join(clientDir, "admin.html"), "utf-8")) : prodAdminTemplate;
      res.status(200).setHeader("Content-Type", "text/html; charset=utf-8").setHeader("Cache-Control", "no-store").setHeader("X-Robots-Tag", "noindex, nofollow").send(html);
    } catch (err) {
      next(err);
    }
  });

  app.get("*", async (req: Request, res: Response, next: NextFunction) => {
    const url = req.originalUrl;
    try {
      let template: string;
      let render: RenderFn;
      if (vite) {
        template = await vite.transformIndexHtml(url, fs.readFileSync(path.join(clientDir, "index.html"), "utf-8"));
        render = (await vite.ssrLoadModule("/src/entry-server.tsx")).render as RenderFn;
      } else {
        template = prodTemplate;
        render = prodRender!;
      }

      let result: RenderResult;
      try {
        result = await render({ url, api: serverApi, site: siteConfig });
      } catch (err) {
        // Degrade to a client-rendered shell instead of failing the request.
        logger.error(`SSR failed for ${url}: ${(err as Error)?.stack ?? err}`);
        result = { html: "", head: "<title>Search Distributor</title>", state: "{}", status: 200 };
      }

      if (result.redirect) return res.redirect(301, result.redirect);

      const page = template
        .replace("<!--app-head-->", result.head)
        .replace("<!--app-html-->", result.html)
        .replace("<!--app-state-->", result.state);

      res
        .status(result.status)
        .setHeader("Content-Type", "text/html; charset=utf-8")
        .setHeader("Cache-Control", "public, max-age=0, must-revalidate")
        .send(page);
    } catch (err) {
      vite?.ssrFixStacktrace(err as Error);
      next(err);
    }
  });
}
