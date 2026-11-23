# P4 Batch 33 — signed fictional identity and scoped database actor binding

Date: 2026-11-24. Five development subphases, stacked on green Batch 32.

1. **Cryptographic verification**: new `backend/src/platform/p4-r33-ci-jwt-verifier.ts` uses Node RSA RS256 signature verification against an in-memory pinned fictional JWK, enforcing exact issuer, audience, strict alg/kid/typ, one signed provider subject, email_verified=true, bounded exp/iat/nbf and controlled token size. It does **not** fetch or use Auth0's live JWKS and does not implement production key rotation.
2. **Signed-subject-to-internal-actor mapping**: `backend/src/platform/p4-r33-ci-verified-workflow.ts` requires a Bearer token and verifies its cryptographic signature before reading the existing disposable PostgreSQL identity_subjects mapping, rejecting missing or unverified email. No HTTP x-role, x-tenant, email or x-user-id header can supply authorization. This CI bootstrap mapping **is not** a reviewed production credential design.
3. **Working signed HTTP entrypoint**: an *unmounted* CI-only Express router requires a signed fictional owner token before issuing R32 outbox invitations, and a signed fictional recipient token before R30 acceptance, preserving active-owner and verified-recipient DB checks. Existing normal Express app remains unchanged.
4. **Actual disposable Postgres end-to-end smoke and attack cases**: dynamic in-memory RSA key pair and tokens; forged signature, bad audience/issuer, absent token, non-owner denial, signed owner issuance, queued delivery, signed recipient activation, replay denial, rejected stale email verification and sanitized output. Eight JWT tests, three actor resolver tests, and two production-route-denial tests.
5. **Mandatory GitHub CI and formal gate preservation**: CI runs the integrated signed-token/Postgres/HTTP smoke after R32 and keeps existing build, security, database isolation and 727-case inventory checks.

**Limitations:** This uses a *fictional pinned JWKS* generated for CI only, not Auth0-issued tokens, Auth0 SDK/JWKS discovery, live audience configuration, live session cookies, real email verification or staging acceptance. The mapping uses a privileged disposable PostgreSQL setup connection (not a production identity-read service role). Frontend APIs remain disabled and nothing is deployed.

Original acceptance inventory: 727 documented original cases, 0 formally executed, decision NO_GO. 10 P4 release gates, original 14 risks, 12 decisions, R10-C1–C5 and owner P4 exit #61 all remain open. No merge into main, Neon changes, staging/production deployment, live customer data or paid cloud.

CI verification only from the final GitHub Actions run.
