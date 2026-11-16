# P3.13 — Auth0 owner setup and integration verification

**Owner decision (2026-11-17):** Auth0 is the selected OIDC provider.
**Implementation:** Next.js 16 v4 SDK for server-managed web sessions; Express
API uses stable `express-oauth2-jwt-bearer` for a restricted, **identity-only**
JWT access-token check. There is NO production CRM authorization, real user
mapping, org membership/tenant invitation, or approved customer-data release.

## Auth0 dashboard setup (owner action — do not put secrets in GitHub)

1. Create a **development tenant** in the Auth0 Dashboard. Confirm region,
   privacy terms, cost cap, connection policy and test-user policy.
2. **Applications → Applications → Create Application**:
   `Zoho Clone Development`; select **Regular Web Application**.
3. **Applications → APIs → Create API**:
   `Zoho Clone API`, Identifier `https://api.zoho-clone.local`,
   signing algorithm RS256. Use this identifier as `AUTH0_AUDIENCE`
   in both processes. It is only an API audience, not a deployable URL.
4. Configure the web application **Allowed Callback URLs**:
   `http://localhost:3000/auth/callback`.
   **Allowed Logout URLs**: `http://localhost:3000`.
   **Allowed Web Origins**: `http://localhost:3000`.
   These are exact LOCAL URLs. Add the separately approved HTTPS staging
   callback/logout/origin only when the real staging domain is assigned.
5. Ensure the application is enabled for the desired test login connection.
   For multi-organization SaaS, discuss Auth0 Organizations, enterprise
   connections, invite-only onboarding and MFA/recovery before external use.
   Do not enable public self-service signup as access to real CRM data.

## Server-side configuration (local only)

Copy `frontend/.env.auth0.example` to `frontend/.env.local` and fill
secrets from your Auth0 tenant's Application Settings. Generate
`AUTH0_SECRET` using `openssl rand -hex 32` locally.
Use no NEXT_PUBLIC_ prefix for any secret. The frontend environment needs:
`AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, `AUTH0_SECRET`,
`AUTH0_AUDIENCE`, `APP_BASE_URL`, and local `API_INTERNAL_URL`.

For backend local development, create `backend/.env.local` with
`AUTH0_DOMAIN=<same-tenant-domain>`,
`AUTH0_AUDIENCE=https://api.zoho-clone.local`,
`HOST=127.0.0.1`, `PORT=4000`.
**Note:** the existing backend server does not automatically read .env
files; start it with environment variables from your own local shell
or secret manager, for example
`node --env-file=backend/.env.local backend/dist/server.js`
after `npm run build`. Do not commit populated .env files.
For the Next.js dev process, `frontend/.env.local` is loaded by Next.

## Local smoke (once owner tenant is configured)

- `npm ci`; `npm run typecheck`; `npm test`; `npm run build`.
- Terminal A: `npm run dev:api` after securely exporting backend auth env.
- Terminal B: `npm run dev:web` (with private frontend/.env.local).
- Visit `http://localhost:3000/identity`. Expected:
  unauthenticated -> Auth0 Universal Login -> authenticated
  identity-only confirmation; logout returns to local app.
- Test `http://localhost:3000/api/identity/check` from the signed-in
  browser. The **Next.js server** retrieves and forwards its Auth0 API
  access token to local Express. It returns identity-only 200 if verified.
  It must return 401 for no session/invalid JWT, or 503 for missing config/
  unavailable backend. Browser must not receive bearer token or session
  secrets. The SDK client access-token endpoint is explicitly disabled.
- Check wrong issuer/audience, expired token, missing bearer and invalid
  signature using the test suite and owner-controlled local tests.
  Verify live login, logout and token refresh/revocation separately.

## Security boundaries (not yet completed)

- Existing `/app` is a **public fictional prototype**. It is NOT protected
  by Auth0 and does not grant access to sensitive records. The new
  `/identity` page is session-gated and does NOT expose CRM.
- The existing P3.21 `user_demo_*` identity seam remains disconnected,
  test-only. Do NOT map Auth0 `sub` straight to a demo actor.
- Auth0 `org_id`, email, user ID, roles or scopes MUST NOT grant tenancy.
  P4 must bind the verified subject to server-side active membership, record
  and field rights with cross-tenant negative tests.
- API only verifies **access tokens**, with correct audience/JWKS signature,
  issuer, RS256 and expiry. ID tokens are not suitable for API authorization.
- SDK handles OIDC state, nonce, PKCE and session cookies. Add MFA,
  invitation/claim lifecycle, abuse controls, CSRF/write flows, session
  revocation and backchannel logout testing before real data.
- Publish NO domain secrets, client secrets, session keys, real user IDs,
  tokens, webhooks, logs with credentials, or personal data to this public repo.

## Acceptance ledger

- [x] Owner selected Auth0 and the choice is documented.
- [x] Integration source, configuration gating and negative tests authored.
- [ ] Dependencies and lockfile installed, CI all green.
- [ ] Owner created Auth0 tenant + Regular Web App + API and saved URLs.
- [ ] Secure environment values configured outside GitHub.
- [ ] Real Auth0 login, refresh, logout and Express JWT validation demonstrated.
- [ ] MFA/invitations, membership mapping, revocation and security signoff.
- [ ] Final P3 owner gate approval.

See `docs/adr/0003-managed-identity.md`, P3 official ledger, and issue #54.
