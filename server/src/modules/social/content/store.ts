import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp, { type OutputInfo, type OverlayOptions } from "sharp";
import { z } from "zod";
import { config } from "../../../config.js";
import { HttpError, notFound } from "../../../lib/errors.js";
import { defaultTopics, type Topic } from "./topics.js";

/** File-backed Content Studio storage under <repo>/data/studio (git-ignored). */
const dir = path.join(config.rootDir, "data", "studio");
const filesDir = path.join(dir, "assets");
const manifestPath = path.join(dir, "assets.json");
const topicsPath = path.join(dir, "topics.json");

export const ASSET_KINDS = ["logo", "screenshot", "reference"] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];
export interface Asset {
  id: string;
  kind: AssetKind;
  name: string;
  file: string;
  width: number;
  height: number;
  createdAt: string;
}

const ensure = () => fs.mkdirSync(filesDir, { recursive: true });
const readJson = <T>(p: string, fallback: T): T => {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as T;
  } catch {
    return fallback;
  }
};
const writeJson = (p: string, v: unknown) => {
  ensure();
  fs.writeFileSync(p, JSON.stringify(v, null, 2));
};

export const listAssets = (): Asset[] => readJson<Asset[]>(manifestPath, []);

export function getAsset(id: string): Asset {
  const a = listAssets().find((x) => x.id === id);
  if (!a) throw notFound("Asset not found.");
  return a;
}

export const readAssetFile = (a: Asset): Buffer => fs.readFileSync(path.join(filesDir, a.file));

/** Accepts JPEG/PNG/WebP only (SVG is refused), strips metadata, caps size, and stores as PNG. */
export async function saveAsset(kind: AssetKind, name: string, data: Buffer): Promise<Asset> {
  let img: { data: Buffer; info: OutputInfo };
  try {
    const meta = await sharp(data).metadata();
    if (!meta.format || !["jpeg", "png", "webp"].includes(meta.format)) throw new Error("format");
    img = await sharp(data).rotate().resize({ width: 2000, height: 2400, fit: "inside", withoutEnlargement: true }).png().toBuffer({ resolveWithObject: true });
  } catch {
    throw new HttpError(400, "INVALID_IMAGE", "Upload a JPEG, PNG or WebP image.");
  }
  const id = randomUUID();
  const asset: Asset = {
    id,
    kind,
    name: name.slice(0, 80) || "untitled",
    file: `${id}.png`,
    width: img.info.width,
    height: img.info.height,
    createdAt: new Date().toISOString(),
  };
  ensure();
  fs.writeFileSync(path.join(filesDir, asset.file), img.data);
  writeJson(manifestPath, [...listAssets(), asset]);
  return asset;
}

export function deleteAsset(id: string): void {
  const a = getAsset(id);
  fs.rmSync(path.join(filesDir, a.file), { force: true });
  writeJson(manifestPath, listAssets().filter((x) => x.id !== id));
}

const slideSchema = z.object({
  kicker: z.string().max(20),
  title: z.string().min(1).max(90),
  lines: z.array(z.string().max(120)).max(6),
  assetId: z.string().uuid().optional(),
});
export const topicSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{2,40}$/),
  slides: z.tuple([slideSchema, slideSchema, slideSchema]),
  caption: z.string().min(1).max(2000),
  enabled: z.boolean().optional(),
});

/** Saved topics if the studio has edited them, otherwise the built-in defaults. */
export const getTopics = (): Topic[] => readJson<Topic[] | null>(topicsPath, null) ?? defaultTopics;
export const getTopic = (id: string): Topic => getTopics().find((t) => t.id === id) ?? (() => { throw notFound("Topic not found."); })();

export function saveTopics(topics: Topic[]): void {
  writeJson(topicsPath, topics);
}

/** The logo used in slide headers: the most recently uploaded asset of kind "logo". */
export function currentLogo(): Asset | undefined {
  return listAssets().filter((a) => a.kind === "logo").at(-1);
}
