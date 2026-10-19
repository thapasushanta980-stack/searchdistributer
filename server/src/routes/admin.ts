import { Router, type Request } from "express";
import { z } from "zod";
import {
  AD_PLACEMENTS,
  AD_STATUSES,
  BUSINESS_TYPES,
  ENQUIRY_STATUSES,
  LEAD_STATUSES,
  LEAD_TYPES,
  LISTING_STATUSES,
  adminAdActionSchema,
  adminAdInputSchema,
  adminEnquiryUpdateSchema,
  adminLeadUpdateSchema,
  adminListingActionSchema,
  adminListingInputSchema,
  adminLoginSchema,
  adminProductInputSchema,
  adminRequirementStatusSchema,
  moderationDecisionSchema,
} from "@sd/shared";
import { config } from "../config.js";
import { HttpError } from "../lib/errors.js";
import { adminLoginLimiter, ah, apiLimiter, parseOrThrow } from "../middleware/common.js";
import { login, logout, SESSION_COOKIE, sessionMaxAgeMs } from "../modules/admin/auth.js";
import { audit } from "../modules/admin/audit.js";
import { CSRF_HEADER, requireAdmin, requireRole, sessionToken } from "../modules/admin/middleware.js";
import { actOnAd, createAd, deleteAd, getAd, listAds, updateAd } from "../modules/admin/ads.js";
import { deleteEnquiry, deleteLead, deleteRequirement, getLead, listEnquiries, listLeads, listRequirementResponses, setRequirementStatus, updateEnquiry, updateLead } from "../modules/admin/inbox.js";
import { actOnListing, createListing, createProduct, deleteListing, deleteProduct, getListing, listListings, updateListing, updateProduct } from "../modules/admin/listings.js";
import { decideRequirement, getStats, listAudit, listRequirements } from "../modules/admin/service.js";
import { getAnalytics } from "../modules/analytics/service.js";

export const admin = Router();

// Admin responses are private and must never be cached by a browser or proxy.
// Every admin route shares the global per-IP limit; login adds its own stricter one.
admin.use(apiLimiter);
admin.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  next();
});

/* Shared by the module routes. Reading: any admin. Changing: moderators and up. Deleting: super admins only. */
const pageNo = z.coerce.number().int().min(1).max(10_000).default(1);
const q = z.string().trim().max(100).optional().transform((v) => v || undefined);
const bool = z.enum(["true", "false"]).optional().transform((v) => (v === undefined ? undefined : v === "true"));
const canChange = requireRole("MODERATOR");
const canDelete = requireRole();

/** Route ids are UUIDs; anything else is a 404, never a database error. */
function uuidParam(req: Request, name = "id"): string {
  const v = String(req.params[name]);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) throw new HttpError(404, "NOT_FOUND", "Not found.");
  return v;
}
const actor = (req: Request) => ({ id: req.admin!.id, ip: req.ip });

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
    const { page, entityType, entityId } = parseOrThrow(
      z.object({ page: pageNo, entityType: z.string().max(40).optional(), entityId: z.string().uuid().optional() }),
      req.query,
    );
    res.json(await listAudit(page, { entityType, entityId }));
  }),
);

// Leads
admin.get(
  "/leads",
  ah(async (req, res) => {
    const f = parseOrThrow(z.object({ status: z.enum(LEAD_STATUSES).optional(), type: z.enum(LEAD_TYPES).optional(), q, page: pageNo }), req.query);
    res.json(await listLeads(f));
  }),
);
admin.get("/leads/:id", ah(async (req, res) => void res.json({ data: await getLead(uuidParam(req)) })));
admin.patch("/leads/:id", canChange, ah(async (req, res) => void res.json({ data: await updateLead(uuidParam(req), parseOrThrow(adminLeadUpdateSchema, req.body), actor(req)) })));
admin.delete("/leads/:id", canDelete, ah(async (req, res) => void (await deleteLead(uuidParam(req), actor(req)), res.status(204).end())));

// Enquiries
admin.get(
  "/enquiries",
  ah(async (req, res) => {
    const f = parseOrThrow(z.object({ status: z.enum(ENQUIRY_STATUSES).optional(), spam: bool, distributorId: z.string().uuid().optional(), q, page: pageNo }), req.query);
    res.json(await listEnquiries(f));
  }),
);
admin.patch("/enquiries/:id", canChange, ah(async (req, res) => void res.json({ data: await updateEnquiry(uuidParam(req), parseOrThrow(adminEnquiryUpdateSchema, req.body), actor(req)) })));
admin.delete("/enquiries/:id", canDelete, ah(async (req, res) => void (await deleteEnquiry(uuidParam(req), actor(req)), res.status(204).end())));

// Requirements (approve and reject live at /requirements/:id/decision above)
admin.get("/requirements/:id/responses", ah(async (req, res) => void res.json({ data: await listRequirementResponses(uuidParam(req)) })));
admin.post(
  "/requirements/:id/status",
  canChange,
  ah(async (req, res) => void res.json({ data: await setRequirementStatus(uuidParam(req), parseOrThrow(adminRequirementStatusSchema, req.body).status, actor(req)) })),
);
admin.delete("/requirements/:id", canDelete, ah(async (req, res) => void (await deleteRequirement(uuidParam(req), actor(req)), res.status(204).end())));

// Listings and their products
admin.get(
  "/listings",
  ah(async (req, res) => {
    const f = parseOrThrow(z.object({ status: z.enum(LISTING_STATUSES).optional(), businessType: z.enum(BUSINESS_TYPES).optional(), live: bool, q, page: pageNo }), req.query);
    res.json(await listListings(f));
  }),
);
admin.post("/listings", canChange, ah(async (req, res) => void res.status(201).json({ data: await createListing(parseOrThrow(adminListingInputSchema, req.body), actor(req)) })));
admin.get("/listings/:id", ah(async (req, res) => void res.json({ data: await getListing(uuidParam(req)) })));
admin.put("/listings/:id", canChange, ah(async (req, res) => void res.json({ data: await updateListing(uuidParam(req), parseOrThrow(adminListingInputSchema, req.body), actor(req)) })));
admin.post("/listings/:id/action", canChange, ah(async (req, res) => void res.json({ data: await actOnListing(uuidParam(req), parseOrThrow(adminListingActionSchema, req.body), actor(req)) })));
admin.delete("/listings/:id", canDelete, ah(async (req, res) => void (await deleteListing(uuidParam(req), actor(req)), res.status(204).end())));
admin.post(
  "/listings/:id/products",
  canChange,
  ah(async (req, res) => void res.status(201).json({ data: await createProduct(uuidParam(req), parseOrThrow(adminProductInputSchema, req.body), actor(req)) })),
);
admin.put(
  "/listings/:id/products/:productId",
  canChange,
  ah(async (req, res) => void res.json({ data: await updateProduct(uuidParam(req), uuidParam(req, "productId"), parseOrThrow(adminProductInputSchema, req.body), actor(req)) })),
);
// Removing a product is routine catalogue editing, so moderators may do it.
admin.delete(
  "/listings/:id/products/:productId",
  canChange,
  ah(async (req, res) => void (await deleteProduct(uuidParam(req), uuidParam(req, "productId"), actor(req)), res.status(204).end())),
);

// Advertising
admin.get(
  "/ads",
  ah(async (req, res) => {
    const f = parseOrThrow(z.object({ status: z.enum(AD_STATUSES).optional(), placement: z.enum(AD_PLACEMENTS).optional(), q, page: pageNo }), req.query);
    res.json(await listAds(f));
  }),
);
admin.post("/ads", canChange, ah(async (req, res) => void res.status(201).json({ data: await createAd(parseOrThrow(adminAdInputSchema, req.body), actor(req)) })));
admin.get("/ads/:id", ah(async (req, res) => void res.json({ data: await getAd(uuidParam(req)) })));
admin.put("/ads/:id", canChange, ah(async (req, res) => void res.json({ data: await updateAd(uuidParam(req), parseOrThrow(adminAdInputSchema, req.body), actor(req)) })));
admin.post("/ads/:id/action", canChange, ah(async (req, res) => void res.json({ data: await actOnAd(uuidParam(req), parseOrThrow(adminAdActionSchema, req.body), actor(req)) })));
admin.delete("/ads/:id", canDelete, ah(async (req, res) => void (await deleteAd(uuidParam(req), actor(req)), res.status(204).end())));

// Analytics
admin.get(
  "/analytics",
  ah(async (req, res) => {
    const { range } = parseOrThrow(z.object({ range: z.enum(["7", "30", "90"]).default("30").transform((v) => Number(v) as 7 | 30 | 90) }), req.query);
    res.json({ data: await getAnalytics(range) });
  }),
);
