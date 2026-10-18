import express, { Router } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { HttpError } from "../lib/errors.js";
import { ah, parseOrThrow } from "../middleware/common.js";
import { audit } from "../modules/admin/audit.js";
import { renderTopic, postTopic } from "../modules/social/content/nurvexa.js";
import { ASSET_KINDS, deleteAsset, getAsset, getTopic, getTopics, listAssets, readAssetFile, saveAsset, saveTopics, topicSchema } from "../modules/social/content/store.js";

export const studio = Router();

studio.get("/status", (_req, res) => {
  res.json({
    data: {
      zernioConfigured: !!config.ZERNIO_API_KEY && !!config.ZERNIO_TIKTOK_ACCOUNT_ID,
      workerMode: config.NURVEXA_POST_MODE,
      workerHourNpt: config.NURVEXA_POST_HOUR,
    },
  });
});

studio.get("/assets", (_req, res) => {
  res.json({ data: listAssets() });
});

studio.post(
  "/assets",
  express.raw({ type: "image/*", limit: "8mb" }),
  ah(async (req, res) => {
    const { kind, name } = parseOrThrow(z.object({ kind: z.enum(ASSET_KINDS), name: z.string().max(80).default("") }), req.query);
    if (!Buffer.isBuffer(req.body) || !req.body.length) throw new HttpError(400, "INVALID_IMAGE", "Send the image as the request body (image/png, image/jpeg or image/webp).");
    const asset = await saveAsset(kind, name, req.body);
    await audit({ adminId: req.admin!.id, action: "studio.asset_upload", entityType: "asset", entityId: asset.id, meta: { kind }, ip: req.ip });
    res.status(201).json({ data: asset });
  }),
);

studio.get("/assets/:id/file", (req, res) => {
  const id = String(req.params.id);
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new HttpError(404, "NOT_FOUND", "Asset not found.");
  res.type("png").setHeader("Cache-Control", "private, max-age=300").send(readAssetFile(getAsset(id)));
});

studio.delete(
  "/assets/:id",
  ah(async (req, res) => {
    const id = String(req.params.id);
    if (!/^[0-9a-f-]{36}$/.test(id)) throw new HttpError(404, "NOT_FOUND", "Asset not found.");
    deleteAsset(id);
    await audit({ adminId: req.admin!.id, action: "studio.asset_delete", entityType: "asset", entityId: id, ip: req.ip });
    res.status(204).end();
  }),
);

studio.get("/topics", (_req, res) => {
  res.json({ data: getTopics() });
});

studio.put(
  "/topics",
  express.json({ limit: "256kb" }),
  ah(async (req, res) => {
    const topics = parseOrThrow(z.array(topicSchema).min(1).max(100), req.body);
    if (new Set(topics.map((t) => t.id)).size !== topics.length) throw new HttpError(400, "VALIDATION_ERROR", "Topic ids must be unique.");
    saveTopics(topics);
    await audit({ adminId: req.admin!.id, action: "studio.topics_save", meta: { count: topics.length }, ip: req.ip });
    res.json({ data: topics });
  }),
);

/** Render the 3 slides of an unsaved topic draft and return them as data URLs. */
studio.post(
  "/preview",
  express.json({ limit: "64kb" }),
  ah(async (req, res) => {
    const topic = parseOrThrow(topicSchema, req.body);
    const pngs = await renderTopic(topic);
    res.json({ data: pngs.map((b) => `data:image/png;base64,${b.toString("base64")}`) });
  }),
);

/** Post a saved topic now. "draft" lands in the TikTok Creator Inbox, "publish" goes live. */
studio.post(
  "/post",
  ah(async (req, res) => {
    const { topicId, mode } = parseOrThrow(z.object({ topicId: z.string(), mode: z.enum(["draft", "publish"]) }), req.body);
    const result = await postTopic(getTopic(topicId), mode);
    await audit({ adminId: req.admin!.id, action: "studio.post_now", entityType: "content", entityId: topicId, meta: { mode }, ip: req.ip });
    res.status(result.partialFailure ? 502 : 201).json({ data: result.post });
  }),
);
