# P4 Integration Batch 12 — team and invite previews

Date: 2026-11-21. Base: unmerged P4 development branch; isolated feature branch, **not main**.

## Five internal-only steps
1. Build a tenant-equal, current-role-checked synthetic team directory preview.
2. Show only explicitly managed teams to fictional sales managers, never team member IDs; fail closed on malformed teams/duplicates.
3. Build owner/admin-only synthetic invitation lifecycle metadata preview with deterministic expiration as-of supplied time.
4. Validate strict invite timestamps, state transitions, tenant identity, bounded records and field allowlists.
5. Add action preflight for resend/revoke/accept that **always denies execution** until approval; test stale revision, expired/nonpending invite, revoked actor, role spoofing, foreign organization, duplicate IDs and malformed rows.

## Code
- `backend/src/platform/p4-r12-team-invite-preview.ts`
- `backend/test/p4-r12-team-invite-preview.test.ts`

## No security or release acceptance implied
This pure TypeScript preview is not backed by PostgreSQL, Prisma, Auth0, workers, an invite provider, or audit persistence. It has no HTTP routes or mutations and cannot send emails. It is useful only as a **fictional fixture** contract for later source-reviewed DB/API implementation.

The owner-approved P1.06 13-role/22-resource/286-decision design is unchanged. ADR 0008 D1/D2/D4/D5 internal-only scope continues. R10-C1–C5 role-team mutation decisions remain awaiting owner review. No new owner approval is inferred.

Formal P4 exit issue #61, all 14 risks, 12 decisions, original 727 unexecuted P1.09 cases, P2.02/P3 staging, real Auth0 MFA/revocation, private file storage/scanning, approved providers/region/retention and audit architecture remain OPEN.

No Neon migration, customer data, cloud purchases, deployment or merge to main. CI results should be reported from GitHub Actions after the PR runs; do not mistake local test definitions for executed evidence.
