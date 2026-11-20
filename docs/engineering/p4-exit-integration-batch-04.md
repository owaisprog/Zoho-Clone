# P4 integration-hardening batch 04 — Prisma 7 UUIDv4, tenant transactions and permission tests

**Date:** 2026-11-20
**Roadmap basis:** P3.05–P3.06 + P4.10–P4.11 / P4.13–P4.14, Appendix B and Appendix I.12–I.16 of the owner-approved Express master roadmap.
**Authorized scope:** Architecture v1.0 internal development and P4 staging **preparation** only. See [ADR 0007](../adr/0007-architecture-v1-owner-approval.md).
**Branch:** `feat/p4-identity-org-foundation-batch-01-20261120` / draft [PR #55](https://github.com/owaisprog/Zoho-Clone/pull/55), **not merged**.

## Five verified implementation slices

| Step | Actual changed source | Evidence / limits |
| --- | --- | --- |
| 1. Isolated Prisma UUIDv4 schema | `backend/db/p4-v1-ci.prisma`: five typed read-models for organizations, memberships, leads, private file metadata and redacted audit logs in CI schema `p4_v1_ci`; separate generated client | Prisma 7 schema validated by CI, existing `backend/db/schema.prisma` retained; SQL domain enforces UUIDv4; no `db push` or migration to Neon |
| 2. Client and tenant-scoped transaction | `backend/src/platform/p4-v1-ci-prisma.ts`: hard-coded local CI-only connection guard, single-connection PrismaPg, `SET LOCAL ROLE p4_v1_ci_runtime`, transaction-local bound actor/org context | Verifies restricted current_user, no SUPERUSER/BYPASSRLS, no table ownership or DML grants; no HTTP or Auth0 production binding |
| 3. Current membership and safe ORM data projection | Same module: fresh `v1Membership.findUnique` in current transaction before role-scoped `findUnique/findMany` reads; only non-sensitive fields returned | No global Prisma tenant query in application; file links/downloads and record writes disabled; full record/field policy still OPEN |
| 4. Real PostgreSQL/Prisma integration tests | `backend/src/scripts/p4-ci-v1-prisma-smoke.ts` and CI workflow: two org reads, forged/foreign organization queries denied, revoked membership denied, write attempt denied, role/GUC transaction cleanup after rollback | Runs only against disposable `zoho_clone_synthetic_ci`, in GitHub CI. Test DB bootstrap role is confined to this environment; NEVER permitted in staging/production |
| 5. Negative authorization regression tests | `backend/test/p4-v1-ci-prisma.test.ts`: malformed UUIDs, rejected Neon/shared DB configuration, missing CI flag, elevated runtime grants, missing/revoked membership, safe error redaction and output field projection | Mock-based unit tests complement, but do not replace, actual CI PostgreSQL and the original P1.09 acceptance cases |

## Verified CI result

- [GitHub Actions #44745186348](https://github.com/owaisprog/Zoho-Clone/actions/runs/44745186348): **4/4 jobs PASS**, **236/236 automated tests PASS**: 58 frontend + 165 backend + 5 shared + 8 scripts.
- The same run completed both existing raw SQL tenant/FORCE RLS/foreign-key checks and the new actual Prisma ORM smoke script. PostgreSQL job explicitly emitted:
  - `P4 architecture v1 CI-only UUIDv4 tenant composite FK + FORCE RLS PASS`
  - `P4 architecture v1: actual pooled PostgreSQL UUIDv4 RLS, two tenants, revocation and role cleanup PASS`
  - `P4.11 Prisma 7 UUIDv4 tenant transactions: two-org ORM reads, cross-tenant denial, revoked-user denial, write denial and role/GUC pool cleanup PASS`
- All five models are backed by disposable CI-only schema candidate 010; the earlier `synthetic` fixtures remain separate. New Prisma generator runs during CI build/typecheck; the CLI did **not** use Neon or deploy any schema.

## Open acceptance and release gates

- Auth0 vendor is selected but **real authenticated actor ID -> UUIDv4 mapping, MFA, revoked-session and refresh acceptance are not proven** for new schema.
- Production database role must not have SUPERUSER or table-owner privileges; disposable test bootstrap `demo_ci` is used *only* in CI to set the restricted role. Staging/production credentials, migrations, tenant key schema and P1.06 fine-grained RBAC/ABAC remain pending review.
- P4 file service is still a metadata-only contract; provider, region, malware/quarantine scanner, retention, tenant-record links, short-lived grants and audited deletion are pending. No file upload/download API is enabled.
- P4 teams, permissions, full workspace navigation, app entitlements, audit mutations and original P1.09 acceptance cases are **not fully integrated or accepted**.
- P3 staging/secret/rollback, P2.02 information architecture, all 14 original risks, all 12 tracked decisions, and 727 **unexecuted original** P1.09 cases remain open; CI tests are separate from that suite.
- P4 exit requires two isolated organizations with full real identity, team, access, file and audit journeys, independent security verification, and explicit owner signoff.

**Owner's hard boundaries:** No Neon mutation (including candidate 010), paid cloud spending, staging or production deployment, `main` merge, real customer data, or commercial/P5 launch. Keep [P4 exit issue #61](https://github.com/owaisprog/Zoho-Clone/issues/61) open.

## Recommended following safe step

Draft a reviewed staging migration plan for owner approval *without executing it*, and continue isolated CI work on a read-only Auth0 subject-to-UUIDv4 mapping and an end-to-end synthetic membership/entitlement guard. Running on managed staging, enabling live storage or production APIs needs new explicit authorization.
