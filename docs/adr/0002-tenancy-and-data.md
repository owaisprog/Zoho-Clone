# ADR 0002 — Tenant-aware PostgreSQL and Prisma

Status: **OWNER-APPROVED ARCHITECTURE v1.0; FINAL PHYSICAL SCHEMA, ACL AND STAGING GATES STILL OPEN** — 2026-11-20
Source: master PDF P3.05/P3.06, P4.10/P4.11.

- One PostgreSQL database, tenant-owned rows with organization ID.
- Composite foreign keys and typed repo interfaces, with explicit SQL
  transactions setting `SET LOCAL app.tenant_id` and `app.actor_id` only
  AFTER verified identity and active membership.
- Enforce PostgreSQL FORCE ROW LEVEL SECURITY using non-owner runtime role,
  in addition to authenticated API record/field permission policies.
- Never trust a tenant URL, header, user-controlled SQL or queue payload
  as evidence of identity or tenant permission.
- Author reviewed forward-only migrations; backup/recovery and rollback
  rehearsals are required before non-synthetic data.

Candidate `backend/db/schema.prisma` and
`backend/db/migrations/001_synthetic_foundation.sql` are **fictional-
data only** and are not deployable production tenant schemas. Runtime
Prisma driver, migration drift and backup restore tests remain outstanding.
**Approved 2026-11-20:** UUIDv4 opaque IDs for new internal users, organizations and business records; shared PostgreSQL, tenant-scoped keys/FKs, FORCE RLS and restricted tenant-local transactions. **Not approved or implemented for real data:** migrations of existing synthetic tables, production runtime DB role, final record/field ACL matrix, Auth0-to-internal UUID mapping, backup/recovery, or any deployment to Neon. OPEN-002/OPEN-003 remain tracked for these unresolved implementation/security requirements. See [ADR 0007](0007-architecture-v1-owner-approval.md).
