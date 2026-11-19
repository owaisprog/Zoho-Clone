# P4.06–P4.10 — Memberships, workspace switching, invitations, tenant context

**Engineering batch 02, 2026-11-20. Status: synthetic implementation and CI
candidate tests; NOT production tenant acceptance.**

Reference: owner's 2026-11-13 Express.js master roadmap, pages 32–33.
Builds on P4 batch 01 in draft PR #55, which itself targets **unmerged**
P3 development branch PR #53. No direct main/production merge is requested.

## Delivered

| ID | Source / implementation | Formal gate |
| --- | --- | --- |
| P4.06 Organization membership | `p4-membership.ts`: self-only active membership lookup; role is unique to each org, not global. Tests verify multi-org assignments and immediate revocation | Real GET/POST/PATCH memberships not mounted; verified Auth0-sub internal user mapping, roles and membership migration unapproved |
| P4.07 Organization switcher | `resolveSyntheticTenantContext` requires a fresh `(userId,orgId)` active record; no JWT role/slug trust. Fictional `/app/organization/memberships` browser selector | Real session or API context switching disabled; real org selector requires member-list endpoint |
| P4.08 Send/resend | `p4-invitations.ts` requires active OWNER, 256-bit random token hashed with SHA-256, strict synthetic recipient, 48h expiry, 60s resend delay, 3 resend cap, 5 send/hour candidate limit | No real invitation POST/resend endpoint, transactional email provider, quotas/rate-limit infra, audit service or provider-verified user mapping |
| P4.09 Accept/revoke | Same source-only service verifies matching provider-verified email, single-use token, atomic MEMBER-only creation/consume, owner-only revoke; expired/revoked/replayed tokens denied | No live acceptance endpoint, secure link exchange/email, token redemption authorization, real DB adapter, concurrency/load testing |
| P4.10 Tenant context middleware | `p4-tenant-context.ts` is test-mounted separately from normal Express app. It obtains trusted actor from injected verification adapter and re-checks server-stored active membership for requested UUID; static error envelopes on denial | Not mounted in production app. Real Auth0 and Prisma runtime, RLS transaction-scoped `SET LOCAL`, background-job propagation and P4.11 approval missing |

### Frontend (synthetic UX only)

`/app/organization/memberships` is a responsive interactive preview with
two fictional organizations, different roles and an example.com invitation
draft validator. The form **never calls a backend API, sends email, creates
a membership or stores a tenant context**. The workspace sidebar and settings
page link to the new screen. The existing demo workspace continues showing
public fictional data only.

### Backend service contracts and tests

- `backend/src/platform/p4-membership.ts`, `backend/test/p4-membership.test.ts`
- `backend/src/platform/p4-invitations.ts`, `backend/test/p4-invitations.test.ts`
- `backend/src/platform/p4-tenant-context.ts`, `backend/test/p4-tenant-context.test.ts`
- `frontend/src/lib/p4-membership-preview.ts`,
  `frontend/test/p4-membership-preview.test.ts`
- `backend/db/candidates/005_p4_synthetic_membership_invitations.sql`
  and `backend/db/tests/005_p4_synthetic_memberships_invitations.sql`.

GitHub CI applies the SQL only to ephemeral
`zoho_clone_synthetic_ci` PostgreSQL 17, using the existing P4.01–05
foundation schema before the new candidate. It explicitly switches to
`p4_synthetic_ci_runtime`, a non-owner/non-superuser/non-BYPASSRLS
role. Forced RLS restricts invitation rows to the authenticated actor's
matching tenant with current active OWNER membership. The pending invitation
unique index is `(org_id, recipient_email) WHERE status='pending'`.
Recipients have no general invitation SELECT permission; a future verified
token redemption service needs a narrower audited DB interface.

The SQL fixtures assert default deny, owner-only invitation creation,
duplicate prevention, role-elevation rejection, cross-org isolation, denial
for a non-owner, single-use conditional state updates, revoked-token state
and clearing transaction-local tenant context. This SQL tests the **data
contract**, not a live recipient redemption endpoint.

## Required security decisions before real endpoints

1. Owner review of OPEN-001/002/003 and P1.06 ACLs: opaque internal subject
   mapping, org-member authority, roles, field and record permissions.
2. Configure Auth0 production issuer, audience, MFA, token/session expiry,
   revocation, verified-email guarantees and invitation recipient binding.
3. Approval of separate non-owner **write** PostgreSQL role with enforced
   row/field restrictions; transaction-local tenant and actor context must
   come exclusively from server-verified user/session records. The current
   Neon `p3_neon_reader` must remain read-only.
4. Adopt audited transaction isolation, unique constraints, token redemption
   row locks and concurrency tests before sending real invitations.
5. Choose approved email provider, envelope/domain authentication, queue,
   delivery/retry rate limits, status/audit and abuse response. Do not
   embed invite tokens in metrics, analytics, response bodies or issue logs.
6. Validate two independent demo organizations, membership revocation and
   invitation cross-tenant negative paths under actual App/Auth0/Prisma
   integration. Run original P1.09 acceptance and security cases.

P3 staging/rollback and provider/region/secret gates remain blocked.
All previously open 14 risks, 12 decisions, 727 original P1 tests and
G-EXT/G-COM restrictions remain unchanged. No live merchant, user, payment,
identity, KYC, card or bank data may be processed.

## Optional later Mac handoff

When ready to fetch the feature branch (after preserving local changes):

```bash
npm ci
npm run typecheck
npm run test
npm run build
```

The new screen is at `http://localhost:3000/app/organization/memberships`
when the Next.js dev server is running. No Docker or Neon database writes
are required for the preview.

## CI evidence

CI job/run IDs and exact counts will be recorded after the final
GitHub Actions run completes. Do not infer passing CI from file creation.
