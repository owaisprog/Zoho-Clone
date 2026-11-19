# P3.07 — Environment configuration and secret-handling boundary

Status: **IMPLEMENTED LOCAL-ONLY SAFEGUARDS / PARTIAL OFFICIAL GATE**.
This document does not approve a staging or production deployment.

## Deployment boundary

The default Express entrypoint `backend/src/server.ts` is for loopback
synthetic previews only. `readServerConfig` restricts HOST to
`127.0.0.1` / `localhost`; `assertApprovedBackendRuntimeEnvironment`
rejects `P3_APP_ENV` except `local` (default) or `ci`. Any future
`staging` or `production` profile needs a separate owner-reviewed
network, identity, secrets and tenancy architecture before it can be enabled.
`NODE_ENV=production` used by a local optimized runtime does NOT grant
external readiness.

If `AUTH0_DOMAIN` or `AUTH0_AUDIENCE` is present in the Express runtime,
both must form a valid trusted configuration or process startup fails closed
with a **fixed error code**. The existing Auth0 token endpoint remains
identity-only, with `organizationAccess:false`.

The Next.js build refuses nonempty secret-like `NEXT_PUBLIC_*` variables,
because those variables can be embedded in browser-delivered bundles.
The build guard **cannot undo** a previously built/leaked artifact:
immediately revoke/rotate any secret accidentally exposed.

## Environment ownership and current variables

| Scope | Local environment file | Variables | Usage |
| --- | --- | --- | --- |
| Express loopback | `backend/.env.example` (copy to a gitignored local file if needed) | `HOST`, `PORT`, `P3_APP_ENV` (`local` or `ci`), optional `AUTH0_DOMAIN`, `AUTH0_AUDIENCE` | localhost synthetic server, Auth0 JWT issuer/audience only |
| Next.js | `frontend/.env.auth0.example` → `frontend/.env.local` | `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, `AUTH0_SECRET`, `AUTH0_AUDIENCE`, `APP_BASE_URL`, `API_INTERNAL_URL` | Auth0 SDK and local server-to-server identity-only API |
| Neon smoke **only** | `backend/.env.neon.example` → `backend/.env.neon.local` | `DATABASE_URL` for scoped `p3_neon_reader` | private, TLS verified, synthetic read-only Prisma CLI; **not wired into Express runtime** |
| Disposable test infrastructure | `backend/.env.p3.runtime.example` | local fake Docker role/password | isolated CI and optional local Docker, **not a Neon credential** |
| Redis/BullMQ | not provisioned for live runtime | future secrets TBD | no production worker connection or credential |

For the owner-confirmed Neon PASS:
`npm run smoke:synthetic-neon -w backend` exercised a restricted synthetic
role. Neon project:
[zoho-clone-development](https://console.neon.tech/app/projects/small-river-48696124),
branch `development`, database `zoho_clone_synthetic`. Other same-name
projects in disconnected accounts must not be reused by inference.

Do not store, print, paste, or commit `.env.local` values, Postgres URLs,
Auth0 client secrets, session keys, JWTs, IAM credentials or API tokens.
The source-controlled `.env.*.example` files contain placeholders only.
Never put `AUTH0_CLIENT_SECRET`, `AUTH0_SECRET`, `DATABASE_URL` or
similar names behind `NEXT_PUBLIC_`.

## Safe automated checks (P3.07)

- `backend/src/runtime-env.ts` is called at **actual API process startup**,
  rejecting unapproved deployment profiles, invalid partial Auth0 and
  nonempty `NEXT_PUBLIC_` secret-looking variables.
- `frontend/next.config.ts` checks `frontend/src/lib/public-env-boundary.ts`
  before a Next.js build can publicly inline sensitive environment values.
- `scripts/check-tracked-artifacts.sh` refuses tracked real `.env` files
  and generated artifacts.
- `scripts/check-tracked-secrets.mjs` inspects Git-tracked text files for
  selected private key markers, API-token formats, AWS access keys and
  non-placeholder embedded Neon connection credentials. A finding prints
  only the path and fixed rule label, **not the secret**. Node-only negative
  tests are in `scripts/check-tracked-secrets.test.mjs`.
- GitHub Actions `.github/workflows/p3-scaffold.yml` enforces these
  alongside TypeScript tests, builds, synthetic Postgres isolation and the
  existing critical-severity production dependency audit.

Useful local commands (run from project root):

```bash
node --test scripts/check-tracked-secrets.test.mjs
node scripts/check-tracked-secrets.mjs
bash scripts/check-tracked-artifacts.sh
npm run typecheck
npm run test
npm run build
```

**Limits:** Regex-based source scanning is not comprehensive. It does not
examine deleted Git history, secrets in external build logs, deployed
client bundles, unmanaged cloud environments, or untracked local files.
Enable GitHub secret scanning and push protection where supported, plus
professional scanners and manual audit, before release.

## Incident handling and future staging

If a real secret is pushed or otherwise exposed: **revoke/rotate it at the
provider first**, remove it from code and active environments, assess
Git history/artifacts/log exposure, and only then resume CI. Removing a
commit does not revoke a credential. Never report raw tokens in issues.

No staging secret store, owner-approved region/cost, service credentials,
rotation schedule, backup/restore evidence, deployment-domain restrictions,
or production tenant/role authority has been configured. The original
14 risks, 12 decisions and 727 P1 cases stay unresolved. P3.07 remains
**PARTIAL until owner chooses a managed secret provider and approves the
staging runbook / secret lifecycle**. This is not authorization to move
the existing synthetic read-only database into a public CRM runtime.
