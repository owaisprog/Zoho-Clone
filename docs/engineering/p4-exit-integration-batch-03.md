# P4 phase-exit integration hardening — Batch 03: UUIDv4 relational and RLS rehearsal

**Date:** 2026-11-20
**Owner authorization:** [ADR 0007](../adr/0007-architecture-v1-owner-approval.md) approved internal development and staging **preparation**, not migrations, staging deployment, or production.
**Roadmap mapping:** P3.05/06 (PostgreSQL and migrations; ORM/SQL conventions), P4.05–P4.11 (tenant and membership isolation), P4.13–P4.14 (record access and revocation), P4.19–P4.21 (audit and files); Appendix B and Express Appendix I.12–I.14.
**Formal phase status:** **P4 OPEN**, original user security gates unchanged.

## Five implementation slices

| Slice | Implemented in GitHub code | Verification / limitation |
| --- | --- | --- |
| 1. Global IDs and identity binding | New isolated schema `p4_v1_ci` with global users and unique OIDC `(issuer, external_subject)`, UUIDv4 internal domain, organizations, memberships | DB rejects UUIDv1 and duplicate OIDC subjects; signed Auth0 identity and UUID migrations to managed staging remain unverified |
| 2. Tenant-local business relationships | Composite `(organization_id, id)` PKs and tenant-scoped FKs across teams, team memberships, leads, file metadata, outbox events and redacted audit entries | CI rejects cross-org team/file/outbox references and file-owner/lead-owner mismatch; actual P5 CRM remains blocked |
| 3. RLS and restricted roles | PostgreSQL ENABLE and FORCE RLS on all ten tables; one NOLOGIN, nonowner, non-BYPASSRLS role with SELECT-only grants on permitted projections; users/OIDC/outbox/teams remain inaccessible to runtime | SQL tests prove default deny, owner vs member record scoping, owner-only audits, no unapproved writes. Real staging runtime role and final P1.06 policies not approved |
| 4. Revocation and transaction locality | Restricted SQL tests switch same owner between two organizations; member only sees owned lead; revocation removes visibility; COMMIT/ROLLBACK clears transaction GUCs | Verified in disposable CI; not connected to live Auth0/Prisma/Next.js |
| 5. Actual pooled PostgreSQL probe | Node `pg` pool (size 1), `SET LOCAL ROLE`, bound actor/tenant context, exact active membership validation; same client reused across tenants and after rejected requests | CI-only script guards `CI=true`, localhost and exact test database/user. No Neon, staging, production or service endpoint connection |

## Files
- `backend/db/candidates/010_p4_v1_uuidv4_relational_isolation.sql` — isolated UUIDv4 relational candidate and fictional records
- `backend/db/tests/010_p4_v1_uuidv4_relational_isolation.sql` — constraints, RLS, grants, revocation and cleanup
- `backend/src/scripts/p4-ci-v1-uuidv4-tenant-smoke.ts` — actual restricted pooled PostgreSQL read probe
- `.github/workflows/p3-scaffold.yml` — append CI-only candidate, SQL test and smoke script

## Verified CI evidence
[GitHub Actions #44741204992](https://github.com/owaisprog/Zoho-Clone/actions/runs/44741204992): **4/4 jobs passed**, **226/226 automated tests passed** (58 frontend, 155 backend, 5 shared, 8 scripts), plus SQL and live-PG integration checks.

The PostgreSQL isolation job emitted:
- `P4 architecture v1 CI-only UUIDv4 tenant composite FK + FORCE RLS PASS`
- `P4 architecture v1: actual pooled PostgreSQL UUIDv4 RLS, two tenants, revocation and role cleanup PASS`

The dedicated schema is intentionally **separate from** existing `synthetic` and `p4_synthetic` test fixtures. These verified checks are not the original 727 P1.09 acceptance cases.

## Mandatory remaining release gates
- Final approved Prisma schema/real internal UUID migration strategy and correct Auth0 real JWT issuer+subject mapping; no attempt to transform existing `user_demo_*` fixture IDs into production users.
- Approve P1.06 role, team/record and field matrix. Current candidate's simple owner/record-owner RLS is an **isolated sample only**, not the complete policy.
- Obtain owner signoff on a managed staging environment, restricted runtime credentials, secrets, region, backup/recovery, tested migration drift/rollback and real Auth0 MFA/revocation.
- Approve S3/R2 private storage, malware scanner, retention, file lifecycle and provider costs; no live file object or signed URL implemented.
- Implement audited transactional outbox and controlled workers only at scheduled phase with separate owner approval.
- Two full synthetic staging organizations with real identity, teams, permissions, files and audit journeys; execute planned P1.09 acceptance cases and independent negative security review.

**Do not run SQL candidate 010 or earlier CI candidates on Neon. Do not deploy, buy cloud services, merge PR #55 to `main`, accept real data, declare P4 complete or begin P5 production-facing CRM based on this evidence.** Original 14 risks, 12 tracked decisions and 727 unexecuted P1.09 cases remain open. Track formal P4 exit on [issue #61](https://github.com/owaisprog/Zoho-Clone/issues/61).
