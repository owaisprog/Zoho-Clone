# P3.02 — Synthetic-Only Express Demo API and Next.js Read Integration

**Status:** proposed code for review, not an approved production feature.
**Branch:** `feat/p3-02-synthetic-demo-api`.
**Preconditions:** Explicit user request to continue early P3 development; P3.01 (#26) and P2.02 (#25) remain OPEN.

## What is implemented

- Express serves `GET /api/v1/demo/leads` and `GET /api/v1/demo/applications` from fixed, invented arrays in `backend/src/demo-fixtures.ts`.
- The only exposed data is fictional. All contact emails are `@example.com`; records are `*-DEMO-*` and stages refer to internal demonstration only.
- The API sets `Cache-Control: no-store`, preserves Helmet, localhost-only binding, small JSON limits, generic errors and safe 404s.
- No write endpoints were introduced. `/api/v1/leads`, `/api/v1/applications`, tenant, processor, payments and KYC routes remain unavailable.
- Next.js server components fetch the read-only fictional datasets through `frontend/src/lib/demo-api.ts`. They validate expected shape, fictional IDs, allowed stages, contact domains, bounded lengths/counts and exact field names before handing data to client-side tables.
- When Express is not available or returns anything unexpected, Next.js uses its original local fictional fixtures. The pages show which source supplied the displayed records.
- The tables still support client-side search. There is no persistent CRUD, authorization or tenant/session security.

## Running locally

Use Node.js 22 or later and execute `npm install` from the repository root.
Run `npm run dev:api` and `npm run dev:web` in separate terminals, then open:
- `http://localhost:3000/app`
- `http://localhost:3000/app/sales/leads`
- `http://localhost:3000/app/operations/applications`
- `http://127.0.0.1:4000/api/v1/demo/leads`

Keep `API_INTERNAL_URL=http://127.0.0.1:4000` for Next.js server requests. These links are local only; no deployment has been performed.

## Test and approval boundaries

Unit/integration test code covers fixed API datasets, no-store behavior, missing write and protected endpoints, accepted synthetic-only responses, rejected unexpected payloads, and offline fallback. Actual pass/fail evidence must come from CI; file presence alone is not test execution.

Do not treat this as CRM feature delivery, real sales onboarding, processor integrations or security acceptance. The original 727 P1.09 planned acceptance/security tests remain `NOT_RUN`; 40 P2.02 UX review cases remain `NOT_RUN`. All 14 documented evidence risks and 12 unresolved decisions remain open. No real customer data, credentials, tenancy, OAuth/OIDC, PostgreSQL/Prisma persistence, RLS, billing, payments, KYC/KYB or production exposure is authorized. G-EXT and G-COM remain blocked.

P3.01 owner review (#26) and P2.02 IA owner review (#25) remain independently required. This branch is for engineering review and CI; do not merge as production authorization.
