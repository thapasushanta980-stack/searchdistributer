import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { AdminRole } from "@prisma/client";
import { HttpError } from "../../lib/errors.js";
import { ah } from "../../middleware/common.js";
import { authenticate, SESSION_COOKIE, type AdminPrincipal } from "./auth.js";

function readCookie(header: string | undefined, name: string): string | undefined {
  for (const part of (header ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return undefined;
}

export const sessionToken = (req: Request) => readCookie(req.headers.cookie, SESSION_COOKIE);

declare module "express-serve-static-core" {
  interface Request {
    admin?: AdminPrincipal;
  }
}

/** Header the admin client must send on state-changing requests. A cross-site form or <img> cannot set it. */
export const CSRF_HEADER = "x-sd-admin";

export const requireAdmin: RequestHandler = ah(async (req: Request, _res: Response, next: NextFunction) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && req.get(CSRF_HEADER) !== "1") {
    throw new HttpError(403, "CSRF", "Missing required request header.");
  }
  const admin = await authenticate(sessionToken(req));
  if (!admin) throw new HttpError(401, "UNAUTHENTICATED", "Please sign in.");
  req.admin = admin;
  next();
});

export const requireRole =
  (...roles: AdminRole[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.admin || (req.admin.role !== "SUPER_ADMIN" && !roles.includes(req.admin.role))) {
      return next(new HttpError(403, "FORBIDDEN", "You do not have permission to do this."));
    }
    next();
  };
