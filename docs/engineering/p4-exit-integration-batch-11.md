# P4 integration-hardening Batch 11 — tenant-scoped IAM metadata reads

**Date:** 2026-11-21 (Asia/Karachi)
**Owner authorization:** P1.06 approved permission DESIGN, ADR 0007 and owner-approved ADR 0008 D1/D2/D4/D5 for **internal synthetic-only work**.
**Explicitly not approved:** R10-C1–C5 real permission-changing contract, Auth0 live sessions, live storage/download, externally provisioned staging, production SQL, release or customer data.
**GitHub:** Branch `feat/p4-identity-org-foundation-batch-01-20261120`, [draft PR #55](https://github.com/owaisprog/Zoho-Clone/pull/55) (not main).

## Five implementation steps

| Step | Committed code | Security test and boundary |
| --- | --- | --- |
| 1. Tenant and role-scoped R0 identity metadata | CI candidate `backend/db/candidates/016_p4_r11_ci_scoped_iam_read_surfaces.sql` adds isolated `p4_r11_ci` fake invitation/audit metadata and live-current membership+role summary function | Two synthetic organizations, globally mapped fake UUIDv4 identities and current `ORG_OWNER`, `ORG_ADMIN`, `SECURITY_REVIEWER`, `SALES_REP` roles. This is a **restricted GitHub CI-only** schema using a demo owner and security-definer helpers, not a production migration or production role credential |
| 2. SQL least privilege and revocation | Same candidate grants ONLY `organization_id/id/status/role/expiry` invite columns and sanitized `id/actor/action/time` audit columns. P1.06 role+active membership+platform entitlement evaluated each read under FORCE RLS | `backend/db/tests/016_p4_r11_ci_scoped_iam_read_surfaces.sql` denies no-context, rep, revoked admin, disabled platform and foreign-tenant reads; verifies owners can read only their current org, admins can see only unprivileged business roles and not raw audit, and reviewers see sanitized audit/membership metadata |
| 3. Strict Prisma-safe projections | `backend/src/platform/p4-r11-ci-iam-reader.ts` invokes existing restricted `SET LOCAL ROLE` transaction, fresh identity/membership/app/role evidence, P1.06 action checks and fixed SQL queries; returns explicit allowlists only | Whitelists UUIDv4 IDs, role codes, actions, status and bounded timestamps; max 20 records, no arbitrary projection or query strings, no private issuer, token hash, email or audit payload returned |
| 4. CI-only Express reads | `backend/src/platform/p4-r8-ci-test-router.ts` adds GET-only `/:orgId/iam/members`, `/:orgId/iam/invitations`, `/:orgId/iam/audit` | Requires CI-injected verified identity evidence mapped by issuer/subject → global internal UUID, then fresh tenant SQL authorization. 401 missing/invalid synthetic evidence, 403 for unauthorized roles/tenants/params; no POST, invite delivery/acceptance/revoke, file download, write or export |
| 5. Disposable PostgreSQL + HTTP + unit regressions | `backend/src/scripts/p4-ci-r11-iam-read-smoke.ts` and `backend/test/p4-r11-ci-iam-reader.test.ts` (9 new backend tests) plus GitHub Actions workflow | Real disposable PG/Prisma/HTTP checks of owner/admin/reviewer/rep scoping, two-tenant isolation, hidden private columns, safe projections, revoked membership/platform and session-pool cleanup. A final extra test explicitly rejects a forged `ORG_OWNER` row delivered to an admin by a faulty adapter |

## Verified code checkpoint

[GitHub Actions #44844318336](https://github.com/owaisprog/Zoho-Clone/actions/runs/44844318336): **4/4 jobs PASS and 294/294 automated tests PASS** (58 frontend, 223 backend, 5 shared, 8 safety scripts). Real disposable PostgreSQL job emitted:

- `P4 R11 CI-only IAM directory, invitation, audit least privilege and next-request revocation PASS`
- `P4 R11 CI-only Auth0-subject mapped IAM metadata, role/invite/audit minimization, revocation, two-org HTTP 401/403 PASS`

The pure adapter test was subsequently tightened to explicitly deny privileged owner-role rows in an admin response; the final GitHub CI run should be linked separately once complete. These tests are **engineering tests**, not the original planned 727 P1.09 acceptance cases.

## Limitations and unchanged gates

- **P1.06 is a full 13-role × 22-resource × 286-decision approved design**, but executable integration remains a small **read-only** subset. Role/team mutations R10-C1–C5 are **proposals awaiting owner approval**, even though CI-only candidate 015 tests fake owner toggles.
- Invitation status uses **no real email, sender, token, provider, invitation acceptance or actual sign-in**. For the `SECURITY_REVIEWER`, invitation reads remain intentionally **more restrictive than** the approved high-level matrix, pending an approved exact invite-audit field policy.
- Audit status is a separate **fake sanitized projection**, not a persistent centralized production audit pipeline nor independently certified append-only store, retention or deletion process.
- CI-only `SECURITY DEFINER` functions and session context deliberately rely on disposable bootstrap control. They **cannot** be promoted unchanged as production privilege architecture; live role design, identity binding and independent security review remain OPEN.
- Real Auth0 MFA/JWKS/invite flows and session revocation, approved private-file storage/anti-malware scanning, provider/region/retention/legal choices, live RLS writer credentials, staging/rollback, cross-org end-to-end acceptance and owner P4 signoff remain OPEN.
- **OPEN-003 and all 12 tracked decisions, 14 risks, 727 original unexecuted P1.09 cases and P4 exit issue #61 remain OPEN**. No candidate 016 or previous SQL was applied to owner Neon; no live data, paid cloud, main merge or staging/production deployment.

**Next internal-safe priority:** Continue read-only scoped team membership and pending invite lifecycle preview tests while keeping actual invite sends, team/role mutators and file adapters gated on owner policy/provider approval.
