# P4 Batch 38 — fictional renewal and member reactivation

Date: 2026-11-24. Stacked on Batch 37, draft development only.

## Five delivered subphases

1. Expired or revoked fictional invitations can be renewed for seven days, with a new in-tab invitation ID, immutable prior state, and no delivery or link.
2. Previously revoked fictional sales members are reactivated in place on valid acceptance; duplicate active or malformed membership records fail closed. Existing owner membership is never replaced.
3. Selected-organization, pending-duplicate, active-member, invitation-cap, timestamp, replay and one-time acceptance guards are preserved.
4. The existing Next.js workflow now displays an explicit renewal button and clearly states it is a browser-memory demonstration, not a real email or identity check.
5. Eleven new frontend behavior tests and a required CI source-boundary check protect these rules; the existing R37 no-network/no-storage guard remains mandatory.

## Non-release constraints

This is a functional local UI state model, not the CI-only PostgreSQL invitation service or a live Auth0 onboarding API. No SMTP provider, managed KMS, production Neon database, session validation or credential exposure is added. GitHub CI evidence should be recorded before declaring this batch verified. Original P1.09 cases: 727 documented / 0 executed, 38 partial technical links. Phase 4 NO_GO; all 10 gates, 14 original risks, 12 decisions, R10-C1–C5 and P4 owner exit #61 remain OPEN. Do not merge or deploy.
