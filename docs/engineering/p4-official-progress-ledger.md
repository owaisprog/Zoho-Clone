# P4 master roadmap status — 25 subphases

Official source: 2026-11-13 Express.js master roadmap, P4.01–P4.25.
The original 727 P1.09 acceptance cases are **NOT RUN**.
This ledger uses implemented source and CI evidence separately from release gates.

| Phase | Feature | Engineering status | Formal approval |
| --- | --- | --- | --- |
| P4.01 | Account registration | Auth0-hosted sign-in exists; verified email/subject policy and account status UI; CI-only schema | OPEN: real registration/verification/duplicates |
| P4.02 | Login/logout | Existing Auth0 identity-only flow plus safe session status route | OPEN: revocation, session/CSRF and runtime acceptance |
| P4.03 | MFA/recovery | Fresh-MFA deny policy and UX guidance; no privileged route | OPEN: provider MFA, recovery acceptance |
| P4.04 | Global user profile | Self-only synthetic validator/repository contract and CI-only DB candidate | OPEN: authorized persistent GET/PATCH /me |
| P4.05 | Organization creation | Fictional browser preview; atomic service contract and CI-only UNIQUE/forced RLS tests | OPEN: real Auth0-to-tenant bridge and writes |
| P4.06 | Organization membership | Synthetic self-only active membership lookup and per-org roles with revoke tests; no live endpoint | OPEN: authenticated persistence and member-management ACL |
| P4.07 | Organization switcher | Browser-only fictional switcher; source-level fresh membership verification per switch | OPEN: real active-workspace context and verified backend switch |
| P4.08 | Invite send/resend | Synthetic owner-only issuance, rate/delay constraints, SHA-256 token hashing and resend rotation tests | OPEN: real email delivery, auditing and locked transaction DB adapter |
| P4.09 | Invite acceptance/revoke | One-use fictional token lifecycle, identity-email match, atomic member creation/consumption, revoke/expiry tests | OPEN: real Auth0-backed accept UI/API and secure link redemption |
| P4.10 | Tenant context middleware | Injectable Express middleware with fresh membership guard; isolated integration tests and CI-only SQL RLS checks | OPEN: real provider subject mapping, production backend mount and job propagation |
| P4.11 | PostgreSQL RLS policies | Scoped transaction helper and disposable CI candidate with FORCE RLS, non-owner app-role tests, cross-tenant/revocation denial | OPEN: real staging/production role and actual Prisma full tenant access |
| P4.12 | Roles catalog | Immutable reserved OWNER/MEMBER templates, allowlisted custom-role drafts, CI-only roles/grants/assignments | OPEN: real role CRUD, approved P1.06 permissions and tenant-scoped grants |
| P4.13 | Permissions engine | Synthetic RBAC+record-owner/team ABAC default-deny evaluator and fictional UI matrix | OPEN: real API/UI authorization parity under live Auth0/Prisma and record/field policies |
| P4.14 | Access revocation | Atomic synthetic disable/revision/audit service, tests prove fresh membership denies removed actor | OPEN: real DELETE members API, Auth0 access-token revocation and cache/worker enforcement |
| P4.15 | Departments and teams | CI-only same-org FKs/RLS and backend team visibility/create contract; fictional UI | OPEN: real department/team APIs, manager assignment and CRM/HR acceptance |
| P4.16 | Organization preferences | Synthetic org preferences validation/read/update contract, versioned owner writes, user timezone precedence, fictional settings preview, CI-only table | OPEN: authenticated GET/PATCH, actual DB writes, reporting/billing approvals |
| P4.17 | Application registry | Fixed app catalog, separate entitlement and permission evaluation, direct-URL denial tests in isolated Express app, CI-only app grants | OPEN: real GET /apps, tenant entitlements and direct-route security |
| P4.18 | Workspace navigation shell | Keyboard-searchable demo app launcher, locked cards, responsive workspace navigation links, fictional manifest | OPEN: backend /navigation/manifest and accessibility/real authenticated navigation |
| P4.19 | Audit log engine | Redacted append-only event contract, owner-only read, CI-only FORCE RLS table and separate INSERT-only writer role, fictional filterable log | OPEN: real audit GET API, all writes wired, retention/security reviews |
| P4.20 | File upload service | Same-org/record metadata validator, explicit deny of signed URLs, CI-only quarantined file/version metadata, disabled upload UI | OPEN: private provider, scanning/quarantine, real record authorization/upload API |
| P4.21–P4.25 | File download/deletion, notifications, platform admin, support access and org deletion/export | Synthetic-only TypeScript contracts, fictional UI, negative tests, CI-only SQL; NO live routes or jobs | OPEN: Auth0/Prisma/storage/worker integration, admin/consent, data export/delete and owner signoff |

## CI checkpoint

[PR #55](https://github.com/owaisprog/Zoho-Clone/pull/55) is a
draft targeting the P3 **development** branch, not main.
[CI run #44632379730](https://github.com/owaisprog/Zoho-Clone/actions/runs/44632379730):
**137 tests passed (46 frontend / 78 backend / 5 shared / 8 scripts),
4/4 jobs passed**, including actual ephemeral PostgreSQL RLS/slug/rollback
assertions executed as a restricted non-owner CI role.
The owner can defer all local Mac pulls without interrupting GitHub work.

P4.01–P4.05 product acceptance requirements and live user/org APIs remain
OPEN in [issue #56](https://github.com/owaisprog/Zoho-Clone/issues/56).

**P4 batch 02 verified:** [CI run #44637357343](https://github.com/owaisprog/Zoho-Clone/actions/runs/44637357343)
passed **4/4 jobs, 155 tests**: 48 frontend + 94 backend + 5 shared
+ 8 script, all zero failures. CI-only PostgreSQL synthetic candidate
tests passed as restricted non-owner role, covering owner-only invites,
unique pending email, per-tenant access, conditional single-use states and
deny-by-default policies. This extends engineering coverage of P4.06–P4.10;
formal acceptance remains OPEN in [issue #57](https://github.com/owaisprog/Zoho-Clone/issues/57).
No real invitation delivery, tenant membership writes, privileged APIs
or production migrations were performed.

**P4 batch 03 verified:** [CI run #44643627579](https://github.com/owaisprog/Zoho-Clone/actions/runs/44643627579)
passed 4/4 jobs and 176 tests (51 frontend, 112 backend, 5 shared,
8 scripts). Disposable PostgreSQL restricted non-owner FORCE RLS
tests checked default deny, reserved roles, team-level tenant isolation
and revoked-member denial. Formal P4.11–P4.15 acceptance remains OPEN
in [issue #58](https://github.com/owaisprog/Zoho-Clone/issues/58).
These changes do not migrate the owner's Neon database or enable live
role, member, department, team or permission APIs.

**P4 batch 04 verified:** [CI #44719617968](https://github.com/owaisprog/Zoho-Clone/actions/runs/44719617968)
passed **4/4 jobs, 193 tests** (55 frontend, 125 backend, 5 shared,
8 scripts) with synthetic PostgreSQL RLS and a distinct INSERT-only
audit writer. Metadata-only file handling remains deliberately
disabled; real file uploads and app entitlements are not enabled.
Formal P4.16–P4.20 acceptance remains OPEN in
[issue #59](https://github.com/owaisprog/Zoho-Clone/issues/59).

**Phase exit:** two isolated demo organizations with full identity, teams,
permissions, files and audit, executed acceptance evidence, explicit owner signoff.
All original 14 risks, 12 unresolved decisions and unexecuted 727 P1 tests
remain open; P3 staging/ADR and P2.02 review remain open.
P4.01–P4.20 are synthetic development implementation slices, not formally
completed product features. No commercial/external authorization granted.


**Batch 05 (2026-11-20):** P4.21–P4.25 synthetic TypeScript policy contracts, negative tests, CI-only RLS candidate and fictional /app/organization/continuity Next.js page. See [engineering batch 05](p4-batch-05-file-notifications-platform-support-closure.md). Actual public/privileged APIs, file operations, platform/support grants and deletion/export remain DISABLED; formal acceptance OPEN. [GitHub Actions #44724748196](https://github.com/owaisprog/Zoho-Clone/actions/runs/44724748196): 4/4 jobs PASS, 204/204 tests PASS (58 frontend, 133 backend, 5 shared, 8 scripts), including disposable PostgreSQL RLS checks. Formal acceptance is tracked in [issue #60](https://github.com/owaisprog/Zoho-Clone/issues/60).


**P4 phase-exit integration-hardening batch 01 (2026-11-20):** A verified-provider-actor to tenant read chain, restricted Postgres identity lookup, real CI PostgreSQL two-org RLS smoke, test-only Auth0 SDK middleware composition, and negative revocation/foreign-org tests were added. [CI #44727449525](https://github.com/owaisprog/Zoho-Clone/actions/runs/44727449525) passed 4/4 jobs and 213/213 tests (58 frontend, 142 backend, 5 shared, 8 scripts). See [integration report](p4-exit-integration-batch-01.md). **This is not P4 EXIT acceptance.** Real Auth0 sessions, real managed DB/staging RLS, private files and audit continuity, original product acceptance and owner P4 signoff remain open in [issue #61](https://github.com/owaisprog/Zoho-Clone/issues/61).


**P4 exit integration-hardening batch 02 (2026-11-20):** Read-only P4.11/P4.13/P4.17–P4.22 integrated RLS platform projection and test-only API (`/:orgId/shell`, `/:orgId/apps/:code`, `/:orgId/audit-logs`) were added, including fresh DB membership/role checks, permission+entitlement app locks, server-owned navigation, recipient-only notifications, owner-scoped files metadata and redacted audit events. [GitHub Actions #44729808943](https://github.com/owaisprog/Zoho-Clone/actions/runs/44729808943): **4/4 jobs PASS, 218/218 tests PASS** (58 frontend, 147 backend, 5 shared, 8 Node script). Real disposable PostgreSQL read smoke across both organizations passed. Full engineering report: [P4 exit integration 02](p4-exit-integration-batch-02.md). **P4 formal exit still OPEN** under [issue #61](https://github.com/owaisprog/Zoho-Clone/issues/61); none of this authorizes customer data, real Auth0 sessions, Neon mutations, production deploy or P5 release.


**Owner architecture v1.0 approval (2026-11-20):** [ADR 0007](../adr/0007-architecture-v1-owner-approval.md) APPROVED for **internal development / P4 staging preparation only**. Shared PostgreSQL FORCE RLS + UUIDv4 new IDs, Auth0/membership/RBAC/ABAC/entitlements, private scanning/quarantine storage interface, transactional outbox/Redis/BullMQ in planned phase, and dev/staging/prod isolation were explicitly selected. **Formal P3/P4 acceptance, 14 original risks, 12 decision items and 727 P1.09 cases remain OPEN**. Vendor/region/retention/staging deploy and Neon migration remain unapproved. See [implementation report](p4-architecture-v1-implementation.md) and [CI #44737381948](https://github.com/owaisprog/Zoho-Clone/actions/runs/44737381948): 4/4 jobs and **226/226 tests PASS** (58 frontend, 155 backend, 5 shared, 8 script); only synthetic contracts, CI RLS reads and disabled file/outbox plans.


**P4 exit integration hardening batch 03 (2026-11-20):** Architecture v1.0 UUIDv4 relational design was implemented only in isolated CI schema `p4_v1_ci` with global Auth0 subject mapping, tenant-scoped composite PK/FKs for organizations/memberships/teams/CRM lead/file metadata/outbox/audit, FORCE RLS on all ten tables, restricted non-BYPASSRLS read-only role, revoked member and cross-company FK tests. A new actual pooled PostgreSQL script verifies two isolated organizations, transaction-local role/GUC cleanup and denied revoked/foreign access. [CI #44741204992](https://github.com/owaisprog/Zoho-Clone/actions/runs/44741204992): **4/4 CI jobs PASS, 226/226 automated tests PASS** plus SQL and real PostgreSQL probes. See [Batch 03 report](p4-exit-integration-batch-03.md). **P4 EXIT remains OPEN** in [issue #61](https://github.com/owaisprog/Zoho-Clone/issues/61), with no Prisma/Neon migration, real Auth0 integration, storage provider, staging/production or owner release approval.
