import { Router } from "express";
import { config } from "../config.js";
import { prisma } from "../db.js";
import { adEventLimiter, ah } from "../middleware/common.js";
import { recordEvent } from "../modules/analytics/service.js";
import { getDistributorBySlug } from "../modules/distributors/service.js";

export const goRoutes = Router();

/** wa.me wants the number as digits only, with the country code. */
export const waDigits = (n: string) => n.replace(/\D/g, "").replace(/^00/, "");

/**
 * Tracked WhatsApp hand-off: counts the click, then opens a chat with the business with a message that
 * credits the site. The number never appears in page HTML, so it can't be scraped from listings.
 * Unknown, hidden or WhatsApp-less listings fall back to the listing page.
 */
goRoutes.get(
  "/go/whatsapp/:slug",
  adEventLimiter,
  ah(async (req, res) => {
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    res.setHeader("Cache-Control", "no-store");
    const slug = String(req.params.slug);
    const fallback = /^[a-z0-9-]{1,120}$/.test(slug) ? `/distributors/${slug}` : "/distributors";
    const listing = /^[a-z0-9-]{1,120}$/.test(slug) ? await getDistributorBySlug(slug) : null; // null unless publicly visible
    if (!listing?.hasWhatsapp) return res.redirect(302, fallback);

    const row = await prisma.distributor.findUnique({ where: { id: listing.id }, select: { whatsappNumber: true } });
    const digits = waDigits(row?.whatsappNumber ?? "");
    if (digits.length < 7) return res.redirect(302, fallback);

    const productSlug = typeof req.query.product === "string" && /^[a-z0-9-]{1,200}$/.test(req.query.product) ? req.query.product : null;
    const product = productSlug ? listing.products.find((p) => p.publicSlug === productSlug) : undefined;
    const page = product ? `${config.siteUrl}/products/${product.publicSlug}` : `${config.siteUrl}/distributors/${listing.slug}`;
    const text = product
      ? `Hi ${listing.name}, I found your product "${product.name}" on ${config.SITE_NAME} (${page}) and would like to know more.`
      : `Hi ${listing.name}, I found you on ${config.SITE_NAME} (${page}) and would like to know more.`;

    // Link checkers send HEAD; only real visits count.
    if (req.method === "GET") recordEvent(req, { type: "WHATSAPP_CLICK", distributorId: listing.id, productId: product?.id ?? null, categorySlug: listing.category?.slug ?? null });
    res.redirect(302, `https://wa.me/${digits}?text=${encodeURIComponent(text)}`);
  }),
);
