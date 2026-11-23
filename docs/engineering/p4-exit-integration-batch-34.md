# P4 Batch 34 — frontend-to-backend functional acceptance rehearsal

Date: 2026-11-24. Five development subphases stacked on green Batch 33.

1. **Working typed frontend HTTP client** (`frontend/src/lib/p4-r34-ci-http-client.ts`): real localhost `fetch` with injected short-lived fictional signed JWTs, explicit owner/recipient roles used only to choose test credentials, fixed R33 API endpoints, strict allowlisted response contract, no-store/nosniff checks, automatic timeout and sanitized denial. The client refuses any host other than 127.0.0.1, any path/query/userinfo, non-CI runtime or NODE_ENV=production.
2. **Actual frontend interaction controller** (`frontend/src/lib/p4-r34-ci-workflow-controller.ts`): immutable state transitions reflecting API-issued invitations, actual acceptance, denial and reset. Tokens and signed JWTs are not held in state, logs, localStorage or browser storage.
3. **Eight frontend tests** verify valid issuing/acceptance, strict safe JSON, invalid input, denied 401/403/409, network failures, forbidden production endpoints and state minimization.
4. **Full-stack real HTTP smoke** (`scripts/p4-r34-fullstack-smoke.ts`): creates a temporary loopback-only Express server in GitHub CI, pins a generated RS256 JWK, uses real `fetch` through the frontend client, and verifies an owner-created invitation, PostgreSQL encrypted outbox, private fixture delivery, signed recipient acceptance, one active MEMBER and replay/wrong-recipient/foreign-org/forged-token denial.
5. **CI and formal acceptance gate**: `synthetic-postgres-isolation` now requires the full-stack smoke following R32 and R33. Original 727 P1.09 cases remain formally NOT_RUN_DOCUMENT_ONLY. The selected CI cases here are an **engineering acceptance rehearsal**, not actual staging UAT or an owner-approved original-case pass.

## Constraints and next steps

The Next.js product page intentionally remains a **browser-memory sandbox**. The R34 HTTP client is used only by CI tests, not imported by the Next.js app or mounted in the backend production source graph. A real usable account workflow needs live Auth0 authentication + validated JWKS/issuer/audience, least-privilege production SQL, durable KMS-managed outbox and provider email sending, anti-abuse/CSRF, correct session/cookie semantics, staging deployment and owner acceptance. We have intentionally not initiated those external or irreversible changes.

Original P1.09 formal cases = 727, executed = 0. Formal P4 decision NO_GO. Original 14 risks, 12 decisions, R10-C1–C5, all ten release gates and P4 exit issue #61 are still OPEN. No main merge, Neon migrations, real customer data, production/staging deployment or paid cloud.

CI result will be copied from observed GitHub Actions into draft PR.
