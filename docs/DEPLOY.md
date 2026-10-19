# Deploying to a VPS with Coolify

One Docker image serves the public site (SSR), the API and the `/admin` app. Postgres runs as a separate Coolify resource. The `Dockerfile` was built and smoke-tested locally from an empty database (migrations, seed, admin creation, login, SSR pages, sitemap, `/admin`).

## What the container does on start

1. Applies pending Prisma migrations (`prisma migrate deploy`).
2. Runs the idempotent category seed (never overwrites existing rows).
3. Starts the server as the unprivileged `node` user on port `3000`.

`/healthz` returns 200 only when the database answers. The image has a built-in health check.

## 1. Prerequisites

- A VPS with Coolify installed.
- The domain's DNS on Cloudflare (see below), or plain A records pointing at the VPS.
- This repository pushed to GitHub/GitLab (or any Git host Coolify can reach).

### Cloudflare in front of Coolify

The domain's nameservers are Cloudflare's, so Cloudflare proxies all traffic: visitor → Cloudflare → Coolify's Traefik on the VPS → app.

**DNS** (Cloudflare → DNS → Records). When Cloudflare imported the old zone it copied the registrar's parking records, so delete those first (the old `A`/`CNAME` records for `@` and `www`, which pointed at the Squarespace "Coming Soon" page).

| Type | Name | Content | Proxy |
|---|---|---|---|
| A | `@` | VPS IPv4 | Proxied (orange) |
| A | `www` | VPS IPv4 | Proxied (orange) |
| AAAA | `@`, `www` | VPS IPv6, only if the VPS has one and Coolify listens on it | Proxied |

**SSL/TLS** (Cloudflare → SSL/TLS → Overview):

- Never use **Flexible**. Traefik redirects HTTP to HTTPS, and Flexible talks HTTP to the origin, which loops forever.
- Use **Full (strict)**, the target setting. If Coolify hasn't got its Let's Encrypt certificate yet, use **Full** for the first deploy, confirm the site loads, then switch to **Full (strict)**. Let's Encrypt's HTTP challenge works through the orange cloud.
- Edge Certificates: turn on **Always Use HTTPS**. HSTS is already sent by the app (1 year, includeSubDomains), so leave Cloudflare's HSTS off to avoid two sources of truth.

**Settings to turn off**, because they rewrite the HTML after the server renders it and break React hydration or the Content-Security-Policy:

- Scrape Shield → **Email Address Obfuscation**: off.
- Speed → **Rocket Loader**: off.
- Any **Automatic HTTPS Rewrites** or "Auto Minify" leftovers are harmless but unnecessary.

**Caching:** the defaults are right. Cloudflare caches the hashed `/assets/*` files (the app marks them immutable) and does not cache HTML or JSON. Don't add a "Cache Everything" rule: pages and the admin app must not be cached at the edge. After the first real deploy, **Caching → Purge Everything** once to drop the cached parking page.

**Client IPs:** the app reads the visitor's address from Cloudflare's `CF-Connecting-IP` header, but only when the request reached Traefik from a Cloudflare edge address, so it can't be spoofed by calling the VPS directly. Rate limits and the admin audit log therefore see real visitors, not Cloudflare. Optional hardening: firewall ports 80/443 on the VPS to [Cloudflare's IP ranges](https://www.cloudflare.com/ips/) so nobody bypasses Cloudflare.

**Email DNS:** the imported zone has `TXT @ "v=spf1 -all"`, which tells every mail server to reject mail from this domain. Replace it with your mail provider's SPF record, and add their DKIM records (and a DMARC record such as `_dmarc  TXT  "v=DMARC1; p=none; rua=mailto:you@…"`) before going live. Without this, enquiry confirmation emails land in spam or bounce. Mail DNS records must be **DNS only** (grey cloud).

## 2. Create the database

Coolify → **Project → + New → Database → PostgreSQL 16**.

- Start it, then copy the **Postgres URL (internal)**. It looks like `postgres://user:pass@<uuid>:5432/postgres`.
- Turn on **scheduled backups** (Database → Backups) and point them at S3-compatible storage. Backups on the same VPS disk don't protect you from losing the VPS.
- Add `?schema=public` to the end of the URL you give the app.

## 3. Create the application

**+ New → Application → your Git repo**, then:

| Setting | Value |
|---|---|
| Build Pack | **Dockerfile** |
| Base Directory | `/` |
| Dockerfile Location | `/Dockerfile` |
| Ports Exposes | `3000` |
| Domains | `https://searchdistributor.online` (add `https://www.searchdistributor.online` too if you want; the app redirects www to the apex) |
| Health Check | leave to the Dockerfile, or path `/healthz` on port `3000` |

The app keeps no files on disk, so it needs no persistent volume. All state is in Postgres.

## 4. Environment variables

Set these under **Environment Variables** (runtime). Mark secrets as such.

| Variable | Value | Notes |
|---|---|---|
| `DATABASE_URL` | the internal Postgres URL + `?schema=public` | required |
| `SITE_URL` | `https://searchdistributor.online` | required; exact public URL, no trailing slash. Drives canonical URLs, the sitemap and the www redirect |
| `SHOW_DEMO_DATA` | `false` | the app refuses to start in production if this is `true` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | your mail provider | without SMTP, enquiry confirmation emails are only logged and **nobody receives them** |
| `MAIL_FROM` | `Search Distributor <no-reply@searchdistributor.online>` | use a domain you've set SPF/DKIM for |
| `SUPPORT_EMAIL` | your inbox | receives new leads and requirements to moderate |
| `SITE_NAME` | optional | |
| `ENQUIRY_EMAIL_VERIFICATION` | `true` (default) | |

Do not commit real values. `.env` files are excluded from the image.

## 5. Deploy, then create your first admin

Click **Deploy** and watch the logs for `All migrations have been successfully applied` and `listening on https://…`, and check there are no `[config] WARNING:` lines.

Then open the application's **Terminal** in Coolify and run (use your own values; 12+ character password):

```bash
ADMIN_EMAIL=you@searchdistributor.online ADMIN_NAME="Your Name" ADMIN_PASSWORD='choose-a-long-password' node server/dist/create-admin.js
```

Sign in at `https://searchdistributor.online/admin`. The session cookie is `Secure`, so the site must be served over HTTPS (Coolify does this with Let's Encrypt).

## 6. After the first deploy

- Visit `/healthz`, `/`, `/distributors`, `/sitemap.xml`, `/robots.txt`.
- Search Console: add the property and submit `https://searchdistributor.online/sitemap.xml`.
- Send a test enquiry and confirm the email arrives.
- Optional: enable auto-deploy on push (webhook) in the application's settings.

## Operating notes

- **One replica.** The email outbox and workers run inside the app process and the caches are per instance. Don't scale beyond one instance without moving those out (set `SKIP_MIGRATIONS=true` on extra replicas).
- **Updates:** push to Git, then redeploy. Migrations run automatically at start. Take a database backup before deploying a release that adds migrations.
- **Rollback:** redeploy the previous commit. Migrations are not reversed automatically, so write new migrations to be backward compatible.
- **Proxy:** the app trusts one proxy hop (`trust proxy = 1`), which matches Coolify's Traefik, and then swaps in `CF-Connecting-IP` when that hop is a Cloudflare edge (see [Cloudflare in front of Coolify](#cloudflare-in-front-of-coolify)). Rate limits and audit-log IPs rely on that. The Cloudflare ranges are in `server/src/middleware/clientIp.ts`.
- **Config warnings:** on start the app prints `[config] WARNING:` lines for settings that boot but break things quietly (http or localhost `SITE_URL`, no SMTP, `@localhost` sender, no `SUPPORT_EMAIL`). A clean production deploy log has none.
- **Resources:** a 1 vCPU / 2 GB VPS is enough to start. The image build needs about 2 GB of RAM; add swap if builds get killed.

## Rehearse locally (optional)

```bash
cp .env.production.example .env.production   # fill in POSTGRES_PASSWORD
docker compose -f docker-compose.prod.yml --env-file .env.production up --build
```

Then open http://localhost:3000.
