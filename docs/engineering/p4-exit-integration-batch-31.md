# P4 Batch 31 — End-to-end synthetic invitation issuance and redemption

Date: 2026-11-24. Stacked on Batch 30. Five development subphases. This work is deliberately restricted to **disposable GitHub CI PostgreSQL** and **in-memory fictional delivery**, not a live onboarding feature.

## Five implemented work items

1. **Issue a redeemable synthetic invitation using real PostgreSQL:** `backend/src/platform/p4-r31-ci-invitation-issuer.ts` validates a server-injected fictional, verified OWNER identity, current active owner membership, disposable database identity and exact `@example.com` recipient. It generates 32 random bytes, hashes for `p4_synthetic.invitations.token_hash`, and commits a pending record under `SET LOCAL ROLE p4_synthetic_ci_runtime`, with transaction-local actor/tenant and RLS. Partial unique pending invite constraint is retained.
2. **Memory-only fictional delivery:** `P4R31CiFixtureMailbox` holds the test token in instance-scoped memory only after the transaction commits. The token is **never included in HTTP responses, persisted in plaintext, sent via email, or exposed to the frontend**. A test-only `takeForFixtureTest` method simulates recipient pickup. If mailbox deposit fails after commit, the issuer attempts owner-authorized compensating revocation and returns a sanitized 503; this is **not a durable production transactional outbox**.
3. **Genuine end-to-end synthetic HTTP flow:** `backend/src/platform/p4-r31-ci-invitation-issue-router.ts` defines an unmounted CI-only owner issuance endpoint. `backend/src/scripts/p4-ci-r31-invitation-lifecycle-smoke.ts` exercises owner `POST issue` → private fixture mailbox → recipient R30 `POST accept` → atomic accepted invitation and active MEMBER membership in real disposable PostgreSQL. It verifies anonymous and foreign-owner denial, forged headers, wrong recipient, replay, revoked and expired invitations, duplicate issuance, four concurrent redemptions, delivery-failure compensation, safe output and pooled context cleanup.
4. **Safety and frontend compatibility:** seven backend issuer/mailbox unit tests, two normal-Express production-route denial tests, and three frontend schema compatibility tests. Existing future UI contracts accept only allowlisted metadata and minimal acceptance flags. The Batch 27 browser-memory UI remains **disconnected** because live Auth0 and scoped production privileges are not approved.
5. **Mandatory GitHub CI and release-gate preservation:** the existing `synthetic-postgres-isolation` job runs R31 after R30. No dependency additions, changes to production `app.ts`, Neon migrations or deployed services. Formal original P1.09 acceptance remains **0 of 727 executed** and release **NO_GO**, despite synthetic engineering test passes.

## Explicit limitations and follow-up

This is a **functional end-to-end test of issuance, synthetic delivery and acceptance**, not SMTP mail, a provider-authenticated user invitation, persistent token delivery, a transactionally durable outbox, or a publicly available tenant service. The raw token exists only inside the disposable fixture mailbox; a process restart would lose it. R29 legacy drafts still destroy their tokens and are not retroactively redeemable. The R30 `SECURITY DEFINER` function remains CI-only and unapproved for production.

Do not run CI-only functions against owner Neon, staging or production. Production requires a reviewed least-privilege redemption principal, signed Auth0 identity and email binding, durable encrypted outbox/provider delivery, anti-abuse/CSRF protection, audit evidence, reissue/recovery rules and owner approval.

Original 14 risks, 12 decisions, P4 exit #61, R10-C1–C5, 10 release gates, and original 727 unexecuted acceptance cases remain open. No main merge, real customer data, staging or production deployment.

Final CI status will be recorded in draft PR after GitHub Actions completes.
