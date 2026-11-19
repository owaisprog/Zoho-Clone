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
| P4.11–P4.25 | RLS, roles, permissions, teams, files, audit, notifications, admin boundaries | NOT STARTED in P4 production scope | OPEN |

## CI checkpoint

[PR #55](https://github.com/owaisprog/Zoho-Clone/pull/55) is a
draft targeting the P3 **development** branch, not main.
[CI run #44632379730](https://github.com/owaisprog/Zoho-Clone/actions/runs/44632379730):
**137 tests passed (46 frontend / 78 backend / 5 shared / 8 scripts),
4/4 jobs passed**, including actual ephemeral PostgreSQL RLS/slug/rollback
assertions executed as a restricted non-owner CI role.
The owner can defer all local Mac pulls without interrupting GitHub work.

P4.01–P4.05 product acceptance requirements and live user/org APIs remain
OPEN. Track them in [issue #56](https://github.com/owaisprog/Zoho-Clone/issues/56).

**Phase exit:** two isolated demo organizations with full identity, teams,
permissions, files and audit, executed acceptance evidence, explicit owner signoff.
All original 14 risks, 12 unresolved decisions and unexecuted 727 P1 tests
remain open; P3 staging/ADR and P2.02 review remain open.
P4.01–P4.10 are synthetic development implementation slices, not formally
completed product features. No commercial/external authorization granted.
