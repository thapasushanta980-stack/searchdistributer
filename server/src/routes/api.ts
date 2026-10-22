import { Router } from "express";
import { z } from "zod";
import {
  AD_PLACEMENTS,
  advertisingLeadSchema,
  distributorSearchSchema,
  enquiryInputSchema,
  leadInputSchema,
  registrationLeadSchema,
  parseProductSearch,
  parseRequirementSearch,
  requirementInputSchema,
  requirementResponseSchema,
  trackEventSchema,
} from "@sd/shared";
import { prisma } from "../db.js";
import { notFound } from "../lib/errors.js";
import { adEventLimiter, ah, apiLimiter, parseOrThrow, verifyLimiter, writeLimiter } from "../middleware/common.js";
import { listActiveAds, recordClick, recordImpression } from "../modules/ads/service.js";
import { recordEvent } from "../modules/analytics/service.js";
import { getCategoryTree } from "../modules/categories/service.js";
import { getDistributorBySlug, getFacets, getFeatured, searchDistributors, suggest } from "../modules/distributors/service.js";
import { resendVerification, submitEnquiry, verifyEnquiry } from "../modules/enquiries/service.js";
import { submitLead } from "../modules/leads/service.js";
import { getProductBySlug, listProducts } from "../modules/products/service.js";
import { getRequirement, respondToRequirement, searchRequirements, submitRequirement } from "../modules/requirements/service.js";

export const api = Router();

api.use(apiLimiter);

const publicCache = (seconds: number) => (_req: unknown, res: { setHeader(k: string, v: string): void }, next: () => void) => {
  res.setHeader("Cache-Control", `public, max-age=${seconds}, stale-while-revalidate=${seconds * 3}`);
  next();
};

api.get(
  "/distributors",
  publicCache(10),
  ah(async (req, res) => {
    const params = parseOrThrow(distributorSearchSchema, req.query);
    res.json(await searchDistributors(params));
  }),
);

api.get(
  "/distributors/featured",
  publicCache(30),
  ah(async (_req, res) => {
    res.json({ data: await getFeatured() });
  }),
);

api.get(
  "/distributors/facets",
  publicCache(60),
  ah(async (_req, res) => {
    res.json(await getFacets());
  }),
);

api.get(
  "/distributors/suggest",
  publicCache(30),
  ah(async (req, res) => {
    const { q } = parseOrThrow(z.object({ q: z.string().max(80).default("") }), req.query);
    res.json(await suggest(q));
  }),
);

api.get(
  "/distributors/:slug",
  ah(async (req, res) => {
    const slug = String(req.params.slug);
    if (!/^[a-z0-9-]{1,120}$/.test(slug)) throw notFound("Distributor not found");
    const distributor = await getDistributorBySlug(slug);
    if (!distributor) throw notFound("This distributor is not available.");
    res.json({ data: distributor });
  }),
);

api.get(
  "/ads",
  ah(async (req, res) => {
    const { placement } = parseOrThrow(z.object({ placement: z.enum(AD_PLACEMENTS) }), req.query);
    res.setHeader("Cache-Control", "no-store");
    res.json({ data: await listActiveAds(placement) });
  }),
);

api.post(
  "/ads/:id/impression",
  adEventLimiter,
  ah(async (req, res) => {
    const id = String(req.params.id);
    if (!/^[0-9a-f-]{36}$/.test(id)) return void res.status(204).end();
    const { pageViewId } = parseOrThrow(z.object({ pageViewId: z.string().uuid() }), req.body);
    await recordImpression(id, pageViewId);
    res.status(204).end();
  }),
);

api.get(
  "/ads/:id/click",
  adEventLimiter,
  ah(async (req, res) => {
    const id = String(req.params.id);
    const valid = /^[0-9a-f-]{36}$/.test(id);
    // HEAD requests (link checkers, crawlers) resolve the destination without being counted.
    const dest = valid ? await recordClick(id, req.method === "GET") : null;
    // Sponsored links must never be indexed or followed as organic links.
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    res.setHeader("Cache-Control", "no-store");
    res.redirect(302, dest ?? "/");
  }),
);

api.get(
  "/categories",
  publicCache(30),
  ah(async (_req, res) => {
    res.json({ data: await getCategoryTree() });
  }),
);

api.get(
  "/products",
  publicCache(10),
  ah(async (req, res) => {
    res.json(await listProducts(parseProductSearch(new URLSearchParams(req.query as Record<string, string>))));
  }),
);

api.get(
  "/products/:slug",
  ah(async (req, res) => {
    const slug = String(req.params.slug);
    if (!/^[a-z0-9-]{1,200}$/.test(slug)) throw notFound("Product not found");
    const product = await getProductBySlug(slug);
    if (!product) throw notFound("This product is not available.");
    res.json({ data: product });
  }),
);

api.get(
  "/requirements",
  publicCache(10),
  ah(async (req, res) => {
    res.json(await searchRequirements(parseRequirementSearch(new URLSearchParams(req.query as Record<string, string>))));
  }),
);

api.get(
  "/requirements/:slug",
  ah(async (req, res) => {
    const slug = String(req.params.slug);
    if (!/^[a-z0-9-]{1,80}$/.test(slug)) throw notFound("Requirement not found");
    const r = await getRequirement(slug);
    if (!r) throw notFound("This requirement is not available.");
    res.json({ data: r });
  }),
);

api.post(
  "/requirements",
  writeLimiter,
  ah(async (req, res) => {
    const input = parseOrThrow(requirementInputSchema, req.body);
    res.status(201).json(await submitRequirement(input));
    recordEvent(req, { type: "REQUIREMENT", categorySlug: input.categorySlug ?? null });
  }),
);

api.post(
  "/requirements/:slug/responses",
  writeLimiter,
  ah(async (req, res) => {
    const slug = String(req.params.slug);
    if (!/^[a-z0-9-]{1,80}$/.test(slug)) throw notFound("Requirement not found");
    res.status(201).json(await respondToRequirement(slug, parseOrThrow(requirementResponseSchema, req.body)));
  }),
);

api.post(
  "/enquiries",
  writeLimiter,
  ah(async (req, res) => {
    const input = parseOrThrow(enquiryInputSchema, req.body);
    res.status(201).json(await submitEnquiry(input));
    const d = await prisma.distributor.findUnique({ where: { slug: input.distributorSlug }, select: { id: true, category: { select: { slug: true } } } });
    if (d) recordEvent(req, { type: "ENQUIRY", distributorId: d.id, categorySlug: d.category?.slug ?? null });
  }),
);

api.post(
  "/enquiries/verify",
  verifyLimiter,
  ah(async (req, res) => {
    const { token } = parseOrThrow(z.object({ token: z.string().min(20).max(200) }), req.body);
    res.json(await verifyEnquiry(token));
  }),
);

api.post(
  "/enquiries/resend",
  writeLimiter,
  ah(async (req, res) => {
    const { reference, email } = parseOrThrow(
      z.object({ reference: z.string().min(6).max(40), email: z.string().email().max(200) }),
      req.body,
    );
    await resendVerification(reference, email);
    res.json({ ok: true });
  }),
);

api.post(
  "/leads",
  writeLimiter,
  ah(async (req, res) => {
    const schema = req.body?.type === "BUSINESS_REGISTRATION" ? registrationLeadSchema : req.body?.type === "ADVERTISING" ? advertisingLeadSchema : leadInputSchema;
    const input = parseOrThrow(schema, req.body);
    res.status(201).json(await submitLead(input));
    if (!input.website) recordEvent(req, { type: "LEAD", categorySlug: input.categorySlug ?? null });
  }),
);

/**
 * Usage events from the browser (searches and page views). Always answers 204 so a beacon never retries or errors;
 * invalid or bot events are simply dropped.
 */
api.post(
  "/events",
  adEventLimiter,
  ah(async (req, res) => {
    const parsed = trackEventSchema.safeParse(req.body);
    if (parsed.success) {
      const e = parsed.data;
      recordEvent(req, {
        type: e.type,
        scope: e.type === "SEARCH" ? e.scope : null,
        query: e.type === "SEARCH" ? e.query : null,
        location: e.type === "SEARCH" ? e.location : null,
        resultCount: e.type === "SEARCH" ? e.resultCount : null,
        categorySlug: e.categorySlug ?? null,
        distributorId: "distributorId" in e ? e.distributorId : null,
        productId: "productId" in e ? e.productId : null,
      });
    }
    res.status(204).end();
  }),
);
