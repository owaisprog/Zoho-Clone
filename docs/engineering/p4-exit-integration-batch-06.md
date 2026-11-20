# P4 integration-hardening batch 06 — SDK configuration and provisional record/field access

**Date:** 2026-11-20
**Scope:** Architecture v1.0 approved internal development and P4 staging *preparation only*. [ADR 0007](../adr/0007-architecture-v1-owner-approval.md).
**Branch:** `feat/p4-identity-org-foundation-batch-01-20261120`, [draft PR #55](https://github.com/owaisprog/Zoho-Clone/pull/55).
**Status:** Five engineering slices passed synthetic CI. **P4 exit and external/live acceptance remain OPEN**.

## Five implementation slices

| Slice | GitHub implementation | Security limitation / acceptance gate |
| --- | --- | --- |
| 1. SDK configuration alignment | `backend/src/auth/auth0-api.ts` now accepts an explicit trusted environment; `p4-auth0-development-router.ts` supplies that **same** config to the Auth0 JWT middleware and expected-claim checks. `backend/test/p4-auth0-sdk-config.test.ts` rejects missing config and forged headers | This verifies middleware **composition and fail-closed unsigned requests**, not a real Auth0 JWKS signature, MFA, account linking or revocation. Real Auth0 acceptance still OPEN |
| 2. Provisional team/record ABAC | **CI-only** `backend/db/candidates/012_p4_v1_ci_record_field_acl.sql` adds fictional member Charlie with a team assignment; lead RLS now additionally requires active app grant, role permission and owner/team relationship; members cannot read other tenants | The P1.06 team/owner/department/field policy matrix is still unresolved; sample team-sharing is not commercial permission approval |
| 3. PostgreSQL column-level least privilege | Candidate 012 adds simulated `confidential_note` and `private_object_locator`, revokes table-wide CRM/file SELECT, grants only safe named columns. `p4-v1-ci-prisma.ts` asserts an unprivileged runtime role can read safe labels and **cannot** read confidential notes or storage locators | Applied only to disposable schema `p4_v1_ci`; no real private object metadata, encryption or record secrets introduced |
| 4. Exact record gate and minimal output | `p4-v1-ci-authorized-app.ts` adds `readP4V1CiAuthorizedLead`: UUIDv4 input, app+permission verification, (organization,id) compound Prisma lookup under FORCE RLS, allowlisted `id/label` response. `p4-v1-ci-authenticated-router.ts` offers test-only GET `/:orgId/apps/crm/leads/:leadId` | Not mounted in `backend/src/app.ts`; no writes, customer API, file download, or live Auth0 identity exposure |
| 5. Negative SQL, Prisma and HTTP security tests | `backend/db/tests/012_p4_v1_ci_record_field_acl.sql`, updates to `backend/src/scripts/p4-ci-v1-authenticated-authorization-smoke.ts`, `backend/test/p4-v1-ci-authentication.test.ts`, and GitHub CI workflow | Real disposable PostgreSQL verifies team assigned vs unassigned, absent app permission or entitlement, forbidden SQL fields and cross-tenant access. This is **not** completion of 727 original P1.09 cases |

## Test evidence

[GitHub Actions #44754559278](https://github.com/owaisprog/Zoho-Clone/actions/runs/44754559278): **4/4 jobs PASSED**, **250/250 automated tests PASSED**: 58 frontend, 179 backend, 5 shared, 8 scripts. Real SQL and Prisma integration jobs also passed.

- SQL log: `P4.13 CI-only team record RLS, entitlement, RBAC, SQL field grant denial PASS`
- Live PostgreSQL/HTTP log: `P4 integration 06: Auth0 subject, TEAM/RECORD RLS, sensitive-column denial, independent app grants/RBAC and synthetic HTTP 401/403 checks PASS`
- Existing identity, two-org, revoked-member, pool-cleanup, Prisma and audit tests remained green.
- Intermediate commit `d60dc89` had a temporary Prisma role-guard mismatch after changing column grants; corrected in `03633e7` before this successful run. The final verified implementation head was `e0155b0`.

## Remaining gates (explicitly unclosed)

- **No live Auth0 signature/MFA/revocation acceptance.** The CI token evidence is test-injected; a truthful claim of live JWT signature validation requires authorized real Auth0 end-to-end staging tests.
- **P1.06 record- and field-authorization specification remains open**. Provisional Charlie/team policies do not grant production access or authorize record sharing in the commercial product.
- **Actual storage provider, scanner, retention and region unapproved**; private files/uploads/downloads stay disabled. P6 billing entitlements and P7 workers are not connected.
- **No owner Neon schema migration**; candidate 012 is intentionally only for disposable GitHub Postgres. No external cloud spending, deployment, PR merge, production use, or customer data.
- P2.02, P3 staging/security controls, all 14 original risks and 12 tracked decisions, and **727 original unexecuted P1.09 tests** remain open.
- Full P4 exit still needs two isolated staging test organizations exercising real identity, permissions, teams, files and audit, security review and explicit owner signoff. Track [issue #61](https://github.com/owaisprog/Zoho-Clone/issues/61).

**Next suggested safe work:** Draft a precise reviewable P1.06 permissions proposal (owner, member, teams, files, record/field access) and synthetic export/denial tests; do not operationalize it or pick providers without a separate owner approval. Real Auth0 plus private storage require staging/infrastructure owner decisions.
