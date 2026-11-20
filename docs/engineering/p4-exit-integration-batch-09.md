# P4 integration-hardening Batch 09 — scoped search, reporting, CI-only audit

**Date:** 2026-11-20
**Owner authorization:** [ADR 0007](../adr/0007-architecture-v1-owner-approval.md) and approved D1/D2/D4/D5 in [ADR 0008](../adr/0008-p4-batch07-owner-permission-implementation-approval.md). **Internal synthetic-only engineering, not staging/live write authorization.**
**Code location:** [draft PR #55](https://github.com/owaisprog/Zoho-Clone/pull/55), branch `feat/p4-identity-org-foundation-batch-01-20261120`.
**Formal phase:** P4 OPEN.

## Five completed substeps

| Step | Actual implementation | Verified boundary / limitation |
| --- | --- | --- |
| 1. Permission-aware CRM search | `backend/src/platform/p4-r9-ci-search-report.ts`: bounded and validated text input (1–40 safe characters), max 20 rows/page, UUIDv4 keyset cursor, RLS-scoped `findMany`, P1.06 role/team/record recheck of **every returned row**, and minimal `id`/`displayName` only | Page size and cursor work over RLS-visible rows; no raw email, phone, notes, private object keys or other fields. No general customer-facing search or import/export |
| 2. Scoped CRM reporting | Same module: a **bounded CI-only** report of counts among currently visible CRM leads, split into private-visible and explicitly team-shared-visible records | Counts and matching rows are fetched within the same protected Prisma transaction; mismatched rows/counts and over 100 matches deny rather than returning incorrect/inferred totals. Not production analytics |
| 3. Synthetic role/team audit rehearsal | `backend/db/candidates/014_p4_r9_ci_audited_role_team_rehearsal.sql`: separate CI-only schema `p4_r9_ci`, immutable audit table, guarded triggers for active flag toggles on synthetic role/team grants, verified tenant-local active `ORG_OWNER` actor in the same transaction | **No live role/team mutation API.** Test bootstrap principal `demo_ci` is disposable CI-only; current P1.06 `OPEN-003` owner/admin delegation and production writer credentials remain unapproved |
| 4. Atomic change and revocation proofs | `backend/db/tests/014_p4_r9_ci_audited_role_team_rehearsal.sql`: actor/tenant mismatch, reserved owner role and team-management escalation denied; log append-on-change, no-op nonlogging, commit/rollback atomicity, audit immutability, no runtime audit SELECT or write privilege | Audits are fictional, not a production append-only ledger, retention or external log service. Database backup/DB-owner tamper resistance remains unverified |
| 5. Test-only HTTP and regression checks | `backend/src/platform/p4-r8-ci-test-router.ts`, `backend/src/scripts/p4-ci-r8-approved-authz-smoke.ts`, `backend/test/p4-r9-search-report.test.ts`; CI workflow runs candidate 014 and its SQL tests after earlier real PG/Prisma checks | HTTP 401/403, role-only owner denied, private/foreign denied, unauthorized search params and exports rejected, no POST route; eight new backend unit cases plus real disposable PostgreSQL and HTTP smoke |

## Exact verified evidence

[GitHub Actions run #44769982822](https://github.com/owaisprog/Zoho-Clone/actions/runs/44769982822) completed **4/4 jobs PASS** and **277/277 automated tests PASS**:
- Frontend: 58
- Backend: 206 (8 added since Batch 08)
- Shared demo contracts: 5
- CI safety script tests: 8

The same run completed the real PostgreSQL integration test for authorized search and reporting and printed the earlier real access-control smoke verdict. Candidate 014's SQL test emitted:
`P4 R9 CI-only atomic role/team audit, rollback, actor checks, immutable history PASS`.

Intermediate CI revisions caught and corrected a test-helper TypeScript type shadowing issue and an inconsistent denial error for a non-CI environment. [Run #44769982822](https://github.com/owaisprog/Zoho-Clone/actions/runs/44769982822) is the **verified green implementation checkpoint**.

## Strict remaining gates

- The preapproved P1.06 13-role × 22-resource (286 decision) matrix is the design baseline; only the synthetic CRM-lead `R` subset, bounded search and report are integrated. `ORG_OWNER` and `ORG_ADMIN` alone have **no CRM access**. Full P4 role/grant/team/field CRUD, scoped write authorizations, export workflows, audit actor delegation and last-owner protection remain OPEN.
- **OPEN-003 and all 12 original decision register items remain OPEN**. Approval D1/D2/D4/D5 did not authorize a production permission editor or migration.
- Real Auth0 signed JWT/MFA/recovery/invite/revocation acceptance, independent security review, storage provider/quarantine/scanning, retention and region decisions, backups/restore, real staging secret/service roles and full two-organization end-to-end demonstration remain OPEN.
- All **14 original risks** and **727 unexecuted planned P1.09 cases** remain OPEN. New CI tests **are not** the original acceptance suite.
- Do NOT run candidate 014 (or earlier CI SQL 004–013) on the owner's Neon; no customer data, main merge, staging/production deployment, paid cloud activity or real providers are authorized.

**Next internal-safe step:** Define and independently review the *actual* limited delegated role/team mutation policy and immutable audit contract, with corresponding negative tests. This requires a separate owner decision before a real writer endpoint, live role management or staging activation.
