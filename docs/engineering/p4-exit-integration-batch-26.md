# P4 Batch 26 — membership and authorization read consistency

Date: 2026-11-23. Stacked on verified Batch 25. Synthetic-only CI integration; NOT a live Auth0 feature or P4 release approval.

## Five delivered work items

1. **Real disposable PostgreSQL/Prisma/HTTP member consistency smoke:** `backend/src/scripts/p4-ci-r26-membership-consistency-smoke.ts` runs 24 alternating requests across Orchid/Cedar, owner/admin/reviewer/sales roles and members/invitations/audit read surfaces. Verifies exact 200/403 response boundaries, sanitized fields and stable `no-store` responses.
2. **Fresh authorization revocation and restoration:** the same smoke disables Orchid admin membership and verifies immediate 403 across all three IAM readers, restores the fictional fixture and confirms recovery. It then disables Orchid platform entitlement, denies all three read surfaces while Cedar owner remains authorized, restores entitlement and checks recovery and transaction-local DB context cleanup.
3. **Restricted PostgreSQL role projection assertions:** `backend/db/tests/022_p4_r26_ci_membership_consistency.sql` checks no membership rows without a tenant/actor context, denied direct identity-subject access, bounded owner membership visibility, masked org-admin privileged roles, sales-rep denial, cross-tenant isolation and absence of pooled context leakage.
4. **Four new membership reader regression tests** strengthen exact three-field projection, no private provider subject, revoked membership denied across all three readers, entitlement denial across all three readers and reviewer/admin resource separation. Four original P1.09 case links (API-T004-NEG, API-T005-NEG, API-T007-NEG, API-T010-NEG) are **partial only**, increasing 34 to 38. Two mutation tests reject false original acceptance.
5. **Required GitHub Actions integration** runs R26 SQL and real R26 Prisma/HTTP smoke in disposable PostgreSQL following R25, alongside existing TypeScript, unit, build, schema, RLS, audit, CI source/build boundary, original 727-case inventory and formal NO_GO validators.

## Formal gates unchanged

These proofs are not production `patchMember`, `patchOrganization`, or `listEntitlements` API acceptance. They do not validate a live Auth0 session or real recovery flow. Original P1.09 acceptance remains **0 / 727 executed**. All 10 P4 release gates, original 14 risks, 12 decisions, R10-C1–C5, P2/P3 owner staging approvals and P4 exit #61 remain OPEN. No real customer data, owner Neon schema mutations, main merge, external invitations or staging/production deployment.

CI results pending at report creation; see verified GitHub Actions run in draft PR.
