# P4 integration-hardening Batch 08 — D1/D2/D4/D5 approval and real CI Prisma enforcement

**Date:** 2026-11-20
**Approval source:** [ADR 0008](../adr/0008-p4-batch07-owner-permission-implementation-approval.md), exact owner-approved [Batch 07 review](../security/p4-batch07-permissions-owner-review.md), pre-existing [P1.06 matrix](../security/permission-matrix.csv) (13 roles, 22 resources, 286 designed decisions).
**Scope:** **Internal synthetic-only Phase 4 development and disposable GitHub CI**. This is not customer authentication, staging or P4 exit authorization.
**Branch:** `feat/p4-identity-org-foundation-batch-01-20261120` on existing [draft PR #55](https://github.com/owaisprog/Zoho-Clone/pull/55). No merge to main.

## Five completed development slices

| Slice | Actual implementation | Evidence / limitation |
| --- | --- | --- |
| 1. Owner decisions recorded | `docs/adr/0008-p4-batch07-owner-permission-implementation-approval.md`; updates to Batch 07 review, P1 decision register, original decisions and ADR 0007. Approved **D1 private-first**, **D2 sales team scopes**, **D4 two safe lead fields**, **D5 next-request revocation and separate operations** | Preserves `ORG_OWNER` without blanket CRM permissions (existing P1.06 D3) and leaves **OPEN-003 + all 12 original tracked decisions open** |
| 2. Read-only Prisma physical mapping | `backend/db/p4-r7-ci.prisma`, generated into separate client `backend/src/generated/p4-r7-ci`; CI generator/schema validation only | Models disposable SQL candidate 013's membership, business role grants, CRM app grants, active team grants and leads. No migration or Prisma db push, no Neon access |
| 3. Restricted transactional read model | `backend/src/platform/p4-r7-ci-prisma-reader.ts`: exact CI DB/environment guard, `SET LOCAL ROLE`, actor/tenant GUC, check non-owner non-bypass restricted SELECT grants (including confidential note denied), fresh membership, active role grants, current app entitlements and teams, additional P1.06 read/field policy per row | `ORG_OWNER` without separate sales role denied even for self-owned lead. `readP4R7CiLeads` and `readP4R7CiLead` return only `id`, `displayName` and have no write/export surface |
| 4. Identity-to-policy test-only HTTP composition | `backend/src/platform/p4-r8-ci-test-router.ts`: synthetic already-verified token evidence `issuer+subject` -> isolated UUIDv4 mapping -> current transaction, allowed list/direct CRM reads, same 401/403 protection for unauthorized data | CI-only router requires exact disposable `CI/GITHUB_ACTIONS` environment; **NOT mounted** in backend production `app.ts`; no real Auth0 signature/MFA/revocation, real download, or upload |
| 5. Real PostgreSQL/HTTP and regression tests | `backend/src/scripts/p4-ci-r8-approved-authz-smoke.ts` runs after disposable SQL candidate 013, and `backend/test/p4-r8-approved-ci-reader.test.ts` has seven additional fail-closed cases | Tests cover owned, assigned, explicitly shared/private, sales-manager scope, no owner CRM, foreign/hidden record, revoked team/direct assignment/role/app/membership, denied sensitive fields, pool reset, unsigned/expired/unmapped synthetic identity and denied POST/export |

## Verified CI result

[GitHub Actions run #44766524774](https://github.com/owaisprog/Zoho-Clone/actions/runs/44766524774): **4/4 CI jobs PASS**, **269/269 automated tests PASS**:
- Frontend: 58
- Backend: 198
- Shared contracts: 5
- Node safety scripts: 8

In addition, the disposable PostgreSQL job explicitly printed:
- `P4 R7 P1.06 owner-no-CRM, sales scope, explicit team shares, field denial, revocation PASS`
- `P4 R8 approved D1/D2/D4/D5: real Prisma P1.06 roles, private/team/assigned RLS, field denial, revocation and isolated HTTP 401/403 PASS`

A provisional earlier run #44765930104 failed a new test-harness type mismatch; fixed by `8c3d604`. The above run #44766524774 passed all jobs, including seven additional negative tests. **These are engineering CI tests, not execution of the original 727 P1.09 cases.**

## External and release gates explicitly OPEN

- **OPEN-003** still open for complete fine-grained authorization across all 22 resources and verbs; this batch only integrates synthetic CRM lead **R** with the new approved D1/D2/D4/D5 subset. Full field/update/export, role/editor delegation and last-owner transfer flows need further approval and independent tests.
- P4 identity: official live Auth0 JWT signatures, MFA/invite/recovery, refresh/revocation and production UUID actor mapping remain unverified. The test injects a `cryptographicallyVerified` claim shape, **not real cryptographic proof**.
- P4 teams/files: real private object storage, scanner/quarantine, retention, region, provider choice, audit write/restore, support access and secure staging accepted flows still not implemented.
- P2.02/P3 staging and rollback, all original **14 risks**, all **12 tracked decisions**, **727 unexecuted P1.09 acceptance cases**, owner real-staging/cloud G-EXT/G-COM and formal P4 exit remain open.
- The historical `p4_v1_ci` synthetic OWNER/MEMBER read routes are **not** the P1.06-approved business authorization engine; no real API should mount them.
- **No** owner Neon or production SQL candidates 004–013, customer data, paid infrastructure, staging/production deployment, main branch merge, external pilot or live provider access occurred.

**Next safe implementation:** Expand only internal synthetic authorization consistency across list, search, aggregations and export *denial*; then plan audited role/team permission-change transactions before any live implementation. No external provider or security gate is inferred from this run.
