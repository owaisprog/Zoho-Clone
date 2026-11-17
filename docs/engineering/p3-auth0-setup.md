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
   `Zoho Clone API`, actual owner-chosen Identifier `https://zoho-clone.vercel.app`,
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
`AUTH0_AUDIENCE=https://zoho-clone.vercel.app`,
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

## Troubleshooting local backend_unavailable (2026-11-17)

User reports working Auth0 browser session; `GET /api/identity/check`
returns `backend_unavailable`. The Next.js handler intentionally maps
multiple upstream/SDK failures to this same safe response, so **do not
assume an invalid token** until the server process is checked.

1. In another local terminal run `curl -i http://127.0.0.1:4000/health/live`.
   Expected `200` with `status: alive`. Connection refused = backend not
   running or on wrong port.
2. From repo root run `npm run build -w backend` then
   `node --env-file=backend/.env.local backend/dist/server.js`.
   `npm run dev:api` alone does **not** load backend/.env.local.
3. Run `curl -i http://127.0.0.1:4000/api/v1/auth/check` WITHOUT
   a token. Expected `401` / `UNAUTHENTICATED` if backend Auth0
   configuration is present. A `503` / `AUTH_NOT_CONFIGURED` means
   AUTH0_DOMAIN or AUTH0_AUDIENCE is missing/invalid in the backend
   runtime. A `404` means stale API source/process.
4. Make sure `frontend/.env.local` sets
   `API_INTERNAL_URL=http://127.0.0.1:4000` and both frontend and
   backend use the same tenant and exact Auth0 API Identifier
   `https://zoho-clone.vercel.app` (as chosen by owner).
5. For direct network connectivity, test from the **same terminal/environment** as the Next.js server:
   `node -e "fetch(\'http://127.0.0.1:4000/health/live\').then(async r=>console.log(r.status,await r.text())).catch(()=>console.log(\'FETCH_FAILED\'))"`.
   This only checks the unauthenticated health endpoint; a successful result does not prove signed JWT validation.
   Restart both servers. If the user changed their API audience since
   login, log out and log back in to request a new correctly-audienced
   token. Auth0 v4 `getAccessToken()` is invoked server-side by the BFF.
6. **Verified owner evidence 2026-11-17:** `/health/live` returned 200
   `alive` and `/api/v1/auth/check` returned 401 `UNAUTHENTICATED`
   without a token. The backend is running and its authentication guard is
   behaving correctly. This does **not** yet prove Next.js can forward a JWT.
7. After pulling the PR branch and restarting the Next.js server, re-open
   `http://localhost:3000/api/identity/check` while signed in. The JSON now
   includes a **development-only fixed diagnostic code** when the response
   remains `backend_unavailable`. The codes mean:

   | Diagnostic | Next action |
   | --- | --- |
   | `LOCAL_API_URL_REJECTED` | Correct `API_INTERNAL_URL` in `frontend/.env.local`; restart Next |
   | `AUTH0_ACCESS_TOKEN_MISSING` | Log out and back in; check audience is set during Auth0 login |
   | `AUTH0_TOKEN_REQUEST_FAILED` | Check Auth0 server-side token retrieval, SDK session and Refresh Token settings; never print tokens |
   | `API_CONNECTION_FAILED` | Confirm Express is reachable **from the Next.js server process**, not just your browser |
   | `API_REQUEST_TIMED_OUT` | The authenticated API request exceeded 12 seconds; check Auth0 JWKS outbound connectivity and backend logs, without printing tokens |
   | `BACKEND_AUTH_NOT_READY` | Check Express Auth0 environment and ensure it was loaded at process startup |
   | `BACKEND_UNEXPECTED_STATUS` | Confirm Express version/route, inspect status safely without printing authorization headers |

   In production, all these cases still return only `backend_unavailable`
   without a diagnostic field. If API responds 401 with an access token,
   the BFF returns `unauthenticated`, which may mean expired/wrong-audience
   or otherwise rejected token. Log out and back in if the API audience
   was changed. Do **not** share raw tokens, cookies, OAuth codes, or the
   full callback URL.

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
- Google social login currently fails with Google `invalid_client` in user testing; **defer it** while validating the Auth0 database connection. No Google OAuth secret or client ID is required for the database flow.
- Publish NO domain secrets, client secrets, session keys, real user IDs,
  tokens, webhooks, logs with credentials, or personal data to this public repo.

## Acceptance ledger

- [x] Owner selected Auth0 and the choice is documented.
- [x] Integration source, configuration gating and negative tests authored.
- [x] Dependencies and lockfile synchronized; **86 P3 scaffold/foundation tests passed**, and all four CI jobs green in [GitHub Actions run #43951293062](https://github.com/owaisprog/Zoho-Clone/actions/runs/43951293062). These are not live Auth0 sign-in or original P1 acceptance tests.
- [x] Owner configured an Auth0 development application and API: Auth0 Universal Login was reached; user reported that email/password sign-up works (2026-11-17). **This is user-reported setup progress, not a verified successful server session or JWT check.**
- [ ] Secure local environment values validated on both frontend and backend. The frontend reached Universal Login; backend configuration remains unverified.
- [x] User reported `/identity` displaying **Authenticated session** after Auth0 email/password signup and sign-in on 2026-11-17; browser login/session works in local development (owner-reported verification; no server CI integration with owner tenant).
- [ ] Local `/api/identity/check` currently returns `{"status":"backend_unavailable"}` in owner testing (2026-11-17): the Next.js-to-Express or server token retrieval path is not yet verified. Check backend `/health/live`, missing Auth0 backend environment, local API URL, and access token retrieval. Refresh/logout remain unverified.
- [ ] MFA/invitations, membership mapping, revocation and security signoff.
- [ ] Final P3 owner gate approval.

See `docs/adr/0003-managed-identity.md`, P3 official ledger, and issue #54.
