import { config } from "../../../config.js";
import { prisma } from "../../../db.js";
import { HttpError } from "../../../lib/errors.js";
import { createPost, uploadMedia } from "../zernio.js";
import { renderSlide } from "./render.js";
import { currentLogo, getAsset, getTopics, readAssetFile } from "./store.js";
import type { Topic } from "./topics.js";

export const CONTENT_ACTION = "social.nurvexa_post";

/** Render a topic's slides using the studio's uploaded logo and each slide's screenshot (missing assets fall back to text-only). */
export function renderTopic(t: Topic): Promise<Buffer[]> {
  const logoAsset = currentLogo();
  const logo = logoAsset ? readAssetFile(logoAsset) : undefined;
  return Promise.all(
    t.slides.map((slide) => {
      let screenshot: Buffer | undefined;
      try {
        screenshot = slide.assetId ? readAssetFile(getAsset(slide.assetId)) : undefined;
      } catch {
        screenshot = undefined;
      }
      return renderSlide(slide, { logo, screenshot });
    }),
  );
}

/** Next topic not yet posted; once all are used the rotation restarts from the least recently posted. */
export async function pickNextTopic(): Promise<Topic> {
  const rows = await prisma.auditLog.findMany({
    where: { action: CONTENT_ACTION },
    orderBy: { createdAt: "desc" },
    select: { entityId: true },
  });
  const recent = rows.map((r) => r.entityId);
  const topics = getTopics().filter((t) => t.enabled !== false);
  if (!topics.length) throw new HttpError(409, "NO_TOPICS", "No enabled topics.");
  const unused = topics.find((t) => !recent.includes(t.id));
  if (unused) return unused;
  const lastSeen = new Map(topics.map((t) => [t.id, recent.indexOf(t.id)]));
  return [...topics].sort((a, b) => (lastSeen.get(b.id) ?? 0) - (lastSeen.get(a.id) ?? 0))[0]!;
}

/** Render, upload and post one carousel. mode "draft" lands in the creator's TikTok inbox; "publish" goes live. */
export async function postTopic(topic: Topic, mode: "draft" | "publish") {
  const accountId = config.ZERNIO_TIKTOK_ACCOUNT_ID;
  if (!accountId) throw new HttpError(503, "SOCIAL_DISABLED", "ZERNIO_TIKTOK_ACCOUNT_ID is not set.");
  const pngs = await renderTopic(topic);
  const urls = await Promise.all(pngs.map((png, i) => uploadMedia(png, `${topic.id}-${i + 1}.png`, "image/png")));
  const result = await createPost({
    content: topic.slides[0].title.slice(0, 90),
    mediaItems: urls.map((url) => ({ type: "image", url })),
    platforms: [{ platform: "tiktok", accountId }],
    tiktokSettings: {
      privacy_level: "PUBLIC_TO_EVERYONE",
      allow_comment: true,
      media_type: "photo",
      description: topic.caption,
      auto_add_music: true,
      ...(mode === "draft" ? { draft: true } : {}),
      content_preview_confirmed: true,
      express_consent_given: true,
    },
    publishNow: true,
  });
  await prisma.auditLog.create({
    data: {
      action: CONTENT_ACTION,
      entityType: "content",
      entityId: topic.id,
      meta: { mode, zernioPostId: result.post?._id ?? null, status: result.post?.status ?? null, failed: result.partialFailure },
    },
  });
  return result;
}
