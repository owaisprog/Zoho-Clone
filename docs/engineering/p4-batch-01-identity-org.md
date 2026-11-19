# P4.01–P4.05: Identity, global profile and organization foundation

**Status: code/contracts + fictional UI + disposable CI security tests in review;
NOT ACCEPTED as working tenant provisioning.**

This work is based on the owner's 2026-11-13 Express.js master roadmap
(P4.01–P4.05, pages 30–32). It builds upon the unmerged P3 development branch.
The work deliberately remains on a separate feature branch and draft PR.
P3 acceptance remains conditional; no P4 production, staging, database write
permissions, real end-customer data, or paid services are authorized.

## Scope and shipped source

| ID | Source and behavior | Status / not yet proven |
| --- | --- | --- |
| P4.01 Registration | `/account` uses existing hosted Auth0 login; `p4-identity-policy.ts` validates a verified subject, issuer, expiry and email; no account merge by email; CI-only `p4_synthetic.identity_subjects` unique (issuer,subject) | No live registration audit, duplicate/expired invitation journey, Auth0 email verification acceptance or real user persistence |
| P4.02 Login and logout | Auth0 v4 existing SDK and `/auth/login` / `/auth/logout`; new `GET /api/account/session` returns safe state only (never token or email), no-store | No revoked access-token acceptance or real /me backend endpoint; browser logout alone does not revoke JWT |
| P4.03 MFA / recovery | New policy rejects missing/stale/revoked MFA evidence, `/account` explains hosted Auth0 recovery | No Auth0 MFA provider hook or challenge configured; policy NOT wired to privileged API; no claim of recovery security acceptance |
| P4.04 Global user profile | `p4-global-profile.ts` self-only synthetic CRUD contract validates name, locale and time zone, excludes org/actor changes; CI candidate DB `global_profiles` keyed by user | No real authenticated GET/PATCH /me, persistent database writes, avatar or per-org verification |
| P4.05 Create organization | `/app/organization/new` responsive **fictional preview only**; `p4-organization-provisioning.ts` requires synthetic verified actor, atomic repository transaction, unique slug claim and server-assigned owner. CI candidate DB enforces unique slug, forced RLS, owner-only behavior and rollback | Real POST /organizations DISABLED; no approved Auth0-to-user mapping, production tenancy model, writing role, CRM/billing integration or live onboarding |

## Source boundaries

- **Frontend identity status:** `frontend/src/app/account/page.tsx`,
  `frontend/src/app/api/account/session/route.ts`, and
  `frontend/src/lib/p4-account-view.ts`.
- **Fictional org UI:** `frontend/src/app/app/organization/new/page.tsx`,
  `frontend/src/components/p4-organization-wizard-preview.tsx`,
  `frontend/src/lib/p4-organization-preview.ts`.
- **Express-side future contracts:** `backend/src/platform/p4-identity-policy.ts`,
  `p4-global-profile.ts`, `p4-organization-provisioning.ts`. None are
  mounted as live tenant routes.
- **Candidate SQL:** `backend/db/candidates/004_p4_synthetic_identity_foundation.sql`
  with `backend/db/tests/004_p4_synthetic_identity_foundation.sql`.
  The schema hard-blocks any database except `zoho_clone_synthetic_ci`
  and is run only by an isolated ephemeral PostgreSQL 17 CI job.
- **DO NOT APPLY this candidate to Neon** `zoho_clone_synthetic`; do
  not weaken `p3_neon_reader` or reuse it to write organization data.
  Real migrations and RLS require owner-approved OPEN-001/002/003
  and real Auth0-sub-to-internal-user mappings.

## Critical security requirements for later P4

1. Map provider `(issuer,sub)` to an immutable internal user; `email`
   alone is NOT a unique identity or valid tenant-grant proof.
2. Backend verifies provider signatures, audience, expiry, session revocation,
   MFA, and fresh active membership before a business request.
3. Organization creation uses a DB uniqueness constraint on slug and
   transactions for organization + owner membership, with rollback on error;
   never accept caller-supplied role, owner ID, or organization ID.
4. Real PostgreSQL role must not own tables or bypass RLS; enforce
   field/record access and transaction-local verified tenant context.
5. Account recovery **must not** elevate organization permissions or
   recreate revoked sessions.
6. Run original P1.09 acceptance cases including cross-tenant negative
   tests and two isolated fictional organizations before approval.

## What the owner can preview after a later safe Git pull

From the P4 feature branch **only after preserving any local changes**:

```bash
npm ci
npm run typecheck
npm run test
npm run build
```

Start the backend and frontend using their existing npm scripts.
Open `http://localhost:3000/account` for real hosted Auth0 account
status if already configured, `http://localhost:3000/api/account/session`
for no-store identity state, and
`http://localhost:3000/app/organization/new` for a strictly fictional
organization name/slug validation screen.

No live tenant database is accessed by those UI routes. The org wizard
never sends a backend request. No local Docker is required on the Mac.

## Approval and release gates

All original P0/P1/P2/P3 unresolved conditions remain open. The P4 phase
exit requires two **isolated** demo companies with genuine identity, team,
access, file, and audit flows; this batch does not provide those. Do not
merge to `main` or turn on public authorization/write paths.
