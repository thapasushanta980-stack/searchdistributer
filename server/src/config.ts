import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import type { SiteConfigDTO } from "@sd/shared";

const bool = z
  .enum(["true", "false"])
  .default("false")
  .transform((v) => v === "true");

const blank = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().default(3000),
  SITE_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1),
  SHOW_DEMO_DATA: bool,
  ENQUIRY_EMAIL_VERIFICATION: z.enum(["true", "false"]).default("true").transform((v) => v === "true"),
  DEFAULT_CURRENCY: z.string().length(3).default("USD"),
  SMTP_HOST: z.preprocess(blank, z.string().optional()),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_USER: z.preprocess(blank, z.string().optional()),
  SMTP_PASS: z.preprocess(blank, z.string().optional()),
  MAIL_FROM: z.string().default("Search Distributor <no-reply@localhost>"),
  SUPPORT_EMAIL: z.preprocess(blank, z.string().email().optional()),
  SITE_NAME: z.string().default("Search Distributor"),
  SITE_TWITTER: z.preprocess(blank, z.string().optional()),
  SITE_EDITOR_NAME: z.preprocess(blank, z.string().optional()),
  SITE_EDITOR_ROLE: z.preprocess(blank, z.string().optional()),
  SITE_EDITOR_BIO: z.preprocess(blank, z.string().optional()),
  /** IANA timezone for analytics days and peak hours. */
  SITE_TIMEZONE: z
    .string()
    .default("Asia/Kathmandu")
    .refine((tz) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, "Unknown timezone"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const env = parsed.data;

if (env.NODE_ENV === "production" && env.SHOW_DEMO_DATA) {
  console.error("SHOW_DEMO_DATA must be false in production: demo records would be shown publicly.");
  process.exit(1);
}

// Misconfigurations that still boot but quietly break things in production. Printed at start so they show in deploy logs.
if (env.NODE_ENV === "production") {
  const site = new URL(env.SITE_URL);
  const warnings = [
    site.protocol !== "https:" && `SITE_URL is ${env.SITE_URL}: canonical URLs, the sitemap and email links should use https.`,
    ["localhost", "127.0.0.1"].includes(site.hostname) && "SITE_URL points at localhost: set it to the public URL.",
    !env.SMTP_HOST && "SMTP_HOST is not set: enquiry confirmations and notifications are only logged, nobody receives them.",
    env.MAIL_FROM.includes("@localhost") && "MAIL_FROM uses @localhost: set an address on a domain with SPF/DKIM.",
    !env.SUPPORT_EMAIL && "SUPPORT_EMAIL is not set: new leads and requirements to moderate are not emailed to anyone.",
  ].filter(Boolean);
  for (const w of warnings) console.warn(`[config] WARNING: ${w}`);
}

const here = path.dirname(fileURLToPath(import.meta.url));

export const config = {
  ...env,
  isProd: env.NODE_ENV === "production",
  /** Repo root regardless of whether we run from src/ (tsx) or dist/ (tsup). */
  rootDir: path.resolve(here, "../.."),
  siteUrl: env.SITE_URL.replace(/\/$/, ""),
};

export const siteConfig: SiteConfigDTO = {
  siteUrl: config.siteUrl,
  siteName: env.SITE_NAME,
  supportEmail: env.SUPPORT_EMAIL ?? null,
  twitter: env.SITE_TWITTER ?? null,
  editor:
    env.SITE_EDITOR_NAME && env.SITE_EDITOR_BIO
      ? { name: env.SITE_EDITOR_NAME, role: env.SITE_EDITOR_ROLE ?? null, bio: env.SITE_EDITOR_BIO }
      : null,
  showDemoData: env.SHOW_DEMO_DATA,
  defaultCurrency: env.DEFAULT_CURRENCY,
  emailVerificationRequired: env.ENQUIRY_EMAIL_VERIFICATION,
};
