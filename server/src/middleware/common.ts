import type { NextFunction, Request, RequestHandler, Response } from "express";
import rateLimit from "express-rate-limit";
import { ZodError, type ZodTypeAny, type z } from "zod";
import type { ApiErrorBody } from "@sd/shared";
import { config } from "../config.js";
import { HttpError } from "../lib/errors.js";
import { logger } from "../logger.js";

/** Wrap async handlers so rejections reach the error middleware (Express 4). */
export const ah =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

export function fieldErrors(err: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export function parseOrThrow<S extends ZodTypeAny>(schema: S, value: unknown): z.output<S> {
  const res = schema.safeParse(value);
  if (!res.success) throw new HttpError(400, "VALIDATION_ERROR", "Please check the highlighted fields.", fieldErrors(res.error));
  return res.data;
}

const limiter = (windowMs: number, limit: number, message: string) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skip: () => config.NODE_ENV === "test",
    handler: (_req, res) => {
      const body: ApiErrorBody = { error: { code: "RATE_LIMITED", message } };
      res.status(429).json(body);
    },
  });

export const apiLimiter = limiter(60_000, 240, "Too many requests. Please slow down and try again shortly.");
export const writeLimiter = limiter(10 * 60_000, 8, "Too many submissions from this connection. Please try again in a few minutes.");
export const adEventLimiter = limiter(60_000, 60, "Too many requests.");
export const adminLoginLimiter = limiter(15 * 60_000, 10, "Too many sign-in attempts. Please try again later.");
export const verifyLimiter = limiter(10 * 60_000, 30, "Too many attempts. Please try again in a few minutes.");

export function notFoundApi(_req: Request, res: Response) {
  const body: ApiErrorBody = { error: { code: "NOT_FOUND", message: "Endpoint not found" } };
  res.status(404).json(body);
}

/** Self-contained (no app bundle, inline styles only) so it renders even when the app itself is what failed. */
const ERROR_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Something went wrong | ${config.SITE_NAME.replace(/[&<>"]/g, "")}</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f8fafc;color:#0f172a;font:16px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;padding:24px;box-sizing:border-box}
  main{max-width:440px;text-align:center}
  .icon{width:56px;height:56px;margin:0 auto;border-radius:16px;background:#fef2f2;color:#dc2626;display:grid;place-items:center;font-size:28px;font-weight:700}
  h1{font-size:28px;line-height:1.2;margin:20px 0 8px}
  p{color:#64748b;margin:0}
  .actions{margin-top:28px;display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
  a{display:inline-flex;align-items:center;height:44px;padding:0 20px;border-radius:10px;font-weight:600;font-size:14px;text-decoration:none}
  .primary{background:#3156d3;color:#fff}.primary:hover{background:#203b9f}
  .secondary{border:1px solid #cbd5e1;color:#0f172a;background:#fff}.secondary:hover{background:#eef2ff}
</style>
</head>
<body>
<main>
  <div class="icon" aria-hidden="true">!</div>
  <h1>Something went wrong</h1>
  <p>We hit a problem loading this page. Please try again in a moment.</p>
  <div class="actions"><a class="primary" href="">Try again</a><a class="secondary" href="/">Go to home</a></div>
</main>
</body>
</html>`;

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (res.headersSent) return;
  if (err instanceof HttpError) {
    const body: ApiErrorBody = { error: { code: err.code, message: err.message, fields: err.fields } };
    res.status(err.status).json(body);
    return;
  }
  if (err instanceof SyntaxError && "body" in err) {
    const body: ApiErrorBody = { error: { code: "BAD_JSON", message: "Request body is not valid JSON." } };
    res.status(400).json(body);
    return;
  }
  // Other body-parser rejections (too large, unsupported charset or encoding) are the client's fault, not a 500.
  const status = (err as { status?: unknown; expose?: unknown })?.status;
  if (typeof status === "number" && status >= 400 && status < 500 && (err as { expose?: unknown }).expose === true) {
    const code = status === 413 ? "PAYLOAD_TOO_LARGE" : "BAD_REQUEST";
    const message = status === 413 ? "Request body is too large." : "The request could not be read.";
    const body: ApiErrorBody = { error: { code, message } };
    res.status(status).json(body);
    return;
  }
  logger.error(`${req.method} ${req.path} failed: ${(err as Error)?.stack ?? err}`);
  // A browser asking for a page gets a readable error page, not JSON.
  if (!req.path.startsWith("/api/") && req.accepts(["json", "html"]) === "html") {
    res.status(500).setHeader("Cache-Control", "no-store").type("html").send(ERROR_PAGE);
    return;
  }
  const body: ApiErrorBody = { error: { code: "INTERNAL", message: "Something went wrong on our side. Please try again." } };
  res.status(500).json(body);
}
