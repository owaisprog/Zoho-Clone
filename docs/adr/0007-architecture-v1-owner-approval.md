# ADR 0007 — Architecture v1.0: owner-approved internal foundation

**Decision date:** 2026-11-20
**Status:** **OWNER APPROVED — DESIGN ONLY, FOR INTERNAL DEVELOPMENT AND PHASE 4 STAGING PREPARATION**
**Source:** Explicit owner approval in active ChatGPT conversation on 2026-11-20; 225-page Express.js Master Development Roadmap pp. 2, 30–39, 193, 210–216.
**Scope:** P3 architecture decisions and P4 security foundation for P4–P17 modules.
**Prior ADRs:** 0001–0006. This ADR records a decision; it does not supersede their still-open release, provider, migration and security requirements.

## Precisely approved architecture
1. Keep the **existing** Node.js + Express.js 5 + TypeScript **modular monolith**, Next.js/React/TypeScript frontend, Tailwind/shadcn UI, versioned REST contracts and **npm workspaces**. Do not migrate to NestJS, microservices, pnpm or Turborepo without another explicit owner decision.
2. Use **shared PostgreSQL + Prisma**, with tenant-owned rows scoped by organization and composite tenant FK/indexes, **FORCE ROW LEVEL SECURITY**, transaction-local verified actor/tenant context and a restricted non-owner, non-BYPASSRLS runtime role. Use opaque **UUIDv4** identifiers for **new** global internal users, organizations, memberships' entity references and business records; Auth0 external subjects stay provider strings in a separate unique issuer+subject mapping. Existing fictional fixtures are not authorized for production migration.
3. Keep **Auth0** for managed identity. Authenticate separately from **active organization membership**, application entitlements, tenant-scoped RBAC, record/team/field ABAC and database RLS. Token/email/URL alone never grants tenant access. Protect admin/support actions with independent privilege/step-up and consent.
4. Keep a **provider-neutral private object-storage interface** with deny-by-default when no provider is configured. Any later live adapter must use private buckets, quarantine, malware/content scanning, narrow short-lived signed grants, per-record permission checks, retention and audited deletion/restore.
5. At the appropriate planned phase, use **PostgreSQL transactional outbox** (same transaction as business changes) plus **Redis + BullMQ** for bounded, idempotent asynchronous delivery. No authorization to start live workers now.
6. Architect **separate development, staging and production** databases, secrets, identity environments, storage and release controls. Any real staging configuration/deployment requires its own owner approval.

## Explicitly NOT approved
- Real customer data, sensitive banking/card/KYC capture, external pilots or commercial launch;
- Paid cloud spending; staging/production deployment; production API exposure;
- Applying **any** isolated CI SQL candidates to owner Neon (including 004–009);
- Merging PR #55 or its P3 parent to `main`, or enabling production permissions/routes;
- Closing P4, P3, P2.02, the original 14 recorded risks, 12 tracked decisions or 727 unexecuted P1.09 acceptance cases;
- Final storage provider (S3 vs R2), Node hosting provider, geographic region/residency, retention periods, scanner, telemetry vendor, secrets/backup policy, or data-processing contracts.

## Still-open decisions and phase gates
- OPEN-001 Auth0 acceptance (MFA, invite, signed real JWT, revocation): vendor chosen but full integration OPEN.
- OPEN-002 UUIDv4 **key format approved**; precise physical schema, FK/cross-tenant enforcement, migration plan and staging validation OPEN.
- OPEN-003 RBAC/ABAC **design approach approved**; exact action/record/field matrix, scope defaults, admin exceptions and security tests OPEN.
- OPEN-005 outbox + Redis/BullMQ **pattern approved**; runtime, delivery/retry semantics and operational rollout OPEN.
- OPEN-006 private storage/security pattern **approved**; import/export and provider rollout OPEN.
- OPEN-007, OPEN-010 hosting environment, residency and retention OPEN.
- All other pre-existing decisions remain OPEN; approvals here are design-level only.
- P4 exit (two isolated test companies with Auth0 identity, teams, permissions, files and audit) requires real staging acceptance and explicit owner signoff. CI synthetic tests never substitute for it.

## Safe implementation authorization
May add/adjust TypeScript contracts, UUIDv4 validators, synthetic fixtures, provider-neutral adapter protections, CI-only database tests, ADR docs and development PR test coverage. Must use fictional-only data and isolated CI. **No schema migration to Neon, no staging/production deployment, no merge or cloud purchase**. Stop at external/resource approvals and report blockers.
