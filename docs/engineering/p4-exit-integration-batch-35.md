# P4 Batch 35 — Auth0 configuration consistency preflight

Date: 2026-11-24. Stacked on Batch 34. Five development subphases:

1. **Read-only, no-network identity preflight:** `scripts/p4-r35-auth0-preflight.mjs` checks fictional web/API Auth0 issuer and audience agreement, web client secret presence, cookie secret length, local-only web/backend origins, rejected public-secret environment names, and blocked live activation. Results return only fixed issue codes, never supplied credentials, issuer values or host addresses.
2. **Frontend Auth0 audience hardening:** `frontend/src/lib/auth0-config.ts` now requires the same bounded https/urn audience shape expected by the backend before creating an official Auth0 v4 web client. No fallback fake session.
3. **Backend runtime safeguards:** `backend/test/p4-r35-auth0-api-boundary.test.ts` exercises the existing real Express Auth0 issuer/audience reader and rejects nonlocal runtime profiles, invalid provider hosts and populated public-secret environment variables.
4. **Regression coverage:** frontend tests cover complete fake configuration, missing credentials and invalid audiences. Preflight test cases cover mismatch, public secret redaction, nonlocal endpoints and requested live activation.
5. **Mandatory GitHub verification:** CI runs `node scripts/p4-r35-auth0-preflight.mjs --ci` against fictional values and executes full frontend/backend/unit, PostgreSQL integration, source boundary, build and original acceptance inventory checks.

## Scope and release limits

This batch proves **configuration shape only**. No live Auth0 JWKS or token was fetched, no real client secret read, no third-party network authentication or user data verified, and no staging environment was provisioned. Existing real Auth0 API middleware remains identity-only; membership and business permissions are unchanged. This is a precondition for future owner-approved staging work, not an approval.

The normal Next.js app and backend server remain local-only, with no production invitation write route. Original 727 acceptance cases remain NOT_RUN_DOCUMENT_ONLY (0 executed); P4 decision NO_GO, all 10 release gates OPEN, original 14 risks and 12 decisions OPEN, R10-C1–C5 and P4 owner exit #61 unresolved. No `main` merge, staging/production deployment or Neon changes.
