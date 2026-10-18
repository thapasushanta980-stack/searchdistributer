import { config } from "../../config.js";
import { prisma } from "../../db.js";
import { HttpError, notFound } from "../../lib/errors.js";
import { createPost } from "./zernio.js";

export interface TikTokPostInput {
  distributorId: string;
  /** Public direct-download URL of a single video (MP4/MOV/WebM, 9:16, 3s-10min). */
  videoUrl?: string;
  /** Alternatively 1-35 public image URLs for a photo carousel. */
  imageUrls?: string[];
  caption?: string;
  /** ISO local time, read in `timezone`. Omit with publishNow=false to save a Zernio draft. */
  scheduledFor?: string;
  timezone?: string;
  publishNow?: boolean;
  /** Deliver to the creator's TikTok inbox instead of posting publicly. */
  draft?: boolean;
}

function defaultCaption(d: { name: string; summary: string; location: string; slug: string }) {
  const tags = "#distributor #business #wholesale";
  const link = `${config.siteUrl}/distributors/${d.slug}`;
  return `${d.name} (${d.location}): ${d.summary}\n${link}\n${tags}`.slice(0, 2200);
}

export async function postDistributorToTikTok(input: TikTokPostInput) {
  const accountId = config.ZERNIO_TIKTOK_ACCOUNT_ID;
  if (!accountId) throw new HttpError(503, "SOCIAL_DISABLED", "ZERNIO_TIKTOK_ACCOUNT_ID is not set.");
  if (!input.videoUrl === !input.imageUrls?.length) {
    throw new HttpError(400, "INVALID_MEDIA", "Provide exactly one of videoUrl or imageUrls: TikTok requires media.");
  }

  const d = await prisma.distributor.findUnique({
    where: { id: input.distributorId },
    select: { name: true, summary: true, location: true, slug: true, status: true, publicationEnabled: true },
  });
  if (!d) throw notFound("Distributor not found.");
  if (d.status !== "APPROVED" || !d.publicationEnabled) {
    throw new HttpError(409, "NOT_PUBLIC", "Only published distributors can be promoted.");
  }

  const caption = input.caption ?? defaultCaption(d);
  const photo = !input.videoUrl;
  const tiktokSettings = {
    privacy_level: "PUBLIC_TO_EVERYONE",
    allow_comment: true,
    ...(photo ? { media_type: "photo", description: caption, auto_add_music: true } : { allow_duet: false, allow_stitch: false }),
    ...(input.draft ? { draft: true } : {}),
    content_preview_confirmed: true,
    express_consent_given: true,
  };

  const mode = input.publishNow ? { publishNow: true } : input.scheduledFor ? { scheduledFor: input.scheduledFor, timezone: input.timezone ?? "UTC" } : {};
  return createPost({
    content: photo ? caption.slice(0, 90) : caption,
    mediaItems: photo ? input.imageUrls!.map((url) => ({ type: "image", url })) : [{ type: "video", url: input.videoUrl }],
    platforms: [{ platform: "tiktok", accountId }],
    tiktokSettings,
    ...mode,
  });
}

