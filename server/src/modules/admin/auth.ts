import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import type { AdminRole } from "@prisma/client";
import { prisma } from "../../db.js";

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const SCRYPT = { N: 16384, r: 8, p: 1 } as const;

export interface AdminPrincipal {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  sessionId: string;
}

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

function derive(password: string, salt: Buffer, n: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(password, salt, 64, { N: n, r, p }, (err, key) => (err ? reject(err) : resolve(key))));
}

/** Format: scrypt$N$r$p$saltHex$hashHex */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, SCRYPT.N, SCRYPT.r, SCRYPT.p);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = await derive(password, Buffer.from(saltHex, "hex"), Number(n), Number(r), Number(p));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// Verified against when the email is unknown, so response time does not reveal which emails exist.
const DUMMY_HASH = hashPassword("not-a-real-password");

export async function login(email: string, password: string, ctx: { ip?: string; userAgent?: string }) {
  const admin = await prisma.adminUser.findUnique({ where: { email: email.trim().toLowerCase() } });
  const ok = await verifyPassword(password, admin?.passwordHash ?? (await DUMMY_HASH));
  if (!admin || !admin.isActive || !ok) return null;

  const token = randomBytes(32).toString("base64url");
  await prisma.$transaction([
    prisma.adminSession.create({
      data: { tokenHash: sha256(token), adminId: admin.id, expiresAt: new Date(Date.now() + SESSION_TTL_MS), ip: ctx.ip, userAgent: ctx.userAgent?.slice(0, 300) },
    }),
    prisma.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } }),
  ]);
  return { token, expiresAt: new Date(Date.now() + SESSION_TTL_MS), admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role } };
}

/** Resolves a cookie token to an active admin, or null. Expired sessions are removed lazily. */
export async function authenticate(token: string | undefined): Promise<AdminPrincipal | null> {
  if (!token || token.length > 100) return null;
  const session = await prisma.adminSession.findUnique({ where: { tokenHash: sha256(token) }, include: { admin: true } });
  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now() || !session.admin.isActive) {
    await prisma.adminSession.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  return { id: session.admin.id, email: session.admin.email, name: session.admin.name, role: session.admin.role, sessionId: session.id };
}

export async function logout(token: string | undefined): Promise<void> {
  if (token) await prisma.adminSession.deleteMany({ where: { tokenHash: sha256(token) } });
}

export const SESSION_COOKIE = "sd_admin";
export const sessionMaxAgeMs = SESSION_TTL_MS;
