# ADR 0003 — Managed OIDC instead of custom passwords

Status: **AUTH0 VENDOR SELECTED BY OWNER — INTEGRATION AND RELEASE EVIDENCE PENDING** — 2026-11-17
Source: master PDF P3.13 / P4.01–P4.03.

The product owner explicitly selected **Auth0** for P3.13 on 2026-11-17.
For the Next.js application use the official `@auth0/nextjs-auth0` 4.x SDK
(Next.js 16 `proxy.ts`). For the Express API use stable `express-oauth2-jwt-bearer`
with strict RS256/JWKS issuer/audience/expiry verification. The newer Auth0
Express API SDK is still presented as beta in npm and is not selected for
this baseline. Backend bearer access tokens are NOT ID tokens.

Auth0 account/tenant details, geographic region, pricing limits, MFA policy,
invitation restrictions and operational recovery still require owner review.
The choice of provider does not close OPEN-001 until live integration and
acceptance evidence are verified.

Contract:
- Authorization Code + PKCE; server-verified tokens via rotating JWKS,
  issuer, audience, signature, expiry, nonce/state as appropriate.
- HTTP-only, Secure, SameSite cookies; CSRF controls on state-changing
  routes; session rotation, logout and immediate revoke semantics.
- Distinguish global identity subject from organization membership.
- Invitation expiry/single-use, privileged MFA, threat/event auditing.
- Deny everything on provider outage, invalid token or missing scope.

Source now contains an opt-in **Auth0 identity-only** login/session integration
for Next.js, and an Auth0 bearer-token JWT check for Express, plus negative
configuration tests. No owner tenant, real keys, live sign-in, session revocation,
organization policy or secure CRM data access is yet connected/verified.
The existing injected synthetic identity seam remains test-only and must not
be treated as a true Auth0 user mapping.


## Architecture v1.0 confirmation (2026-11-20)
The owner expressly reaffirmed **Auth0**, plus independent active organization membership, entitlement, RBAC, ABAC and RLS boundaries. This **does not** signify real Auth0 session/MFA/revocation acceptance or final permission matrix approval. OPEN-001/OPEN-003 remain open. [ADR 0007](0007-architecture-v1-owner-approval.md).


## Isolated subject-to-UUID integration (2026-11-20)
A new CI-only role/function and `p4-v1-ci-identity.ts` now map a **test-injected** already-verified Auth0 issuer+subject shape to internal UUIDv4, independently of tenant app authorization. The test-only Express router requires fresh Prisma membership, enabled app grant and role permissions before reading. [Actions #44751975773](https://github.com/owaisprog/Zoho-Clone/actions/runs/44751975773) passed 244 tests/4 jobs. **No real Auth0 signature, MFA/recovery, access-token revocation, or true live account mapping verified by these tests.** No login credentials were configured; do not mount the test router in production. OPEN-001 and P4 external security gates remain OPEN.
