# P4 Batch 13 — restricted PostgreSQL team and invitation metadata reads

Date: 2026-11-21 (Asia/Karachi). Stacked on Batch 12 development PR #62. **Synthetic CI only.**

## Five implementation steps
1. Add guarded disposable candidate 017 SQL function for team summaries, with fixed tenant/actor GUC, current active membership, exact platform entitlement, and active ORG_OWNER/ORG_ADMIN grants.
2. Enforce minimal fields (team UUID, Demo title, active-member count, is-manager flag). No member IDs or team mutation. A SECURITY DEFINER helper is permitted **only for isolated CI proof**; production role design remains undecided.
3. Add real PostgreSQL negative tests for no-context, direct table privileges, foreign org, sales rep, sales manager, membership revocation, disabled entitlement, blocked SQL writes, token hash denial and transaction cleanup.
4. Add restricted Prisma transaction reader and safe invitation expiration projection based on existing P4 R11 RLS-filtered invite metadata; no raw recipient email/token, no status change.
5. Add 9 new unit test cases, real disposable PostgreSQL/Prisma two-organization integration smoke and CI workflow steps.

## Important P1.06 boundary
P1.06's 13-role × 22-resource matrix **does not contain a distinct team directory resource**. Therefore Batch 12's browser/fixture manager-team preview **must not be interpreted as approved live access**. The DB-backed Batch 13 reader is narrowed to ORG_OWNER/ORG_ADMIN membership metadata, and SALES_MANAGER / SECURITY_REVIEWER / SALES_REP are denied pending a dedicated, owner-approved team access mapping.

## Code
- `backend/db/candidates/017_p4_r13_ci_scoped_team_summaries.sql`
- `backend/db/tests/017_p4_r13_ci_scoped_team_summaries.sql`
- `backend/src/platform/p4-r13-ci-team-invite-reader.ts`
- `backend/test/p4-r13-ci-team-invite-reader.test.ts`
- `backend/src/scripts/p4-ci-r13-team-invite-smoke.ts`
- `.github/workflows/p3-scaffold.yml`

## Acceptance
At authoring time GitHub CI remains **pending**; do not claim proof until workflow run succeeds. Unit and SQL tests are added, and existing R11 IAM tests still run.

**Not authorized:** Neon migrations, real Auth0 login/MFA/revocation, live HTTP IAM routes, role/team writes under R10-C1–C5, invite send/accept/revoke, private files/scanning, paid cloud, staging, production, merging to main or real customer data. P4 exit issue #61, P2.02/P3 staging, 14 original risks, 12 tracked decisions and 727 original P1.09 cases remain OPEN. No P4 commercial/release signoff.
