# P4.11–P4.15 development batch — RLS, roles, permissions, revocation, teams

**2026-11-20.** Master reference: Zoho Clone Express.js roadmap pages 34–35.
**Engineering implementation, NOT final authorization acceptance.**
Branch: `feat/p4-identity-org-foundation-batch-01-20261120`;
draft [PR #55](https://github.com/owaisprog/Zoho-Clone/pull/55)
targets the unmerged P3 development branch (draft PR #53), not `main`.

## Scope and actual source

| Phase | Delivered | Still blocked |
| --- | --- | --- |
| **P4.11 PostgreSQL RLS policies** | `backend/src/platform/p4-rls-transaction.ts` scopes a restricted client transaction with parameterized `set_config(...,true)` for verified actor and tenant; rollback and safe fixed errors. Disposable CI SQL candidate 006 creates FORCE RLS policies with a non-owner, non-BYPASSRLS test role and tests default deny, two-organization separation, role/team visibility and revocation. | **Production database runtime role tests NOT done**. Neon remains read-only synthetic dev. Real Auth0-to-user binding, Prisma production runtime, full tenant schema and approved cloud roles pending. |
| **P4.12 Roles catalog** | Immutable reserved OWNER/MEMBER role templates, limited synthetic custom-role draft validation, explicit permission allowlist and denied escalation tests; CI-only `roles`, `role_permissions`, `role_assignments` tables with unique org keys. | No real GET/POST/PATCH /roles, approved reserved grants or role edits. |
| **P4.13 Permissions engine** | Fail-closed server-only RBAC + record-owner/organization/team ABAC evaluator; unsupported code, forged templates, wrong tenant and unowned record denied. A separate fictional role/permission matrix previews access. | No live access service, persistently assigned custom roles or security-certified UI/API parity. Approved P1.06 matrix still required. |
| **P4.14 Access revocation** | Atomic synthetic membership disable, authorization revision increment and audit entry contract; tests prove previously accessible tenant is denied on a new membership check and rollback on audit failure. Fictional removal simulation on preview page. | No live DELETE /members/:id, IdP session/token revocation, cache eviction service or independent audit provider. **Browser logout does not revoke an already issued Auth0 access JWT.** |
| **P4.15 Departments and teams** | Org-scoped departments/teams/team memberships CI-only schema and restricted RLS. Backend list/create contract checks active same-organization manager and department, role and team visibility; tests manager sees only their own team and rejects cross-tenant spoofing. Fictional UI shows teams/departments. | No real /teams /departments CRUD, CRM/HR integration or approved team manager/write role. |

### Test and SQL boundaries

- Actual SQL candidates:
  `backend/db/candidates/006_p4_synthetic_access_roles_teams.sql`
  and `backend/db/tests/006_p4_synthetic_access_roles_teams.sql`.
- They run **only** on disposable PostgreSQL 17 database
  `zoho_clone_synthetic_ci` after prior candidates 004 and 005.
- CI setup creates a limited `p4_synthetic_ci_runtime` role; the SQL
  tests `SET ROLE` to it so the runner's setup superuser does **not**
  bypass RLS.
- The new runtime role has SELECT-only rights on reserved roles, role
  permissions, departments and teams. No live grants or real tenant
  writes are enabled. **Do not execute candidates 004–006 against the
  owner's Neon `zoho_clone_synthetic` database.**
- Backend source-level tests use fictional organizations and identities.
- P4 preview `/app/organization/access` uses hardcoded fictional
  values and browser state only; no HTTP writes or real authorization.

### Required acceptance before deploying actual permissions

1. Approve OPEN-001/002/003, P1.06 role/field/record/department matrix,
   account mapping and P2.02 information architecture.
2. Prove a real non-owner **production or staging** DB role cannot read
   unrelated tenant records with forced RLS, through Prisma as well as SQL.
   Enforce SET LOCAL context only after verified actor + fresh active member;
   never trust a tenant ID, permission list or owner role from the browser.
3. Enforce explicit deny when identity/session/revision is stale or
   revoked; verify reliable cache invalidation or no-cache authorization,
   and document Auth0 JWT expiry/revocation behavior.
4. Review reserved roles/custom role assignment/auditing under real DB
   policies. Org owner may not automatically read every sensitive record;
   verify all row/field/export permissions.
5. Verify department manager only sees authorized teams, cross-org
   FKs and membership updates in a real transaction.
6. Deploy isolated staging with managed secrets, backup/restoration,
   logs/alerts, realistic sessions and real negative security tests,
   and run the relevant original P1.09 acceptance cases.
7. Obtain explicit owner approval. Original 14 risks, 12 unresolved
   decisions, 727 P1 cases and G-EXT/G-COM blockers remain OPEN.

### Mac handoff (deferred by owner)

No local pull is required now. When later switching to this development
branch (after safeguarding local modifications), run
`npm ci`, `npm run typecheck`, `npm run test`, `npm run build`.
Use `/app/organization/access` in the Next.js preview to inspect the
fictional matrix, team visibility and member-removal simulation.

## CI acceptance evidence

To be populated with the **latest verified final commit** after GitHub
Actions completes. Passing synthetic CI must not be represented as formal
P4.11–P4.15 acceptance or public commercial authorization.
