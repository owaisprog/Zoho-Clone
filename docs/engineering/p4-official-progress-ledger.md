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
| P4.16–P4.25 | Preferences, app registry, workspace nav, audit, files, notifications, admin boundaries | NOT STARTED in P4 production scope | OPEN |

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

**Phase exit:** two isolated demo organizations with full identity, teams,
permissions, files and audit, executed acceptance evidence, explicit owner signoff.
All original 14 risks, 12 unresolved decisions and unexecuted 727 P1 tests
remain open; P3 staging/ADR and P2.02 review remain open.
P4.01–P4.15 are synthetic development implementation slices, not formally
completed product features. No commercial/external authorization granted.
