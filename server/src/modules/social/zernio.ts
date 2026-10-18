import { config } from "../../config.js";
import { HttpError } from "../../lib/errors.js";

/** Minimal Zernio REST client (https://docs.zernio.com). Only the calls this app needs. */
async function zernio<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<{ status: number; data: T }> {
  if (!config.ZERNIO_API_KEY) throw new HttpError(503, "SOCIAL_DISABLED", "Zernio is not configured (ZERNIO_API_KEY).");
  const res = await fetch(`${config.ZERNIO_API_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${config.ZERNIO_API_KEY}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  // 207 means "post created but publishing failed": it is a 2xx, so callers inspect post.status themselves.
  if (!res.ok) throw new HttpError(res.status === 409 ? 409 : 502, "ZERNIO_ERROR", data.error ?? `Zernio returned ${res.status}.`);
  return { status: res.status, data };
}

export interface ZernioAccount {
  _id: string;
  platform: string;
  username?: string;
  isActive?: boolean;
}

export interface ZernioPost {
  _id: string;
  status: string;
  scheduledFor?: string;
  platforms: { platform: string; status: string; platformPostUrl?: string | null; errorMessage?: string }[];
}

export const listAccounts = async () => (await zernio<{ accounts: ZernioAccount[] }>("GET", "/accounts")).data.accounts;

export const getPost = async (id: string) => (await zernio<{ post: ZernioPost }>("GET", `/posts/${encodeURIComponent(id)}`)).data.post;

export const createPost = async (body: Record<string, unknown>) => {
  const { status, data } = await zernio<{ post: ZernioPost; error?: string }>("POST", "/posts", body);
  return { post: data.post, partialFailure: status === 207 || data.post?.status === "failed" };
};

export const getCreatorInfo = async (accountId: string, mediaType: "video" | "photo") =>
  (await zernio<Record<string, unknown>>("GET", `/accounts/${encodeURIComponent(accountId)}/tiktok/creator-info?mediaType=${mediaType}`)).data;

/** Upload a file through Zernio's presigned-URL flow and return its public URL (valid for 7 days). */
export async function uploadMedia(data: Buffer, filename: string, contentType: string): Promise<string> {
  const { data: p } = await zernio<{ uploadUrl: string; publicUrl: string }>("POST", "/media/presign", { filename, contentType, size: data.length });
  const put = await fetch(p.uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body: new Uint8Array(data), signal: AbortSignal.timeout(60_000) });
  if (!put.ok) throw new HttpError(502, "ZERNIO_UPLOAD", `Media upload failed (${put.status}).`);
  return p.publicUrl;
}
