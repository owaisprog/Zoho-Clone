# P4 phase exit — integration-hardening batch 01

**Reference:** User-approved *Zoho Clone AI Master Roadmap — ExpressJS Final*, PDF page 39 P4 exit / page 40 P5 prerequisite.
**Date:** 2026-11-20.
**Status:** Internal engineering evidence only. Formal P4 product exit and staging acceptance remain **OPEN**.

## Five engineering integration slices

| Slice | Implemented | Still not proven |
|---|---|---|
| 1. Auth0 actor bridge | Exact signed JWT issuer+subject -> internal user ID lookup; issuer/audience/expiry and database email verification fail closed. No merge-by-email and no JWT-supplied tenant roles. | Live Auth0 test accounts, actual issuer/audience configuration, MFA, revocation and persistent user provisioning |
| 2. Separate subject lookup | Parameterized PostgreSQL function and narrow CI-only identity role, no generic table read. | Approved production database identity role, actual Auth0 user migration, secret vault |
| 3. Fresh membership + RLS read | Read-only settings operation checks tenant membership again inside transaction-local RLS, confirms non-superuser/non-BYPASSRLS DB role, denies stale membership and foreign org. | Real authenticated business API authorization, record/field P1.06 policies, authenticated Prisma transaction adapter |
| 4. Auth0 SDK pipeline | Development-only Router composes real Auth0 RS256/JWKS validation middleware BEFORE actor mapping. Not mounted in normal backend app, no test tokens masquerading as live user. | Private Auth0 tenant config and actually verified live tokens; production readiness and session/recovery flows |
| 5. Real isolated PostgreSQL CI probe | Dedicated script connects to disposable CI PostgreSQL, switches into restricted non-owner role, reads two separate org settings, and rejects revoked/foreign tenant context. | Persistent managed staging environment, non-superuser connection credentials, private storage, operator review |

## Changed code

- backend/src/platform/p4-auth0-subject-bridge.ts
- backend/src/platform/p4-pg-subject-lookup.ts
- backend/src/platform/p4-pg-workspace-reader.ts
- backend/src/platform/p4-integration-test-router.ts
- backend/src/platform/p4-auth0-development-router.ts
- backend/src/scripts/p4-ci-live-read.ts
- backend/test/p4-integration-exit.test.ts
- backend/test/p4-auth0-development-router.test.ts
- backend/db/candidates/009_p4_synthetic_verified_identity_lookup.sql
- backend/db/tests/009_p4_synthetic_verified_identity_lookup.sql
- .github/workflows/p3-scaffold.yml

## Verified test evidence

[GitHub Actions #44727449525](https://github.com/owaisprog/Zoho-Clone/actions/runs/44727449525): **4/4 jobs PASS**, total **213/213 tests** (58 frontend + 142 backend + 5 shared + 8 Node scripts).
- TypeScript typecheck, Next.js and Express builds, Prisma schema validation and docker-compose CI checks passed.
- Disposable PostgreSQL tests proved restricted subject-function role and issuer/subject mapping.
- Actual disposable PG client path printed: "P4 exit: two real disposable PostgreSQL tenant reads, revoked + foreign denied PASS".
- All logged results are about fictional organizations and disposable CI; there was **no live Auth0 signed request**, Neon migration or production use.

## Locked release gates / handoff

See [P4 exit gate issue #61](https://github.com/owaisprog/Zoho-Clone/issues/61). P4 exit requires *two isolated demo companies with complete identity, team, access, files and audit flows* backed by real acceptance evidence and owner approval. The present code proves **only** a synthetic read path plus mocked Auth0 claim integration and a real restricted PostgreSQL test.

Keep all prior acceptance issues #56–#60, original 14 risks / 12 decisions / 727 P1.09 unexecuted cases, P2.02 and P3 staging controls open. Never run SQL candidate 009 (or 004–008) against Neon. Do not deploy these routes, merge to main or treat the isolated test role as a production RLS role.

P5.01 CRM settings/navigation is next in the official roadmap only **after** the owner's P4 exit prerequisites are satisfied. Future synthetic-only CRM work would need separate early-start authorization and must not be mislabeled production-complete.
