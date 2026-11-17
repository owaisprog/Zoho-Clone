-- P3.05 LOCAL ONLY. This role/credential is for the disposable fictional
-- Docker Compose Postgres database; NEVER run in staging or production.
-- The main application does not use this database connection.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'p3_preview_runtime') THEN
    CREATE ROLE p3_preview_runtime
      LOGIN PASSWORD 'fake_p3_preview_only'
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  ELSE
    ALTER ROLE p3_preview_runtime
      LOGIN PASSWORD 'fake_p3_preview_only'
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
END $$;

GRANT CONNECT ON DATABASE zoho_clone_synthetic TO p3_preview_runtime;
GRANT USAGE ON SCHEMA synthetic TO p3_preview_runtime;
-- Read-only smoke: no schema ownership, INSERT, UPDATE, DELETE, TRUNCATE or
-- BYPASSRLS rights. Scoped application writes remain unapproved.
GRANT SELECT ON synthetic.organizations, synthetic.memberships,
  synthetic.leads, synthetic.idempotency_records TO p3_preview_runtime;
