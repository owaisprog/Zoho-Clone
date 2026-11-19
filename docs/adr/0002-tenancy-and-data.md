# ADR 0002 — Tenant-aware PostgreSQL and Prisma

Status: **PROVISIONAL / OPEN-002 and OPEN-003 BLOCK** — 2026-11-16
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
Final opaque key strategy and ACL granularity require owner approval.
