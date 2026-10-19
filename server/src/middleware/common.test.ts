import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express from "express";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { errorHandler } from "./common.js";

describe("errorHandler with body-parser errors", () => {
  let server: Server;
  let base: string;

  beforeAll(async () => {
    const app = express();
    app.post("/echo", express.json({ limit: "1kb" }), (req, res) => res.json(req.body));
    app.get(["/boom", "/api/v1/boom"], () => {
      throw new Error("kaboom");
    });
    app.use(errorHandler);
    server = app.listen(0);
    await new Promise((r) => server.once("listening", r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise((r) => server.close(r)));

  const post = (body: string, headers: Record<string, string> = {}) =>
    fetch(`${base}/echo`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body });

  it("answers 413 for an oversized body instead of a 500", async () => {
    const res = await post(JSON.stringify({ x: "a".repeat(5_000) }));
    expect(res.status).toBe(413);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("answers 400 for malformed JSON", async () => {
    const res = await post("{not json");
    expect(res.status).toBe(400);
  });

  it("serves an HTML error page to browsers and JSON to API clients", async () => {
    const page = await fetch(`${base}/boom`, { headers: { accept: "text/html,*/*" } });
    expect(page.status).toBe(500);
    expect(page.headers.get("content-type")).toContain("text/html");
    expect(await page.text()).toContain("Something went wrong");

    const api = await fetch(`${base}/api/v1/boom`, { headers: { accept: "text/html,*/*" } });
    expect(api.status).toBe(500);
    expect(((await api.json()) as { error: { code: string } }).error.code).toBe("INTERNAL");
  });

  it("answers 4xx for an unsupported charset", async () => {
    const res = await post("{}", { "content-type": "application/json; charset=klingon" });
    expect(res.status).toBe(415);
  });
});
