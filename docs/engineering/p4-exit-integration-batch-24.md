# Phase 4 — Batch 24: audit confidentiality and fail-closed authorization

Date: 2026-11-23. Stacked draft PR on verified Batch 23. Synthetic-only; not an approval of live identity, a compliance-grade immutable ledger, or a production release.

## Five delivered engineering tasks

1. **Restricted SQL audit confidentiality:** new `backend/db/tests/020_p4_r24_ci_audit_failure_redaction.sql` proves the disposable tenant runtime cannot SELECT the private audit table, read raw payload, INSERT, UPDATE, or DELETE audit history; verifies transaction-local tenant/actor cleanup, permitted owner projection, bounded pages, denied sales role and a separate immutable-history trigger. Does not alter SQL policies or production Neon schemas.
2. **Strict audit projection regression:** four additional tests in `backend/test/p4-r15-ci-audit-page.test.ts` inject raw payload and private recipient fields into mock ORM rows and require exact four-field safe output; check audit action allowlist, denied roles despite valid membership and platform entitlement, and malformed action/actor/timestamp rejection.
3. **Real Postgres/Prisma/HTTP error/redaction proof:** new `backend/src/scripts/p4-ci-r24-audit-failure-redaction-smoke.ts` extends the tested R17 restricted audit route with invalid/expired fictional authorization variants, foreign reviewer, wrong tenant, malicious or malformed query options, sanitized 401/403 bodies, no-store/nosniff headers, no secret reflection and cross-user cursor replay rejection.
4. **Honest partial acceptance evidence:** add four original P1.09 case links (API-T013-NEG, API-T015-NEG, PERM-T028, PERM-T029), each explicitly noting the non-equivalence of synthetic CI evidence to commercial product acceptance. The full original 727-case inventory remains unexecuted; total partial evidence links increase 26 → 30, guarded by two additional mutation tests.
5. **Mandatory GitHub CI:** run restricted audit SQL and real PostgreSQL/Prisma/HTTP R24 smoke in the existing synthetic-postgres-isolation job, preserve typecheck/build, Prisma validation, original P1.09 inventory, fail-closed production dependency guards and NO_GO gate.

## Remaining formal gates

**This batch does not prove live Auth0/JWKS/MFA, persistent production audit immutability/retention, private file scanning, security operations, real customer sessions or P4 exit acceptance.** R10-C1–C5, P4 exit #61, all ten release gate categories, 14 original risks, 12 decisions, and 727 unexecuted original P1.09 cases remain open. No deployment, owner Neon migration, main merge, paid cloud or real customer data.

CI verification pending at authoring; rely on actual final GitHub Actions status.
