# P4 Batch 29 — persisted invitation draft backend transactions

Date: 2026-11-23. Stacked on verified Batch 28. Feature implementation with disposable PostgreSQL, but not live invitation sending or Auth0 login.

## Five deliverables

1. **Transactional create and expiry rollover:** `backend/src/platform/p4-r29-ci-invitation-service.ts` uses existing `p4_synthetic.invitations` and partial unique pending-per-recipient index, non-owner `p4_synthetic_ci_runtime` under `SET LOCAL ROLE`, transaction-local actor/tenant settings and a freshly queried, active OWNER membership plus verified fictional identity. Existing expired pending invitation is changed to `expired` in the same transaction before replacement; concurrent duplicate pending inserts rely on the DB unique index. A random 256-bit value is hashed with SHA-256 to store `token_hash`, but **the token is intentionally destroyed, not sent or returned**. This is an undelivered draft, not a redeemable real invitation.
2. **Scoped read + revocation:** owner-only, safe allowlisted list (bounded 20) and `UPDATE ... WHERE status='pending'` compare-and-set revocation, preserving terminal state and increasing version. No DELETE, email delivery, membership mutation, export or token consumption. No foreign-tenant or anonymous read.
3. **Express CI-only HTTP adapters:** `backend/src/platform/p4-r29-ci-invitation-router.ts` exposes `POST /_p4_r29_ci/:orgId/invitations`, `GET /_p4_r29_ci/:orgId/invitations`, `POST /_p4_r29_ci/:orgId/invitations/:inviteId/revoke` **only when explicitly mounted in disposable CI test harness**. Actor comes from injected trusted fictional resolver, never HTTP role/user headers. Production `app.ts` / `server.ts` remain unmodified and the router constructor fails closed outside CI.
4. **Actual HTTP/database tests:** `backend/src/scripts/p4-ci-r29-persisted-invite-smoke.ts` verifies PostgreSQL persistence, token hash absent from responses, invalid body, anonymous/foreign denial, duplicate pending conflict, versioned revoke, replacement after revoke and expiry, foreign-org denial and pooled transaction context cleanup. Six backend input/identity/environment tests cover negative paths. Four frontend contract tests validate strict recipient/status/time projection and the deliberate absence of a real network connection.
5. **Mandatory CI and frontend integration preparation:** GitHub Actions `synthetic-postgres-isolation` runs the new integration smoke after prior disposable schemas. The frontend `p4-invitation-api-contract.ts` validates safe response shape for future approved connection; it **does not fetch or mount anything**, so Batch 27's browser demo remains separate until actual authenticated backend service and RLS credentials are approved.

## Formal gates unchanged

The original 727 P1.09 cases remain `NOT_RUN_DOCUMENT_ONLY`, 0 formally executed; the prior 38 partial technical evidence links are not product acceptance. No real Auth0/JWKS/MFA, live invitation delivery/redemption, customer data, owner Neon writes, `main` merge, staging or production deployment. P4 owner exit #61, R10-C1–C5 and all ten release gate categories remain OPEN. The implementation must not be interpreted as an invitation service ready for real users.

CI status to be recorded after GitHub Actions verification.
