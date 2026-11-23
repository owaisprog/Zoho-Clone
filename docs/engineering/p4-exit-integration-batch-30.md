# P4 Batch 30 — recipient-bound invitation acceptance and member activation

Date: 2026-11-24. Stacked on Batch 29, synthetic-only GitHub CI. This delivers an actual transactional acceptance proof, **not** a live invitation-delivery or publicly accessible API.

## Five development subphases

1. **Atomic SQL acceptance and activation:** `backend/db/candidates/023_p4_r30_ci_invitation_redemption.sql` creates a narrowly granted, CI-only `p4_r30_ci.redeem_fictional_invitation` database function. It locks the invitation, matches SHA-256 token hash to an unexpired pending record and matches the actor to a **database-verified canonical recipient email**; changes invitation to accepted, increments version and inserts an active MEMBER row in the same transaction. Replayed, expired, revoked, wrong-email and already-member inputs fail. The function is a privileged CI **SECURITY DEFINER** exception to the existing owner-only RLS write policy; it is **not a production privilege design**.
2. **Backend transactional service:** `backend/src/platform/p4-r30-ci-invitation-acceptance.ts` verifies that environment is the exact disposable CI PostgreSQL fixture, checks trusted fictional injected actor and strict token shape, hashes token client-side before passing bound hash to SQL, executes with `SET LOCAL ROLE p4_synthetic_ci_runtime`, commits only after success, and sanitizes all errors.
3. **Unregistered Express route and real acceptance smoke:** `backend/src/platform/p4-r30-ci-invitation-accept-router.ts` defines a CI-only `POST /_p4_r30_ci/accept` not mounted by `app.ts` or `server.ts`. The disposable PostgreSQL + Supertest script `backend/src/scripts/p4-ci-r30-invite-redemption-smoke.ts` verifies recipient/email matching, successful atomic membership creation, replay denial, expired and revoked denial, four concurrent redemptions with one winner, zero credential reflection and clean pooled context.
4. **Regression and safe frontend integration boundary:** six backend input/environment/identity tests, two normal-app denial tests, and four frontend response-schema tests. `frontend/src/lib/p4-invitation-acceptance-contract.ts` validates a minimal success response but deliberately does **not** perform any network request or expose an acceptance form to real users.
5. **GitHub CI and truthful acceptance status:** CI installs the disposable function after the existing P4 R29 integrations and runs the real R30 smoke. The original 727 P1.09 acceptance cases remain formally `NOT_RUN_DOCUMENT_ONLY` (0 executed). Prior 38 partial evidence links are unchanged; the formal decision remains `NO_GO`.

## Critical limitations

The R29 invitation-creation service intentionally destroys its raw token, so **R29 drafts cannot be redeemed**. For R30 integration tests only, the test fixture creates random tokens and corresponding hashes without sending anything externally. Live secure issuance, token delivery, cryptographic Auth0/JWKS verification, CSRF protections, replay observability, service-account separation, least-privilege production database roles, member onboarding, emails, notifications and audited retention require further owner/security approval.

The CI `SECURITY DEFINER` function uses the disposable database bootstrap owner and is deliberately a privileged exception. **Never run or copy this function to owner Neon, staging, or production**; a production redemption role and rigorously reviewed policy are still required.

There has been no `main` merge, customer-data activation, Neon migration, staging or production deployment. P4 exit #61, R10-C1–C5, all 10 release gates, original 14 risks, 12 decisions and original unexecuted acceptance cases remain open.

CI results to be recorded in PR only after verified GitHub Actions completion.
