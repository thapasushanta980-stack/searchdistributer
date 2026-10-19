import { Router } from "express";
import { z } from "zod";
import { adminLoginSchema, moderationDecisionSchema } from "@sd/shared";
import { config } from "../config.js";
import { HttpError } from "../lib/errors.js";
import { adminLoginLimiter, ah, apiLimiter, parseOrThrow } from "../middleware/common.js";
import { login, logout, SESSION_COOKIE, sessionMaxAgeMs } from "../modules/admin/auth.js";
import { audit } from "../modules/admin/audit.js";
import { CSRF_HEADER, requireAdmin, requireRole, sessionToken } from "../modules/admin/middleware.js";
import { decideRequirement, getStats, listAudit, listRequirements } from "../modules/admin/service.js";

export const admin = Router();

// Admin responses are private and must never be cached by a browser or proxy.
// Every admin route shares the global per-IP limit; login adds its own stricter one.
admin.use(apiLimiter);
admin.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  next();
});

const cookieOpts = { httpOnly: true, sameSite: "strict", secure: config.isProd, path: "/" } as const;

admin.post(
  "/auth/login",
  adminLoginLimiter,
  ah(async (req, res) => {
    if (req.get(CSRF_HEADER) !== "1") throw new HttpError(403, "CSRF", "Missing required request header.");
    const { email, password } = parseOrThrow(adminLoginSchema, req.body);
    const result = await login(email, password, { ip: req.ip, userAgent: req.get("user-agent") });
    if (!result) {
      await audit({ action: "admin.login_failed", meta: { email: email.toLowerCase() }, ip: req.ip });
      throw new HttpError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
    }
    await audit({ adminId: result.admin.id, action: "admin.login", ip: req.ip });
    res.cookie(SESSION_COOKIE, result.token, { ...cookieOpts, maxAge: sessionMaxAgeMs });
    res.json({ data: result.admin });
  }),
);

admin.post(
  "/auth/logout",
  ah(async (req, res) => {
    if (req.get(CSRF_HEADER) !== "1") throw new HttpError(403, "CSRF", "Missing required request header.");
    await logout(sessionToken(req));
    res.clearCookie(SESSION_COOKIE, cookieOpts);
    res.status(204).end();
  }),
);

// Everything below requires a signed-in admin.
admin.use(requireAdmin);

admin.get("/auth/me", (req, res) => {
  const { id, email, name, role } = req.admin!;
  res.json({ data: { id, email, name, role } });
});

admin.get(
  "/stats",
  ah(async (_req, res) => {
    res.json({ data: await getStats() });
  }),
);

const queueQuery = z.object({
  status: z.enum(["PENDING_REVIEW", "APPROVED", "REJECTED", "CLOSED"]).default("PENDING_REVIEW"),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
});

admin.get(
  "/requirements",
  ah(async (req, res) => {
    const { status, page } = parseOrThrow(queueQuery, req.query);
    res.json(await listRequirements(status, page));
  }),
);

admin.post(
  "/requirements/:id/decision",
  requireRole("MODERATOR"),
  ah(async (req, res) => {
    const id = String(req.params.id);
    if (!/^[0-9a-f-]{36}$/.test(id)) throw new HttpError(404, "NOT_FOUND", "Requirement not found.");
    const decision = parseOrThrow(moderationDecisionSchema, req.body);
    res.json({ data: await decideRequirement(id, decision, { id: req.admin!.id, ip: req.ip }) });
  }),
);

admin.get(
  "/audit-log",
  requireRole(), // no roles listed: SUPER_ADMIN only
  ah(async (req, res) => {
    const { page } = parseOrThrow(z.object({ page: z.coerce.number().int().min(1).max(10_000).default(1) }), req.query);
    res.json(await listAudit(page));
  }),
);
