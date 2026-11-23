# Phase 4 — Batch 25: synthetic invitation and membership lifecycle evidence

Date: 2026-11-23. Draft code stacked on Batch 24. This is test-only engineering evidence, not a production invitation feature or an approved P4 release.

## Five implemented tasks

1. **Real disposable PostgreSQL/Prisma invitation lifecycle smoke**: `backend/src/scripts/p4-ci-r25-invite-membership-evidence-smoke.ts` expands the earlier R13 smoke to check exact expiration-boundary behavior, stored pending state unaffected by read-time expiration, accepted/revoked/expired terminal states, safe field-only projections, cross-tenant admin denial, immediate revoked membership denial, and disabled platform entitlement denial. Restores fictional fixture mutations in `finally`.
2. **Restricted SQL security proof**: `backend/db/tests/021_p4_r25_ci_invite_confidentiality.sql` verifies invitation token hash and private recipient email columns cannot be SELECTed by restricted CI runtime; INSERT/UPDATE/DELETE denied, no rows without tenant/actor context, scoped owner access, sales rep and reviewer denial, and pooled transaction context cleanup.
3. **Unit acceptance regression**: four new tests in `backend/test/p4-r13-ci-team-invite-reader.test.ts` verify milliseconds before/at expiry, non-reversible terminal projections, invalid RFC3339 timestamps rejected before transaction, and an immutable four-field secret-free response. No real token redemption.
4. **Original P1.09 traceability**: add four strictly `CI_ONLY_PARTIAL` references (PERM-T006, API-T006-NEG, API-T008-NEG, API-T009-NEG). The total partial references become 34; **all 727 original P1.09 cases stay `NOT_RUN_DOCUMENT_ONLY`**, zero passed, and no owner acceptance. Two additional negative integrity tests prevent fabricated invitation approval.
5. **Required CI checks**: the existing GitHub Actions synthetic-postgres-isolation job executes the new restricted SQL and R25 real Prisma smoke, preserving all builds, tests, dependency scans, production-boundary protections and formal `NO_GO` check.

## Remaining release blockers

No live Auth0/JWKS/MFA, invitation creation/delivery/redemption endpoints, real membership activation, live email provider or session invalidation, production key store, approved R10-C1–C5 mutations, tenant privileges, staging review, Neon migration or commercial release. P4 exit issue #61 remains open alongside the original 14 risks, 12 decisions, ten formal gates and 727 original unexecuted cases. No `main` merge, production deployment or customer data.

Final CI results are recorded in the draft PR only after GitHub Actions verification.
