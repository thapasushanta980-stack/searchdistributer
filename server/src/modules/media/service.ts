import { randomUUID } from "node:crypto";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { AD_PLACEMENT_CREATIVE_SPECS, type AdPlacement } from "@sd/shared";
import sharp, { type Metadata } from "sharp";
import { config } from "../../config.js";
import { HttpError } from "../../lib/errors.js";

export const MEDIA_KINDS = ["logo", "cover", "gallery", "product", "ad"] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

const configured = !!config.MEDIA_BUCKET && !!config.MEDIA_PUBLIC_URL;
const s3 = new S3Client({
  region: config.MEDIA_REGION,
  ...(config.MEDIA_ENDPOINT ? { endpoint: config.MEDIA_ENDPOINT, forcePathStyle: true } : {}),
  ...(config.MEDIA_ACCESS_KEY_ID && config.MEDIA_SECRET_ACCESS_KEY
    ? { credentials: { accessKeyId: config.MEDIA_ACCESS_KEY_ID, secretAccessKey: config.MEDIA_SECRET_ACCESS_KEY } }
    : {}),
});

const publicBase = () => {
  if (!configured) throw new HttpError(503, "MEDIA_NOT_CONFIGURED", "Image uploads are not configured yet.");
  return `${config.MEDIA_PUBLIC_URL!.replace(/\/+$/, "")}/`;
};

/** Validate, rotate, resize and normalize all uploads before they become public. */
export async function uploadImage(kind: MediaKind, input: Buffer, placement?: AdPlacement) {
  const base = publicBase();
  if (!input.length || input.length > 12 * 1024 * 1024) throw new HttpError(413, "IMAGE_TOO_LARGE", "Choose an image smaller than 12 MB.");
  if (kind === "ad" && !placement) throw new HttpError(400, "AD_PLACEMENT_REQUIRED", "Choose the ad placement before uploading its creative.");
  let meta: Metadata;
  try {
    meta = await sharp(input, { limitInputPixels: 40_000_000, animated: false }).metadata();
  } catch {
    throw new HttpError(400, "INVALID_IMAGE", "Choose a valid JPG, PNG or WebP image.");
  }
  if (!meta.width || !meta.height || !["jpeg", "png", "webp"].includes(meta.format ?? "")) {
    throw new HttpError(400, "INVALID_IMAGE", "Choose a valid JPG, PNG or WebP image.");
  }

  let output: Buffer;
  const crop = kind === "ad" && placement ? AD_PLACEMENT_CREATIVE_SPECS[placement] : undefined;
  try {
    output = await sharp(input, { limitInputPixels: 40_000_000, animated: false })
      .rotate()
      .resize(crop
        ? { width: crop.width, height: crop.height, fit: "cover", position: "centre" }
        : { width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 84 })
      .toBuffer();
  } catch {
    throw new HttpError(400, "INVALID_IMAGE", "This image could not be processed. Try another file.");
  }

  const key = `media/${kind}/${randomUUID()}.webp`;
  try {
    await s3.send(new PutObjectCommand({
      Bucket: config.MEDIA_BUCKET,
      Key: key,
      Body: output,
      ContentType: "image/webp",
      CacheControl: "public, max-age=31536000, immutable",
    }));
  } catch {
    throw new HttpError(502, "MEDIA_UPLOAD_FAILED", "Image upload failed. Please try again.");
  }
  const outputMeta = await sharp(output).metadata();
  return { url: new URL(key, base).toString(), width: outputMeta.width ?? meta.width, height: outputMeta.height ?? meta.height };
}

/** Only delete objects under this app's public media prefix. Legacy external URLs are left alone. */
export async function deleteImage(url: string) {
  const base = publicBase();
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new HttpError(400, "INVALID_MEDIA_URL", "Invalid image URL.");
  }
  const prefix = new URL(base);
  if (parsed.origin !== prefix.origin || !parsed.pathname.startsWith(prefix.pathname)) return { deleted: false };
  const key = decodeURIComponent(parsed.pathname.slice(prefix.pathname.length));
  if (!/^media\/(logo|cover|gallery|product|ad)\/[0-9a-f-]+\.webp$/i.test(key)) return { deleted: false };
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: config.MEDIA_BUCKET, Key: key }));
  } catch {
    throw new HttpError(502, "MEDIA_DELETE_FAILED", "Image removal failed. Please try again.");
  }
  return { deleted: true };
}
