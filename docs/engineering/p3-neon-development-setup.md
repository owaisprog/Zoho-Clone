# P3.05–P3.07: Neon Postgres development setup (no local Docker)

**Owner preference (2026-11-17):** use Neon for local development rather
than running PostgreSQL in Docker. Neon remains PostgreSQL and Prisma 7 is
retained. This is **a new, synthetic-only cloud development environment**.
P3.05/P3.06 tenant design, cloud region/cost, secrets, staging and P3 release
approvals remain open. Do not repurpose an existing customer database or
production branch.

## Verified connected-cloud development setup (2026-11-19)

**The new connected-account Neon setup is complete.** Open
[zoho-clone-development](https://console.neon.tech/app/projects/small-river-48696124):
project ID `small-river-48696124`, branch `development`, database
`zoho_clone_synthetic`, role `p3_neon_reader`. The four synthetic tables,
fictional fixtures and RLS policies are already provisioned on this specific
project. Role permission checks and the five synthetic scoped-read cases
passed directly against Neon.

**Important account mismatch:** A previous session saw a different Neon
project with the same name, which is not accessible in the currently connected
Neon account. Confirm the project ID is **small-river-48696124**, rather than
choosing a similarly named project from another account.

**DO NOT rerun** the schema creation or fiction seed on this new project:
the seed includes non-idempotent INSERTs and will fail on duplicates.
For this already-provisioned project, skip sections 1–3 below and
follow only section 4 to update your private local connection URL.
**Local Prisma smoke now passed (owner-reported 2026-11-20)** using the
restricted Neon role. The owner ran `npm run smoke:synthetic-neon -w backend`
and received `P3.05/06 Neon synthetic Prisma read-only RLS smoke: PASS`.
Do not share or commit `backend/.env.neon.local`; the successful test does not
approve production or staging use of this synthetic development database.

## 1. Create a separate Neon project (owner action)

1. Visit https://console.neon.tech/ and create a **new separate project**
   named `zoho-clone-development`, not a branch copied from any production DB.
2. Review/choose the Neon region and plan based on your privacy, residency
   and budget preferences; do not authorize paid production infrastructure yet.
3. Create an **empty database** named exactly `zoho_clone_synthetic` in
   that project. Choose the dev branch/database in the Neon SQL Editor.
4. Keep **Auth0** as the identity provider. Neon Auth and public Data API
   must not replace/auto-map Auth0 users to CRM tenants.

Neon's Connect modal lets you select **branch + database + role** and copy a
Postgres URL. It is a SECRET; never paste it into chat or GitHub.

## 2. Initialize synthetic schema (Neon SQL Editor)

Before executing any script, confirm the selected database is
`zoho_clone_synthetic` and that this is a fresh, empty development project.

Run these repository SQL files **in order**, copying file content into the
Neon SQL Editor:

1. `backend/db/migrations/000_neon_dev_preflight.sql` — refuses the wrong
   database or an unrelated table.
2. `backend/db/migrations/001_synthetic_foundation.sql` — provisional
   `synthetic` schema and forced RLS tables.
3. `backend/db/fixtures/001_synthetic_seed.sql` — fictional `Demo`
   organizations and `@example.com` contacts only.

**Never** run these commands in an existing live or customer database.

## 3. Create restricted runtime role, grant SELECT only

Use the Neon SQL Editor on `zoho_clone_synthetic` and run the following
statement with a *strong, random, private password* you choose. Replace
the placeholder; do not commit/share the completed SQL or its secret:

```sql
CREATE ROLE p3_neon_reader
  LOGIN PASSWORD 'REPLACE_WITH_RANDOM_PRIVATE_PASSWORD'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
```

Then run
`backend/db/migrations/003_neon_dev_reader_grants.sql`
from the repository in the same database. This grants schema usage and
SELECT only on the four synthetic tables. Do not grant extra role membership,
table ownership, schema creation, or write permissions. The smoke checks
table privileges and RLS at runtime.

## 4. Connect local Prisma without Docker

In Neon, open **Connect**, select:
- Development branch in the new `zoho-clone-development` project
- Database: `zoho_clone_synthetic`
- Role: `p3_neon_reader`
- **Pooled connection** for application runtime

If the UI cannot select the SQL-created role, obtain its endpoint/DB host
from the owner's existing development project connection string, then
build a URL using the exact same host and database plus the new reader
role and password (URL-encode special password characters). The URL must
use `postgresql://`, a Neon `ep-` host ending in `.neon.tech`,
`?sslmode=verify-full`, role `p3_neon_reader`, and database
`zoho_clone_synthetic`. A `channel_binding=require` parameter is allowed.

On your Mac, from the repo root:

```bash
git switch chore/p3-master-roadmap-hardening-20261116
git pull --ff-only
npm ci
npm run build -w backend
cp backend/.env.neon.example backend/.env.neon.local
```

Edit `backend/.env.neon.local` locally (not in chat) and replace the example
`DATABASE_URL` with the restricted Neon role URL. Then run:

```bash
npm run smoke:synthetic-neon -w backend
```

Expected after the owner provisions the new database/schema/role:

```text
P3.05/06 Neon synthetic Prisma read-only RLS smoke: PASS
```

No Docker Desktop is needed for this **local Neon smoke**.

## 5. What this actually proves

The executable Prisma smoke connects to the real remote Neon PostgreSQL
database using TLS and the restricted read-only role. It checks role
name, RLS and read-only rights, default-deny outside transactions, tenant-
and-owner-scoped fictional reads, deny for revoked/cross-tenant identities,
and transaction-local context cleanup. The caller supplies only hardcoded
`org_demo_*` and `user_demo_*` test contexts, never Auth0 identities.

**Not implemented:** API/database authorization for real Auth0 subjects,
real customer-data migrations, cloud staging deployment, domain/field ACL
approval, production credential rotation or end-to-end original P1 cases.
Normal Express API does not import or run the Neon smoke.

CI may continue running isolated disposable Docker Postgres to make
repeatable security tests without any Neon secrets. The user does not
have to run local Docker. Neon integration execution against the
owner's account can be marked complete ONLY after receiving an actual
Neon smoke PASS from the owner or connected scoped Neon tools.

**Troubleshooting:** If the smoke fails, check the chosen database, role,
TLS URL and SQL initialization order. The CLI deliberately does not log
passwords, remote hosts, stack traces or user data; share only the final
PASS/FAIL line or a redacted error category. Ask before rotating any
credentials or repeating schema creation.
