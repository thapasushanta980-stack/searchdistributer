# Search Distributor

A B2B distributor-discovery marketplace: **Search → Discover → View Profile → Send Enquiry.**
Built from the Search Distributor build prompt, the *Brand & Distributor Marketplace PRD v1.0* and the *System Architecture* document.

| Layer | Stack |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4, Radix primitives (shadcn-style), TanStack Query, React Hook Form + Zod, Framer Motion, Lucide |
| Backend | Node 22, Express, TypeScript, Zod (modular monolith) |
| Data | PostgreSQL + Prisma (raw SQL only for the ranked search, always parameterised) |
| Rendering | Server-side rendering (SSR) of every public page, hydrated on the client |

## Run it

Requires Node 22+ and Docker (for Postgres).

```bash
npm install
cp .env.example server/.env     # the server and Prisma read server/.env
npm run db:up                   # Postgres on localhost:5433
npm run db:migrate
npm run db:seed                 # default category tree (config, not listing data)
npm run db:fixtures             # OPTIONAL local-only demo records (see "No invented data")
npm run dev                     # http://localhost:3000
```

Production: `npm run build && NODE_ENV=production npm start` (set `SHOW_DEMO_DATA=false`; the server refuses to start otherwise).

Dev emails: with no `SMTP_HOST`, outgoing mail (enquiry confirmation links) is printed to the server log.

Demo ad creatives (original abstract graphics) are generated with `node scripts/make-demo-ads.mjs` into `client/public/ads/` and referenced by the `isDemo` ad campaigns from `npm run db:fixtures`.

## Layout

```
client/   React app + SSR entry (entry-server.tsx / entry-client.tsx)
server/   Express API, Prisma schema + migrations, SSR host
shared/   Zod schemas, DTO types and enums used by both sides
```

Server modules (`server/src/modules`): `distributors`, `categories`, `products`, `enquiries`, `leads`, `notifications`.

## How the rules from the documents are enforced

- **Publication eligibility (PRD):** one SQL fragment, `eligibleDistributorSql()`, is the only definition of "public". It requires: listing `APPROVED` + `publicationEnabled`, organisation `ACTIVE`, profile review `APPROVED`, and a subscription period covering *now*. Search, profile, featured, suggestions, facets, categories counts, sitemap and enquiries all use it, so draft / rejected / paused / suspended / expired records never appear, and a delayed expiry job cannot keep content live.
- **No invented data:** the UI renders only what the API returns. `npm run db:fixtures` loads *fictional* records flagged `isDemo`; they are hidden everywhere unless `SHOW_DEMO_DATA=true` (blocked in production). The fixtures include draft/rejected/suspended/expired/paused records to prove they stay out.
- **Tenant safety:** enquiry recipients are resolved server-side from the published record; the client never sends an organisation id or recipient email.
- **Enquiry flow (ENQ-01…03):** idempotency key → one record; email confirmation before the brand is notified (`ENQUIRY_EMAIL_VERIFICATION`, default on, 24 h token, max 3 sends); notifications go through a DB outbox with retries and de-duplication.
- **Rate limiting:** global API limit, strict limits on enquiry/lead writes and token verification.
- **Verification labels:** "Verified" and "Profile reviewed" come from `verificationStatus`; nothing awards them automatically.

### Search
Also: `GET /requirements`, `GET /requirements/:slug`, `POST /requirements`, `POST /requirements/:slug/responses`, `GET /products/:slug`.

`GET /api/v1/distributors` — `keyword, category, subcategory, location, coverage, businessType, verified, reviewed, investmentMin, investmentMax, sort, page, limit`. Validated with Zod (invalid values → 400). The URL is the single source of truth, so searches are shareable and Back/Forward restore them. Keyword input is debounced 300 ms. Also: `/distributors/featured`, `/facets`, `/suggest`, `/distributors/:slug`, `/categories`, `/products`, `POST /enquiries`, `/enquiries/verify`, `/enquiries/resend`, `POST /leads`.

## Product map (what exists vs. what is planned)

| Area | Status |
|---|---|
| Home (tabbed hero search, network visual, quick actions, latest opportunities, featured brands, industries, how it works) | Built |
| `/distributors`, `/distributors/:slug` (search, filters, profile, enquiry with email confirmation) | Built |
| `/leads`, `/leads/:slug` (moderated requirements; contact details never public; businesses respond through the platform) | Built |
| `/post-requirement` (4-step wizard, moderation queue, reference number) | Built |
| `/products`, `/products/:slug`, `/brands`, `/brands/:slug`, `/categories` (+ mega menu) | Built |
| `/register`, `/contact` (stored leads), `/pricing`, `/about`, legal placeholders | Built (simple) |
| Accounts, login, 6-step registration wizard, brand dashboard | **Not built** |
| Advertising: 4 placements, campaign model, approval/payment/schedule gating, labelled creatives, measured impressions + clicks | Built (serving + measurement) |
| Advertiser dashboard, self-service booking, ad admin UI, billing | **Not built** (campaigns are created in the database for now) |
| Admin portal (approvals, payments, subscriptions, audit log, moderation UI) | **Not built** (requirements/listings are approved by changing `status` in the database for now) |
| Testimonials | **Intentionally absent** until real, consented testimonials exist |

## SEO checklist (from your screenshot)

| Item | Status |
|---|---|
| Render it server-side | Done. Every public page is SSR'd with data prefetched and dehydrated. |
| Generate a sitemap | Done: `/sitemap.xml`, built from eligible records only (no drafts/expired/demo). |
| Submit it to Search Console | **You must do this.** Add the property, then submit `https://<your-domain>/sitemap.xml`. |
| Unblock Googlebot in robots.txt | Done: `Allow: /`; only `/api/`, `/admin`, `/dashboard`, `/enquiries/` are disallowed; sitemap declared. |
| Delete the noindex tags | Done where wrong. `noindex` is used **deliberately** only for filtered/keyword searches, demo records, unavailable profiles, 404s, login and the placeholder legal pages. |
| Kill the redirect chains | Done: lower-case / trailing-slash / double-slash / www→apex are one 301 hop. |
| Fix the 404s | Done: unknown URLs and unavailable profiles return a real 404 status with a helpful page. |
| Add canonical tags | Done on every page; filtered searches canonicalise to the clean page (a single-category search → its category page). |
| Meta description for every page | Done, unique per page and per profile. |
| One H1 per page | Done (verified on all routes). |
| FAQ schema | Done on `/distributors` (visible FAQ + `FAQPage` JSON-LD). Note: Google now shows FAQ rich results only for a narrow set of sites, so treat it as markup, not a ranking lever. |
| Add breadcrumbs | Done: visible trail + `BreadcrumbList` JSON-LD. |
| Link the orphan pages | Done: pagination and cards are real `<a href>` links; category pages, related distributors, footer and sitemap reach every profile. |
| Alt text on every image | Done: logos use `"<name> logo"`; decorative marks are `aria-hidden`. |
| Convert images to WebP | **Partly.** Our own assets are SVG/CSS; the social image ships as PNG + WebP. Distributor logo/product **upload re-encoding to WebP + thumbnails** belongs to the brand-portal milestone (M2) and is not built yet. |
| Fix the layout shifts | Done: reserved sizes, skeletons, metric-matched fallback fonts, self-hosted fonts. |
| Load in under 2 seconds | Engineered for it (SSR HTML ≈10 kB gzip, ≈207 kB gzip JS split into cacheable chunks, forms lazy-loaded, immutable asset caching, gzip). **Not measured on a real network or Lighthouse yet** — run it against your staging domain. |
| Remove the obvious AI slop | Copy is plain and specific; no fabricated stats, testimonials or guarantees. |
| Add a real author bio | Supported but **needs a real person**: set `SITE_EDITOR_NAME`, `SITE_EDITOR_ROLE`, `SITE_EDITOR_BIO`; it then renders on `/distributors` with `Person` JSON-LD. Nothing is shown until configured. |
| Get quality backlinks | **Not something code can do.** That is outreach/PR. |

"Rank #1 by Friday" cannot be promised by any implementation: ranking depends on a live domain, indexing time, content, competition and backlinks. This gives you a technically clean foundation.

## Deliberate scope decisions

- **Redis worker → Postgres outbox.** The architecture document proposes Redis + worker; the MVP uses a transactional outbox polled in-process. The interface is the same and can move to Redis later.
- **"Nearby" location filter → "Local".** True "nearby" needs geolocation; the filter uses each business's coverage scope (Local / National / International).
- **Filters:** instant on desktop; staged with an **Apply Filters** button in the mobile drawer.
- **Favourites** are stored on the device (accounts are deferred in the PRD).
- **Login / brand portal / payments / admin / ads** are out of scope for this page. `/login` says so honestly; `/register`, `/requirement` and `/contact` are working forms that store leads. Terms and Privacy are marked as pending (and `noindex`) until the client supplies the policies.
- Pricing, currency, review times and policies are client decisions per the PRD, so none are invented. The investment filter uses the currency stored on each record.
