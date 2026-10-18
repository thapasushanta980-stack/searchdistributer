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
  logger.error(`${req.method} ${req.path} failed: ${(err as Error)?.stack ?? err}`);
  const body: ApiErrorBody = { error: { code: "INTERNAL", message: "Something went wrong on our side. Please try again." } };
  res.status(500).json(body);
}
