# P4 integration-hardening batch 05 — Auth0 subject-to-UUID, fresh membership, app entitlements and direct-API denial

**Date:** 2026-11-20
**Roadmap basis:** P4.01–P4.03 (managed identity), P4.06 (organization membership), P4.10–P4.11 (tenant context/RLS), P4.13 (authorization), P4.17 (application registry), P4.18 (server-owned app navigation).
**Owner authorization:** [Architecture v1.0 ADR 0007](../adr/0007-architecture-v1-owner-approval.md), **internal development and Phase 4 staging preparation only**.
**Branch:** `feat/p4-identity-org-foundation-batch-01-20261120`, existing **draft** [PR #55](https://github.com/owaisprog/Zoho-Clone/pull/55).
**Status:** All five engineering slices implemented and synthetic CI-verified; **P4 formal acceptance NOT COMPLETE**.

## Five implemented slices

| # | Implementation | Runtime evidence / limitation |
| --- | --- | --- |
| 1 | `backend/db/candidates/011_p4_v1_ci_identity_app_access.sql`: PostgreSQL restricted nonlogin identity lookup role, separate nonlogin function owner, narrowly scoped SECURITY DEFINER exact issuer+subject mapping; grant direct table SELECT only to function owner and function EXECUTE only to lookup role | `backend/db/tests/011_p4_v1_ci_identity_app_access.sql` proves direct lookup role cannot enumerate OIDC mappings, CRM or memberships. **Function is callable with arbitrary subject by its role; only a server-side cryptographic Auth0 verifier may choose lookup inputs. This is NOT production-approved function design** |
| 2 | `backend/src/platform/p4-v1-ci-identity.ts`: verified-claim shape validation and exact issuer, audience, expiry, email-verified, UUIDv4 mapping. Disposable CI pool uses `SET LOCAL ROLE`, fixed db host/role and transaction cleanup | Synthetic verified token is **injected by tests**, not a cryptographically checked real Auth0 JWT; pending SDK/live sign-in/MFA/revocation acceptance |
| 3 | CI-only `p4_v1_ci.app_grants` and `p4_v1_ci.role_permissions` tables, separate RLS policies, role-specific read-only SELECT grants; matching models added to `backend/db/p4-v1-ci.prisma` | Both app entitlement and permission required in same active member transaction; no tenant-admin mutation/role granting API or commercial P6 billing entitlement yet |
| 4 | `backend/src/platform/p4-v1-ci-authorized-app.ts`: deny-by-default CRM read and app manifest from fresh Prisma membership, role permission and active app grant. `backend/src/platform/p4-v1-ci-authenticated-router.ts`: GET-only test-only app manifest/direct CRM APIs; no normal app mount | Locked direct API returns 403, missing/invalid identity 401, foreign tenant 403, no POST/upload/download; application routes **not** enabled in live Express |
| 5 | `backend/src/scripts/p4-ci-v1-authenticated-authorization-smoke.ts`, `backend/test/p4-v1-ci-authentication.test.ts`, SQL negative tests and expanded GitHub workflow | Real disposable PostgreSQL and injected-claim HTTP test covers two organizations, wrong issuer/audience/expired claim, unmapped/revoked subject, forged headers, direct app permission bypass, field minimization and pool cleanup |

## GitHub Actions verification

[Run #44751975773](https://github.com/owaisprog/Zoho-Clone/actions/runs/44751975773) completed **4/4 jobs PASS** and **244/244 automated tests PASS**:
- Frontend: 58
- Backend: 173
- Shared contracts: 5
- Node safety scripts: 8

PostgreSQL run explicitly emitted:
- `P4.17 CI-only issuer-subject lookup isolation and entitlement/RBAC RLS PASS`
- `P4.11 Prisma 7 UUIDv4 tenant transactions: two-org ORM reads, cross-tenant denial, revoked-user denial, write denial and role/GUC pool cleanup PASS`
- `P4 integration 05: exact subject UUID mapping, fresh Prisma membership, independent app grants/RBAC and synthetic HTTP 401/403 checks PASS`

The transient CI type error in early HTTP-router commits was corrected by `73a97f5`, before the successful cited run. The complete implementation and tests remain on draft PR #55, not `main`.

## Important remaining gates — OPEN

1. **Real JWT verification NOT performed:** An injected `cryptographicallyVerified:true` test object is not a signature. Before real user access, wire and verify official Auth0 JWKS middleware, authenticated issuer+subject mapping, MFA, recovery, invitation acceptance, revocation/refresh, CSRF and secure browser sessions. Independent threat review needed for subject SECURITY DEFINER function.
2. **P4 / P1.06 access policies incomplete:** The sample OWNER/MEMBER catalog, simplified owner vs record-owner RLS and two app grants are not the final record/field/team/department authorization matrix. P6 subscription/entitlement source not integrated.
3. **Real data environment unapproved:** Current mapping, roles, UUIDv4 SQL candidates 010–011, the CI bootstrap `demo_ci` and Prisma client are only valid on disposable localhost GitHub CI. **Never run these SQL candidates on Neon or staging/production**. Staging DB role, migration, rollback/restore, secret management and infra costs/regions require separate owner decisions.
4. **File and audit flows not accepted:** Provider-neutral file service currently denies real uploads/downloads and has no selected private S3/R2 provider, scanner, region, retention or audited lifecycle. P4 audit mutations, support access and operational controls need end-to-end staging acceptance.
5. **Release gates remain:** P2.02 information architecture and P3 staging exit, original 14 risks and 12 tracked decisions, and **727 original unexecuted P1.09 cases** remain OPEN. P4 exit requires two synthetic organizations with full identity/team/access/files/audit flows and explicit owner security/release signoff. P5 commercial launch remains blocked.

No cloud purchases, database changes to owner Neon, `main` merge, staging/production deployment or real customer data were authorized or performed.

## Next safe step

In the existing draft PR, continue isolated integration work on **real Auth0 SDK boundary composition with no verified-account credentials**, clear separation of identity database role versus tenant runtime pool, and reviewable final record/field policy tests. External/staging/provider decisions remain owner gates.
