# P3.05–P3.06: Local-only Prisma + PostgreSQL runtime smoke

**Status:** implementation added to draft PR #53; verified only after CI
completion. Production schema, tenant permissions and staging access remain
blocked by OPEN-001/002/003 and the official P3 exit gates.

## What this adds

- Pinned `prisma`, `@prisma/client`, `@prisma/adapter-pg` and `pg`;
  generated TypeScript Prisma Client under `backend/src/generated/prisma`.
- Disposable PostgreSQL 17 Docker container, restricted login
  `p3_preview_runtime` with **SELECT-only**, **NOSUPERUSER**, **NOBYPASSRLS**
  privileges. Fake, publicly documented password, **not an application
  credential**. Server bound to `127.0.0.1:5433` only.
- A strict runtime URL gate that denies any remote host, other database,
  database owner login or non-synthetic port.
- Executable Prisma Client queries using transaction-local tenant and actor
  settings, hardcoded fictional identities, scoped owner filtering and field
  projection. It validates cross-tenant denial, inactive membership denial,
  missing-session denial, role constraints and transaction context cleanup.
- **No** Auth0-to-database user mapping, **no** real multi-tenant CRM endpoints,
  no general-purpose runtime DB connection in the Express server, no customer
  data, no public database writes and no production migrations.

Prisma models reflect the *provisional* synthetic SQL schema. The SQL
migration `001_synthetic_foundation.sql` is the source of truth for this
disposable fixture database. Do not run Prisma `db push`, `migrate dev`,
`migrate deploy`, introspection, or an unreviewed drift repair on any real
database.

## Run locally

From the project root on branch
`chore/p3-master-roadmap-hardening-20261116`:

```bash
git pull --ff-only
npm ci
docker compose up -d --wait
npm run build -w backend
cp backend/.env.p3.runtime.example backend/.env.p3.runtime.local
npm run smoke:synthetic-prisma -w backend
```

Expected:

```text
P3.05/06 local synthetic Prisma read-only RLS smoke: PASS
```

If this Docker volume predates the local runtime role, initialize the role
without deleting any volumes (only on the known fictional local database):

```bash
docker compose exec -T postgres psql -U demo_local -d zoho_clone_synthetic \
  -v ON_ERROR_STOP=1 -f /docker-entrypoint-initdb.d/03-local-role.sql
```

Then re-run the smoke. No user needs to share the `DATABASE_URL` or Auth0
secrets. `backend/.env.p3.runtime.local` is gitignored.

## Acceptance and deliberate exclusions

| Check | Required evidence |
| --- | --- |
| Prisma generator compiles | CI npm lockfile/typecheck/build |
| Restricted runtime identity | Prisma smoke confirms role is not superuser or BYPASSRLS |
| Default deny | Count of leads without tenant+actor context is zero |
| Tenant and ownership | Orchid editor sees one owned row; Orchid reader sees two scoped fake rows; Cedar editor sees one |
| Negative isolation | Disabled Orchid user and mismatched Cedar/Orchid actor see zero |
| Context isolation | A query after the last interactive transaction again sees zero |
| API boundary | Normal Express server exposes no new tenant/CRM database endpoints |
| Production permission policy | **NOT APPROVED**; Auth0 subject not mapped to any synthetic actor |
| Actual staging, migration drift, backup/recovery | **NOT TESTED** |

Prisma's driver adapter operates behind a restricted test-only caller;
application-level permission checks must be designed and reviewed before
any real tenant reads or writes. RLS settings alone do **not** authenticate
users or grant CRM access. Live session revocation, DB role management,
migration and backup/restore, staging provider/region and other P3 release
gates remain open.
