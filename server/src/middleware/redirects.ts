import type { NextFunction, Request, Response } from "express";
import { config } from "../config.js";

/**
 * Normalise URLs with a SINGLE 301 hop (no redirect chains):
 *   - lower-case paths
 *   - strip trailing slashes
 *   - collapse duplicate slashes
 *   - www -> apex (when SITE_URL is the apex host)
 */
export function canonicalRedirects(req: Request, res: Response, next: NextFunction) {
  if (req.method !== "GET" && req.method !== "HEAD") return next();
  const rawPath = req.path;
  if (rawPath.startsWith("/api/") || rawPath.startsWith("/assets/")) return next();

  const legacy: Record<string, string> = { "/requirement": "/post-requirement" };
  let path = rawPath.replace(/\/{2,}/g, "/");
  if (path.length > 1) path = path.replace(/\/+$/, "");
  const lowered = path.toLowerCase();
  if (lowered !== path && !/\.[a-z0-9]+$/i.test(path)) path = lowered;

  if (legacy[path]) path = legacy[path]!;

  const host = req.headers.host ?? "";
  const canonicalHost = new URL(config.siteUrl).host;
  const wwwRedirect = config.isProd && host.startsWith("www.") && host.slice(4) === canonicalHost;

  if (path !== rawPath || wwwRedirect) {
    const qIndex = req.originalUrl.indexOf("?");
    const query = qIndex >= 0 ? req.originalUrl.slice(qIndex) : "";
    const target = wwwRedirect ? `${config.siteUrl}${path}${query}` : `${path}${query}`;
    return res.redirect(301, target);
  }
  next();
}
