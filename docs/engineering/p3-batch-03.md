# P3 Batch 03 — Protected backend foundations (P3.13–P3.17)

**Status: implementation prepared for CI and owner review.** This batch is NOT a commercial or production approval. It moves toward a real SaaS backend without silently deciding identity, tenant IDs or access grants.

| Subphase | Actual implementation | Still gated |
|---|---|---|
| **P3.13 — Typed backend contracts and validation** | Internal lead types, fictional-only POST/PATCH payload allowlists, expected-version parsing, idempotency key validation, response projection and safe generic errors | Final ID scheme OPEN-002, real customer input, production migrations |
| **P3.14 — Verified membership and authorization rules** | Default deny; fresh active membership per request, sales role checks, tenant/record ownership predicates, no admin superuser reads and contact-field minimization | Verified identity provider OPEN-001 and owner-approved complete permission policy OPEN-003 |
| **P3.15 — Repository and scoped service layers** | Replaceable repository interface; two fictional organizations in-memory; scoped reads, counts, inserts, optimistic version updates and replay-safe demo idempotency | Real PostgreSQL/Prisma adapter, transactional isolation, durable idempotency |
| **P3.16 — Test-injected Express API** | Real service/route code supporting protected list/read/create/update under test-only dependency injection; safe HTTP denials | No production API deployment, no user login, no persistent protected CRUD |
| **P3.17 — Security-denial integration tests** | Anonymous/spoofed headers, wrong organization, record ownership, admin no wildcard, revoked membership, field redaction, invalid payloads, replay, stale versions and secret-free errors | Original 727 acceptance/security cases and independent tenant DB/a11y/pentest evidence |

## Boundaries to preserve

- Normal Express startup calls `createApp()` with **no internal adapter** and therefore exposes NONE of the protected internal endpoints. Arbitrary user/role/tenant HTTP headers cannot activate them.
- The tests explicitly inject a fixture-only resolver with verified *synthetic* actors. This is NOT authentication (no OIDC/JWT/cookie/session provider) and the adapter is forbidden under `NODE_ENV=production`.
- Only invented `org_demo_*`, `user_demo_*` and `LEAD-DEMO-*` records; contact addresses only on example.com. There is **no** real data ingress.
- Every service operation reloads current membership, applies a tenant and record predicate, and projects only allowed fields. Reader roles cannot view fictional contact fields. Admin-only members have no business record read grant.
- Idempotent update replays also recheck current record visibility, so a revoked record grant cannot reveal previously written data. In-memory replay is not distributed or durable.
- No actual database connection or schema migration is created while OPEN-002 remains undecided. A future Prisma adapter must enforce tenant filters **in SQL**, not post-query filtering.

## Verification commands

Node.js 22+, repository root:

~~~sh
npm ci
npm run typecheck
npm run test
npm run build
npm run dev:api
~~~

The ordinary Express process still exposes only health and the three read-only fictional demo datasets. Test the isolated internal service with `npm run test -w backend`.

[API behavior specification](../api/internal-synthetic-protected-preview.md).

**Release boundary:** All **14 original risks/gaps**, **12 unresolved decisions**, **727 unexecuted original P1 acceptance/security cases**, and the **40 unexecuted P2.02 IA review scenarios** remain OPEN/NOT RUN. G-EXT/G-COM remain BLOCKED. No actual identity, DB-backed tenancy, KYC, payments, real onboarding, processor authority or commercial deployment is authorized.
