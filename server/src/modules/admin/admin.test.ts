import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/** Minimal in-memory stand-in for the Prisma models the admin code touches. */
const db = vi.hoisted(() => {
  const state = {
    users: [] as any[],
    sessions: [] as any[],
    audit: [] as any[],
    requirements: [] as any[],
  };
  let seq = 0;
  const id = () => `00000000-0000-0000-0000-${String(++seq).padStart(12, "0")}`;
  const pick = (rows: any[], where: any) => rows.find((r) => Object.entries(where).every(([k, v]) => r[k] === v));

  const prisma: any = {
    adminUser: {
      findUnique: async ({ where }: any) => pick(state.users, where) ?? null,
      update: async ({ where, data }: any) => Object.assign(pick(state.users, where), data),
    },
    adminSession: {
      create: async ({ data }: any) => {
        const row = { id: id(), lastSeenAt: new Date(), ...data }; // lastSeenAt defaults to now(), as in the schema
        state.sessions.push(row);
        return row;
      },
      findUnique: async ({ where }: any) => {
        const s = pick(state.sessions, where);
        return s ? { ...s, admin: state.users.find((u) => u.id === s.adminId) } : null;
      },
      delete: async ({ where }: any) => {
        state.sessions = state.sessions.filter((s) => s.id !== where.id);
      },
      update: async ({ where, data }: any) => Object.assign(pick(state.sessions, where), data),
      deleteMany: async ({ where }: any) => {
        const before = state.sessions.length;
        const hit = (s: any) =>
          where.OR
            ? where.OR.some((c: any) => (c.expiresAt ? s.expiresAt <= c.expiresAt.lte : s.lastSeenAt < c.lastSeenAt.lt))
            : Object.entries(where).every(([k, v]) => s[k] === v);
        state.sessions = state.sessions.filter((s) => !hit(s));
        return { count: before - state.sessions.length };
      },
    },
    auditLog: {
      create: async ({ data }: any) => {
        const row = { id: id(), ...data };
        state.audit.push(row);
        return row;
      },
    },
    requirement: {
      // Prisma returns snapshots, not live references.
      findUnique: async ({ where }: any) => {
        const r = pick(state.requirements, where);
        return r ? { ...r } : null;
      },
      update: async ({ where, data }: any) => Object.assign(pick(state.requirements, where), data),
    },
    $transaction: async (arg: any) => (typeof arg === "function" ? arg(prisma) : Promise.all(arg)),
  };
  return { state, prisma, id };
});

vi.mock("../../db.js", () => ({ prisma: db.prisma }));

import { errorHandler } from "../../middleware/common.js";
import { admin } from "../../routes/admin.js";
import { hashPassword, purgeDeadSessions, revokeAllSessions, verifyPassword } from "./auth.js";

const PASSWORD = "correct horse battery";
let server: Server;
let base: string;

beforeAll(async () => {
  const app = express();
  app.use("/api/admin/v1", express.json(), admin);
  app.use(errorHandler);
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/admin/v1`;
});

afterAll(() => new Promise((resolve) => server.close(resolve)));

const REQ_ID = "11111111-1111-1111-1111-111111111111";

beforeEach(async () => {
  db.state.sessions = [];
  db.state.audit = [];
  const hash = await hashPassword(PASSWORD);
  db.state.users = [
    { id: "u-super", email: "super@example.com", name: "Super", passwordHash: hash, role: "SUPER_ADMIN", isActive: true },
    { id: "u-mod", email: "mod@example.com", name: "Mod", passwordHash: hash, role: "MODERATOR", isActive: true },
    { id: "u-off", email: "off@example.com", name: "Off", passwordHash: hash, role: "MODERATOR", isActive: false },
  ];
  db.state.requirements = [{ id: REQ_ID, status: "PENDING_REVIEW" }];
});

const call = (path: string, init: { method?: string; body?: unknown; cookie?: string; csrf?: boolean } = {}) =>
  fetch(`${base}${path}`, {
    method: init.method ?? "GET",
    headers: {
      "content-type": "application/json",
      ...(init.csrf === false ? {} : { "x-sd-admin": "1" }),
      ...(init.cookie ? { cookie: init.cookie } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });

async function signIn(email: string, password = PASSWORD) {
  const res = await call("/auth/login", { method: "POST", body: { email, password } });
  const cookie = res.headers.get("set-cookie")?.split(";")[0];
  return { res, cookie };
}

describe("password hashing", () => {
  it("verifies the right password and rejects others", async () => {
    const h = await hashPassword(PASSWORD);
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword(PASSWORD, h)).toBe(true);
    expect(await verifyPassword("wrong", h)).toBe(false);
    expect(await verifyPassword(PASSWORD, "garbage")).toBe(false);
  });

  it("salts every hash", async () => {
    expect(await hashPassword(PASSWORD)).not.toBe(await hashPassword(PASSWORD));
  });
});

describe("login", () => {
  it("signs in and sets a hardened session cookie", async () => {
    const { res, cookie } = await signIn("super@example.com");
    expect(res.status).toBe(200);
    expect(cookie).toMatch(/^sd_admin=/);
    const header = res.headers.get("set-cookie")!;
    expect(header).toMatch(/HttpOnly/i);
    expect(header).toMatch(/SameSite=Strict/i);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(JSON.stringify(await res.json())).not.toContain("passwordHash");
    // Only a hash of the token is stored, never the token itself.
    expect(db.state.sessions[0].tokenHash).not.toBe(cookie!.split("=")[1]);
    expect(db.state.audit.map((a) => a.action)).toContain("admin.login");
  });

  it("normalises email case", async () => {
    expect((await signIn("SUPER@Example.com")).res.status).toBe(200);
  });

  it("rejects a wrong password, unknown email and disabled account with the same error", async () => {
    const bodies = [];
    for (const [email, pw] of [["super@example.com", "nope"], ["ghost@example.com", PASSWORD], ["off@example.com", PASSWORD]]) {
      const { res } = await signIn(email!, pw);
      expect(res.status).toBe(401);
      expect(res.headers.get("set-cookie")).toBeNull();
      bodies.push(await res.json());
    }
    expect(bodies[0]).toEqual(bodies[1]);
    expect(bodies[1]).toEqual(bodies[2]);
    expect(db.state.audit.filter((a) => a.action === "admin.login_failed")).toHaveLength(3);
  });

  it("rejects invalid input", async () => {
    const res = await call("/auth/login", { method: "POST", body: { email: "not-an-email", password: "" } });
    expect(res.status).toBe(400);
  });
});

describe("authentication", () => {
  it("blocks protected routes without a session", async () => {
    for (const path of ["/auth/me", "/stats", "/requirements", "/audit-log"]) {
      expect((await call(path)).status).toBe(401);
    }
  });

  it("rejects a forged or garbage cookie", async () => {
    expect((await call("/auth/me", { cookie: "sd_admin=forged" })).status).toBe(401);
    expect((await call("/auth/me", { cookie: `sd_admin=${"x".repeat(500)}` })).status).toBe(401);
  });

  it("returns the signed-in admin", async () => {
    const { cookie } = await signIn("mod@example.com");
    const res = await call("/auth/me", { cookie });
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({ id: "u-mod", email: "mod@example.com", name: "Mod", role: "MODERATOR" });
  });

  it("rejects an expired session and removes it", async () => {
    const { cookie } = await signIn("mod@example.com");
    db.state.sessions[0].expiresAt = new Date(Date.now() - 1000);
    expect((await call("/auth/me", { cookie })).status).toBe(401);
    expect(db.state.sessions).toHaveLength(0);
  });

  it("rejects a session that has been idle too long, even inside its 12 h lifetime", async () => {
    const { cookie } = await signIn("mod@example.com");
    db.state.sessions[0].lastSeenAt = new Date(Date.now() - 3 * 3600_000);
    expect((await call("/auth/me", { cookie })).status).toBe(401);
    expect(db.state.sessions).toHaveLength(0);
  });

  it("refreshes lastSeenAt on use, but not on every request", async () => {
    const { cookie } = await signIn("mod@example.com");
    const fresh = db.state.sessions[0].lastSeenAt;
    await call("/auth/me", { cookie });
    expect(db.state.sessions[0].lastSeenAt).toBe(fresh); // seen moments ago: no write
    db.state.sessions[0].lastSeenAt = new Date(Date.now() - 10 * 60_000);
    const stale = db.state.sessions[0].lastSeenAt;
    expect((await call("/auth/me", { cookie })).status).toBe(200);
    expect(db.state.sessions[0].lastSeenAt.getTime()).toBeGreaterThan(stale.getTime());
  });

  it("rejects a session whose admin was deactivated", async () => {
    const { cookie } = await signIn("mod@example.com");
    db.state.users.find((u) => u.id === "u-mod").isActive = false;
    expect((await call("/auth/me", { cookie })).status).toBe(401);
  });

  it("logout invalidates the session", async () => {
    const { cookie } = await signIn("mod@example.com");
    expect((await call("/auth/logout", { method: "POST", cookie })).status).toBe(204);
    expect((await call("/auth/me", { cookie })).status).toBe(401);
  });
});

describe("CSRF header", () => {
  it("is required to log in", async () => {
    const res = await call("/auth/login", { method: "POST", csrf: false, body: { email: "super@example.com", password: PASSWORD } });
    expect(res.status).toBe(403);
    expect(db.state.sessions).toHaveLength(0);
  });

  it("is required on state-changing requests even with a valid session", async () => {
    const { cookie } = await signIn("mod@example.com");
    const res = await call(`/requirements/${REQ_ID}/decision`, { method: "POST", cookie, csrf: false, body: { decision: "APPROVE" } });
    expect(res.status).toBe(403);
    expect(db.state.requirements[0].status).toBe("PENDING_REVIEW");
  });

  it("is required to log out", async () => {
    const { cookie } = await signIn("mod@example.com");
    expect((await call("/auth/logout", { method: "POST", cookie, csrf: false })).status).toBe(403);
    expect((await call("/auth/me", { cookie })).status).toBe(200);
  });

  it("is not needed for reads", async () => {
    const { cookie } = await signIn("mod@example.com");
    expect((await call("/auth/me", { cookie, csrf: false })).status).toBe(200);
  });
});

describe("role gating", () => {
  it("lets a moderator moderate but not read the audit log", async () => {
    const { cookie } = await signIn("mod@example.com");
    expect((await call("/audit-log", { cookie })).status).toBe(403);
    expect((await call(`/requirements/${REQ_ID}/decision`, { method: "POST", cookie, body: { decision: "APPROVE" } })).status).toBe(200);
  });
});

describe("moderation decision", () => {
  const decide = (cookie: string | undefined, body: unknown, id = REQ_ID) => call(`/requirements/${id}/decision`, { method: "POST", cookie, body });

  it("approves a pending requirement and writes an audit row", async () => {
    const { cookie } = await signIn("mod@example.com");
    const res = await decide(cookie, { decision: "APPROVE" });
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({ id: REQ_ID, status: "APPROVED" });
    expect(db.state.requirements[0].status).toBe("APPROVED");
    const row = db.state.audit.find((a) => a.action === "requirement.approve");
    expect(row).toMatchObject({ adminId: "u-mod", entityType: "Requirement", entityId: REQ_ID, meta: { from: "PENDING_REVIEW", to: "APPROVED", reason: null } });
  });

  it("rejects with a reason", async () => {
    const { cookie } = await signIn("mod@example.com");
    expect((await decide(cookie, { decision: "REJECT", reason: "Spam" })).status).toBe(200);
    expect(db.state.requirements[0].status).toBe("REJECTED");
    expect(db.state.audit.find((a) => a.action === "requirement.reject").meta.reason).toBe("Spam");
  });

  it("requires a reason to reject", async () => {
    const { cookie } = await signIn("mod@example.com");
    const res = await decide(cookie, { decision: "REJECT" });
    expect(res.status).toBe(400);
    expect(db.state.requirements[0].status).toBe("PENDING_REVIEW");
    expect(db.state.audit.filter((a) => a.action.startsWith("requirement."))).toHaveLength(0);
  });

  it("refuses to decide twice (409) and leaves the first decision intact", async () => {
    const { cookie } = await signIn("mod@example.com");
    await decide(cookie, { decision: "APPROVE" });
    const second = await decide(cookie, { decision: "REJECT", reason: "changed mind" });
    expect(second.status).toBe(409);
    expect(db.state.requirements[0].status).toBe("APPROVED");
    expect(db.state.audit.filter((a) => a.action.startsWith("requirement."))).toHaveLength(1);
  });

  it("returns 404 for an unknown or malformed id", async () => {
    const { cookie } = await signIn("mod@example.com");
    expect((await decide(cookie, { decision: "APPROVE" }, "22222222-2222-2222-2222-222222222222")).status).toBe(404);
    expect((await decide(cookie, { decision: "APPROVE" }, "not-an-id")).status).toBe(404);
  });

  it("requires authentication", async () => {
    expect((await decide(undefined, { decision: "APPROVE" })).status).toBe(401);
    expect(db.state.requirements[0].status).toBe("PENDING_REVIEW");
  });
});

describe("session housekeeping", () => {
  const session = (id: string, adminId: string, over: object = {}) => ({ id, tokenHash: id, adminId, expiresAt: new Date(Date.now() + 3600_000), lastSeenAt: new Date(), ...over });

  it("purges expired and idle sessions but keeps live ones", async () => {
    db.state.sessions = [
      session("live", "u-mod"),
      session("expired", "u-mod", { expiresAt: new Date(Date.now() - 1000) }),
      session("idle", "u-mod", { lastSeenAt: new Date(Date.now() - 3 * 3600_000) }),
    ];
    expect(await purgeDeadSessions()).toBe(2);
    expect(db.state.sessions.map((s) => s.id)).toEqual(["live"]);
  });

  it("revokeAllSessions signs one admin out everywhere and leaves others alone", async () => {
    db.state.sessions = [session("a", "u-mod"), session("b", "u-mod"), session("c", "u-super")];
    await revokeAllSessions("u-mod");
    expect(db.state.sessions.map((s) => s.id)).toEqual(["c"]);
  });
});
