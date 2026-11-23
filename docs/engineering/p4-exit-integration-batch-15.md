# P4 Batch 15 — audit visibility and tenant isolation hardening

Date: 2026-11-23. **Disposable CI only**, stacked on P4 Batch 14 draft branch. No live customer records, production connections or Auth0 login.

## Five development tasks
1. Introduce `019_p4_r15_ci_audit_keyset.sql` isolated SQL function for owner/reviewer read-only audit keyset pagination, backed by tenant+event UUID index. Current membership, roles, platform grants and tenant context checked at query time. Max 21 fetched for a public page of <=20.
2. Add restrictive TypeScript Prisma projection returning only `id`, `actorId`, exact allowlisted `action`, and `occurredAt`, with opaque cursor and strict monotonic ordering.
3. Add CI-only Express GET `/:orgId/iam/audit-page` with server-injected synthetic verified SDK identity mapping; reject forged headers, extra query parameters, invalid cursors and all writes. Do NOT import in app.ts.
4. Cover missing tenant context, foreign tenant, unassigned reviewer, admin/sales denial, app disable, revocation, private audit payload prohibition, limit bounds and pooled transaction reset in actual PostgreSQL assertions and 9 new backend unit tests.
5. Execute actual PostgreSQL + Prisma + synthetic HTTP integration smoke and workspace typecheck/tests/build in GitHub Actions.

## Approval boundaries
The R0 `audit_events` resource authorizes only owner and reviewer read-only metadata. No audit export, raw body, identity subject, recipient email, token, invitation delivery or role/team mutation. The SQL SECURITY DEFINER object is intentionally CI-only: production bootstrap credentials and privilege design remain unapproved.

## Verification
At authoring time CI is pending; retain DRAFT status and do not describe tests as passing until the final GitHub Actions run proves it.

## Open gates
P4 exit #61, R10-C1–C5, live Auth0/JWKS/MFA, provider/region/retention/storage/scanner decisions, P2.02/P3 staging acceptance, 14 risks, 12 decisions and 727 original unexecuted P1.09 acceptance cases remain open. No Neon migration, production, staging, payment or main branch merge.
