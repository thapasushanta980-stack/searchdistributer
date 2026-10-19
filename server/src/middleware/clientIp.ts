import net from "node:net";
import type { NextFunction, Request, Response } from "express";

/**
 * Cloudflare's published edge ranges (https://www.cloudflare.com/ips/). They change rarely; refresh from that page if
 * Cloudflare announces new ones. A stale list only means those edges fall back to the edge IP, never a spoofable one.
 */
const CLOUDFLARE_RANGES = [
  "173.245.48.0/20", "103.21.244.0/22", "103.22.200.0/22", "103.31.4.0/22", "141.101.64.0/18", "108.162.192.0/18",
  "190.93.240.0/20", "188.114.96.0/20", "197.234.240.0/22", "198.41.128.0/17", "162.158.0.0/15", "104.16.0.0/13",
  "104.24.0.0/14", "172.64.0.0/13", "131.0.72.0/22",
  "2400:cb00::/32", "2606:4700::/32", "2803:f800::/32", "2405:b500::/32", "2405:8100::/32", "2a06:98c0::/29", "2c0f:f248::/32",
];

const cloudflare = new net.BlockList();
for (const cidr of CLOUDFLARE_RANGES) {
  const [addr, bits] = cidr.split("/") as [string, string];
  cloudflare.addSubnet(addr, Number(bits), net.isIPv6(addr) ? "ipv6" : "ipv4");
}

const unmap = (ip: string) => (ip.startsWith("::ffff:") && net.isIPv4(ip.slice(7)) ? ip.slice(7) : ip);

export function isCloudflare(ip: string): boolean {
  const addr = unmap(ip);
  const family = net.isIP(addr);
  return family !== 0 && cloudflare.check(addr, family === 6 ? "ipv6" : "ipv4");
}

/**
 * Behind Cloudflare -> Traefik, `req.ip` (trust proxy = 1) is the Cloudflare edge, shared by many visitors, so rate
 * limits and audit logs would lump them together. When the hop Traefik saw is a Cloudflare edge, use the visitor IP
 * Cloudflare reports in CF-Connecting-IP. The header is ignored for anything else, so a client that reaches the origin
 * directly cannot spoof it.
 */
export function cloudflareClientIp(req: Request, _res: Response, next: NextFunction) {
  const edge = req.ip;
  const reported = req.get("cf-connecting-ip")?.trim();
  if (edge && reported && net.isIP(reported) && isCloudflare(edge)) {
    Object.defineProperty(req, "ip", { value: reported, configurable: true, enumerable: true });
  }
  next();
}
