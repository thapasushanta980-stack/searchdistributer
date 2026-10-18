import { config } from "../../config.js";
import { prisma } from "../../db.js";
import { logger } from "../../logger.js";
import { postDistributorToTikTok } from "./tiktok.js";

const INTERVAL_MS = 10 * 60_000;
/** TikTok photo posts accept JPEG/PNG/WebP only; SVG and others are rejected. */
const IMAGE_EXT = /\.(jpe?g|png|webp)(\?.*)?$/i;

function absolute(url: string) {
  return /^https?:\/\//i.test(url) ? url : `${config.siteUrl}${url.startsWith("/") ? "" : "/"}${url}`;
}

/**
 * Post one newly approved, public distributor to TikTok using its logo as the image.
 * Every attempt (success or failure) writes an audit row, which doubles as the "already handled" marker,
 * so a rejected post is never retried in a loop. Use the admin endpoint to retry manually.
 */
export async function autopostNext(): Promise<boolean> {
  const done = await prisma.auditLog.findMany({
    where: { action: { in: ["social.tiktok_post", "social.tiktok_failed"] }, entityType: "distributor" },
    select: { entityId: true },
  });
  const candidate = await prisma.distributor.findFirst({
    where: {
      status: "APPROVED",
      publicationEnabled: true,
      isDemo: false,
      logoUrl: { not: null },
      id: { notIn: done.map((r) => r.entityId).filter((id): id is string => !!id) },
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, logoUrl: true },
  });
  if (!candidate?.logoUrl) return false;

  const imageUrl = absolute(candidate.logoUrl);
  try {
    if (!IMAGE_EXT.test(imageUrl)) throw new Error("Logo is not a JPEG/PNG/WebP image.");
    const { post, partialFailure } = await postDistributorToTikTok({ distributorId: candidate.id, imageUrls: [imageUrl], publishNow: true });
    await prisma.auditLog.create({
      data: {
        action: partialFailure ? "social.tiktok_failed" : "social.tiktok_post",
        entityType: "distributor",
        entityId: candidate.id,
        meta: { auto: true, zernioPostId: post?._id ?? null, status: post?.status ?? null },
      },
    });
  } catch (err) {
    logger.error({ err, distributorId: candidate.id }, "TikTok autopost failed");
    await prisma.auditLog.create({
      data: { action: "social.tiktok_failed", entityType: "distributor", entityId: candidate.id, meta: { auto: true, error: String((err as Error).message).slice(0, 300) } },
    });
  }
  return true;
}

export function startAutopostWorker(): () => void {
  if (!config.ZERNIO_AUTOPOST || !config.ZERNIO_API_KEY || !config.ZERNIO_TIKTOK_ACCOUNT_ID) return () => {};
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await autopostNext(); // one post per tick keeps well under TikTok's daily caps
    } catch (err) {
      logger.error({ err }, "autopost tick failed");
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => void tick(), INTERVAL_MS);
  timer.unref();
  void tick();
  return () => clearInterval(timer);
}
