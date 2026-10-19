import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express from "express";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cloudflareClientIp, isCloudflare } from "./clientIp.js";

describe("isCloudflare", () => {
  it("matches Cloudflare edges in IPv4, IPv4-mapped and IPv6 form", () => {
    expect(isCloudflare("172.70.1.2")).toBe(true);
    expect(isCloudflare("::ffff:162.158.10.20")).toBe(true);
    expect(isCloudflare("2606:4700:10::ac43:1")).toBe(true);
  });

  it("rejects other and malformed addresses", () => {
    expect(isCloudflare("203.0.113.9")).toBe(false);
    expect(isCloudflare("127.0.0.1")).toBe(false);
    expect(isCloudflare("not-an-ip")).toBe(false);
  });
});

describe("cloudflareClientIp", () => {
  let server: Server;
  let base: string;

  beforeAll(async () => {
    // Mirrors production: one trusted proxy hop (Traefik) whose X-Forwarded-For entry is the peer it saw.
    const app = express();
    app.set("trust proxy", 1);
    app.use(cloudflareClientIp);
    app.get("/ip", (req, res) => res.json({ ip: req.ip }));
    server = app.listen(0);
    await new Promise((r) => server.once("listening", r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise((r) => server.close(r)));

  const ipFor = async (headers: Record<string, string>) => ((await (await fetch(`${base}/ip`, { headers })).json()) as { ip: string }).ip;

  it("uses CF-Connecting-IP when the request came through a Cloudflare edge", async () => {
    expect(await ipFor({ "x-forwarded-for": "172.70.1.2", "cf-connecting-ip": "198.51.100.7" })).toBe("198.51.100.7");
  });

  it("ignores CF-Connecting-IP from a client that reached the origin directly", async () => {
    expect(await ipFor({ "x-forwarded-for": "203.0.113.9", "cf-connecting-ip": "198.51.100.7" })).toBe("203.0.113.9");
  });

  it("ignores a spoofed Cloudflare address further left in X-Forwarded-For", async () => {
    expect(await ipFor({ "x-forwarded-for": "172.70.1.2, 203.0.113.9", "cf-connecting-ip": "198.51.100.7" })).toBe("203.0.113.9");
  });

  it("ignores a malformed CF-Connecting-IP", async () => {
    expect(await ipFor({ "x-forwarded-for": "172.70.1.2", "cf-connecting-ip": "evil" })).toBe("172.70.1.2");
  });
});
