# Search Distributor (searchdistributor.online): codebase report

Last updated 2026-10-19. This repository is only for Search Distributor.

## 1. What this is

A B2B distributor-discovery marketplace (Search → Discover → Profile → Enquiry). npm-workspaces monorepo.

| Package | Role |
|---|---|
| `shared/` | Zod schemas, DTOs, enums and the `ApiClient` interface used by both sides |
| `server/` | Express 4 modular monolith, Prisma 6 / PostgreSQL, SSR host, admin API |
| `client/` | React 19 + Vite 7 + Tailwind 4 + TanStack Query. Public site is SSR + hydrated; `/admin` is a client-only app (`client/admin.html`, `client/src/admin/`) |

Server modules: distributors, categories, products, enquiries, leads, requirements, ads, notifications, admin.

## 2. Strengths

- **One definition of "public"** (`eligibleDistributorSql()`, plus the requirement and ad equivalents), evaluated at request time so an expired subscription goes offline immediately. Now covered by integration tests.
- **Tenant safety:** enquiry recipients are resolved server-side.
- **Idempotent writes** with unique keys; **transactional email outbox** with retries.
- **SEO:** SSR, sitemap from eligible records only, canonical redirects, JSON-LD, real 404 status.
- **Config:** Zod-validated env; the server refuses to start in production with `SHOW_DEMO_DATA=true`.

## 3. Admin back office

- Models: `AdminUser`, `AdminSession`, `AuditLog`.
- Auth: scrypt passwords, hashed session tokens, HttpOnly + SameSite=Strict + Secure (production) cookie, CSRF header on writes, 12 h lifetime plus 2 h idle timeout, hourly purge of dead sessions, password reset signs the admin out everywhere, login rate limit plus the global limiter on every admin route.
- Roles: SUPER_ADMIN, MODERATOR.
- Screens: sign in, dashboard counts, buyer-requirement moderation (approve, or reject with a reason). Every decision writes an audit row in the same transaction.
- **Not built yet:** moderation of listings, products and ads; subscription and payment management; admin user management; 2FA; an audit-log screen.

## 4. Quality gates

| Check | How | Status |
|---|---|---|
| Typecheck | `npm run typecheck` | Pass |
| Admin tests (no database) | `npm test -w server` | 27 pass |
| Public-eligibility integration tests | `TEST_DATABASE_URL=… npm run test:db -w server` | 9 pass (listing, organisation and subscription rules, requirements, ads) |
| Production build | `npm run build` | Pass |
| Docker image | `docker build .`, run against an empty database | Pass (migrates, seeds, healthy, runs as non-root) |
| `npm audit --omit=dev` | | 3 high, all in the Prisma CLI's dependency chain (deploy-time only); fixing needs Prisma 7 |

## 5. Known limitations and next steps

1. **Single instance.** The email outbox and caches are in-process. Do not run replicas without moving them out.
2. **Prisma 7 upgrade** will clear the remaining audit findings; it is a major migration, so plan it separately.
3. **Admin coverage:** build moderation for listings, products and ads next (copy the `decideRequirement` pattern in `server/src/modules/admin/service.ts`), call `clearDistributorCaches()` / `clearCategoryCache()` after each change.
4. **Leads** have no triage status or notes.
5. **Subscriptions** are created by hand in the database; add an audited admin screen.
6. **Personal data** (leads, enquiries, requirements) has no retention policy.
7. **Performance** claims in the README are unmeasured; run Lighthouse on the live domain.
8. **Before launch:** set `SITE_URL=https://searchdistributor.online`, real SMTP and `MAIL_FROM`, then submit the sitemap in Search Console. See `docs/DEPLOY.md`.
