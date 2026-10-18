# Search Distributor: codebase report and admin-panel readiness

Date: 2026-10-18. Based on commit `c9f0fcc` plus the admin groundwork added alongside this report.

## 1. What this is

A B2B distributor-discovery marketplace (Search → Discover → Profile → Enquiry). npm-workspaces monorepo, about 5k lines of TypeScript, `npm run typecheck` is clean across all three packages.

| Package | Role | Notes |
|---|---|---|
| `shared/` | Zod schemas, DTOs, enums, `ApiClient` interface | Single source of truth for both sides (602 lines) |
| `server/` | Express 4 modular monolith, Prisma 6 / PostgreSQL, SSR host | Modules: distributors, categories, products, enquiries, leads, requirements, ads, notifications |
| `client/` | React 19 + Vite 7 + Tailwind 4, TanStack Query, SSR + hydration | Routes declared in `client/src/routes.tsx` with per-route `prefetch` |

The server renders the client in-process: `server/src/ssr.ts` hands the React app an `ApiClient` that calls the service functions directly, so there is no HTTP hop during SSR. In dev it runs Vite in middleware mode.

## 2. Architecture strengths

- **One definition of "public".** `eligibleDistributorSql()` (listing approved + enabled, org active, profile approved, live subscription window) is reused by search, profile, featured, facets, sitemap and enquiries. Ads and requirements do the same with their own `eligibleWhere` / `publicWhere`. Eligibility is evaluated at request time, so a late expiry job can't keep content live.
- **Tenant safety.** Enquiry recipients are resolved server-side; the client never sends an organisation id.
- **Idempotent writes.** Enquiries, leads, requirements and responses all carry unique idempotency keys and handle the `P2002` race.
- **Reliable email.** Transactional outbox with retries and de-duplication; failed mail never loses a saved record.
- **SEO done properly.** SSR, sitemap from eligible records only, canonical redirects, per-page head, JSON-LD, a real 404 status.
- **Safe SQL.** Raw SQL is limited to ranked search and is parameterised through `Prisma.sql`.
- **Config hygiene.** Env validated with Zod at boot; the server refuses to start in production with `SHOW_DEMO_DATA=true`.

## 3. Current gaps and risks

| # | Finding | Severity | Detail |
|---|---|---|---|
| 1 | No admin or auth existed | High (blocks launch) | All approvals were done by editing rows in the database. Addressed in part, see section 4. |
| 2 | No automated tests | High | No test runner or test files. Moderation and eligibility rules are the highest-value targets. |
| 3 | `/admin` is caught by the public SSR catch-all | Medium | `app.get("*")` in `ssr.ts` would render the public 404 page for `/admin`. The admin UI needs its own entry that is client-rendered only and `noindex`. |
| 4 | In-process caches are per instance | Medium | `TtlCache` (categories 30 s, featured 30 s, facets 60 s) is not shared. Fine for one instance. With several, admin changes appear after the TTL. `clearCategoryCache()` and `clearDistributorCaches()` now exist for admin writes to call. |
| 5 | Leads have no workflow state | Medium | `Lead` (contact / registration submissions) has no status, owner or notes, so admins can't triage them. |
| 6 | No "why isn't this live?" view | Medium | A listing is public only if five conditions hold across three tables. Admins will need a diagnostic that reports which one fails. |
| 7 | Subscription periods have no UI or payment link | Medium | `SubscriptionPeriod` rows are created by hand; there is no audit trail for entitlement changes. |
| 8 | `cookie-parser` is a dependency but unused | Low | The admin code parses its one cookie directly (no `@types/cookie-parser` installed). Remove the dependency or adopt it properly. |
| 9 | Free-text user content is stored as-is | Low | React escapes on render. Admin views must keep doing that and never use `dangerouslySetInnerHTML`. |
| 10 | Personal data retention | Low | Leads, enquiries and requirements hold names, emails and phones with no retention or deletion process. |
| 11 | Performance claims unmeasured | Low | The README says so itself. Run Lighthouse on staging. |
| 12 | Local `.env` equals `.env.example` | Info | It is git-ignored (good) and has `SHOW_DEMO_DATA=true`, which is correct for dev only. |

## 4. Admin groundwork added

Backend foundation plus one complete vertical slice. **No admin UI yet.** Nothing was run against a database, because Docker isn't running here. The migration is hand-written and unapplied.

**Data model** (`server/prisma/schema.prisma`, migration `20261018090000_admin_foundation`)
- `AdminUser` (email, scrypt `passwordHash`, `role` SUPER_ADMIN | MODERATOR, `isActive`), kept separate from `Organisation`.
- `AdminSession` stores only the SHA-256 of the cookie token; 12 h absolute expiry.
- `AuditLog` is append-only with action, entity, JSON meta and IP.

**Server** (`server/src/modules/admin/`, `server/src/routes/admin.ts`, mounted at `/api/admin/v1`)
- Auth: scrypt hashing with timing-safe compare and a dummy hash for unknown emails. Cookie is `HttpOnly`, `SameSite=Strict`, `Secure` in production. Login limited to 10 attempts per 15 min. Failed logins are audited.
- CSRF: every state-changing request must send `X-SD-Admin: 1`. Combined with SameSite=Strict, a cross-site request can't carry both.
- Role gate: `requireRole(...)`. SUPER_ADMIN passes every check; `requireRole()` with no roles means SUPER_ADMIN only.
- All admin responses send `Cache-Control: no-store` and `X-Robots-Tag: noindex`.
- Endpoints: `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `GET /stats` (pending counts), `GET /requirements?status=&page=`, `POST /requirements/:id/decision` (approve, or reject with a required reason), `GET /audit-log` (SUPER_ADMIN).
- `decideRequirement()` is the template for every future queue: a transaction that checks the item is still pending, applies the change and writes the audit row together, and returns 409 if someone else decided first.
- `npm run admin:create -w server` creates the first admin. Credentials come from `ADMIN_EMAIL`, `ADMIN_PASSWORD` (12+ chars) and optional `ADMIN_NAME` / `ADMIN_ROLE` environment variables, not CLI arguments.
- Shared types (`AdminMeDTO`, `AdminStatsDTO`, `AdminRequirementDTO`, `moderationDecisionSchema`, …) are in `shared/src/index.ts` so the future UI is typed end to end.

**Verified:** `npm run typecheck` passes; password hash / verify round-trip works (right password true, wrong false).
**Not verified:** migration apply, any HTTP endpoint, login flow, role checks (no database available).

## 5. Next steps, in order

1. **Apply and test.** Start Postgres, run `npm run db:migrate`, create an admin, and exercise login, the stats call and the requirement decision with curl. Add a test runner (Vitest) and cover auth, CSRF, role gating and the 409 path.
2. **Admin UI shell.** A separate client-only entry (for example `client/admin.html` plus `src/admin/`) served for `/admin/*` ahead of the SSR catch-all, with its own login, layout and routes. This avoids pulling admin code into the public bundle and keeps SSR out of it. Reuse the existing `ui/` primitives and TanStack Query.
3. **More queues using the `decideRequirement` pattern:** distributor listings (and products) with `clearDistributorCaches()` and `clearCategoryCache()` after each change; organisation profile review; ad campaigns (approve, mark payment verified, schedule).
4. **Enquiries and leads.** Read-only enquiry list with spam flag and outbox retry for FAILED rows. Add a `status` and `notes` field to `Lead`.
5. **Entitlements.** UI to create `SubscriptionPeriod` rows (audited) and a "why isn't this live?" diagnostic on each listing.
6. **Operations.** Admin user management (SUPER_ADMIN only), session revocation, optional TOTP 2FA, and a retention policy for personal data.

## 6. Decisions needed from you

- Will the admin UI live in this app (recommended: one deploy, shared types) or as a separate deployment?
- Do you need more roles than SUPER_ADMIN and MODERATOR (for example a finance role for payment verification)?
- Is 2FA required for admins at launch?
