# Business OS PostgreSQL foundation

**Prototype scope:** organization and user reference tables, memberships, CRM accounts and contacts. This is backend infrastructure, not a user-ready CRM or an authentication feature.

## Migrations / bootstrap

With PostgreSQL 16+ and an isolated database, run with a dedicated migration/admin role:

```sh
psql -X -v ON_ERROR_STOP=1 "$MIGRATION_DATABASE_URL" -f packages/database/sql/001_core.sql
psql -X -v ON_ERROR_STOP=1 "$MIGRATION_DATABASE_URL" -f packages/database/sql/002_runtime_role.sql
```

The **second script requires role-management privileges** to create the NOLOGIN `business_os_app` role. The application runtime account should be a separate LOGIN role granted membership in `business_os_app` using a secret supplied outside the repository. Do not use the migration role for app connections.

Migrations are versioned but **not yet tracked by a migration runner**; reruns of 001 will fail if applied twice. Record migration state before real deployments.

## Security properties

- Tenant-owned records include `tenant_id`.
- Composite foreign keys prevent contact → account and account → owner cross-tenant references.
- Row Level Security and FORCE ROW LEVEL SECURITY are enabled on organization, membership, account and contact tables.
- The runtime role sees organization/membership metadata read-only, and may CRUD accounts/contacts inside the active tenant only.
- The global user-reference table is intentionally inaccessible to the runtime role.
- Missing tenant context returns zero rows. Malformed tenant UUIDs raise an error (fail closed).

**Critical limitation:** A raw SQL role with permission to SET `business_os.tenant_id` can impersonate any tenant. This PostgreSQL RLS policy is *defense in depth*, NOT an authentication or authorization boundary on its own. The API MUST validate the requesting identity, membership and permissions before selecting a tenant context, set context transaction-locally, and prevent any client-supplied SQL/session commands. Do not expose the database or business data APIs until that is enforced.

## Disposable CI test

```sh
export PGHOST=localhost PGPORT=5432 PGUSER=postgres PGPASSWORD=postgres PGDATABASE=business_os_test
psql -X -v ON_ERROR_STOP=1 -f packages/database/sql/001_core.sql
psql -X -v ON_ERROR_STOP=1 -f packages/database/sql/002_runtime_role.sql
psql -X -v ON_ERROR_STOP=1 -f packages/database/test/tenant-isolation.sql
```

Test seeds use synthetic example.test data. Run them **only on a disposable database**. The test uses rollback for temporary writes and TRUNCATE for fixtures.
