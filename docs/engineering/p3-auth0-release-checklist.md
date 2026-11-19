# P3.13 Auth0 selection — local evidence and release acceptance boundary

**Selected:** Auth0 managed OIDC (owner approved 2026-11-17).
**Integration:** Next.js 16 official `@auth0/nextjs-auth0` 4.x
(authorization code + PKCE, hosted login, SDK-managed sessions)
and Express `express-oauth2-jwt-bearer` (RS256/JWKS, issuer/audience/expiry).
No custom passwords or self-signed JWT grants.

## Verified

- Owner reported local email/password Auth0 login to a Next.js authenticated
  session, valid Express identity-only acceptance, and post-logout denial
  on 2026-11-17. Google social login was explicitly deferred.
- `backend/test/p3-auth0-release-boundary.test.ts` adds negative
  issuer/configuration tests, forged bearer rejection, and a synthetic
  adapter check proving injected role/tenant claims do not get elevated.
- Endpoint `GET /api/v1/auth/check` returns
  `organizationAccess: false` on valid identity, not CRM authorization.
- All session tokens/tenant credentials stay in gitignored local files.

## Not accepted yet

- Auth0 tenant **region**, real plan **quota and cost**, MFA enforcement,
  account recovery, invitation policy, session expiration/refresh and
  explicit post-logout **bearer token revocation** were not verified.
- Evidence that Auth0 access-token revocation propagates immediately is
  **not** established by a browser logout test; JWT access tokens may
  remain valid until expiry. If instant revocation is required, design
  application-side session/token epoch checks, short expiry and
  independent policy tests before enabling business routes.
- Auth0 `sub` must map to an opaque internal user ID, and an active
  organization membership must be loaded from the database **per request**.
  Do not accept organization IDs or roles from client-selected JWT
  claims, query strings, headers, or untrusted callbacks.
- Invitations, MFA, recovery, CSRF, cookie attributes, key rotation,
  incident recovery, login rate limits, staging acceptance and future
  original P1 acceptance cases remain open.

## Owner decisions required before P4 live auth/tenancy

1. Confirm Auth0 subscription/region, allowed tenant URLs, production
   domain, MFA posture and monthly quota/budget.
2. Confirm refresh-token settings and desired revocation behavior.
3. Review and approve ADR 0003 and P1.06/P1.08 permissions contracts.

**Status:** Provider choice and local identity-only integration verified,
formal P3.13 acceptance PARTIAL. No live customer data.
