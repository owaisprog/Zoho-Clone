-- Run ONLY on the freshly initialized Neon development database
-- zoho_clone_synthetic. This SQL cannot create a role/password;
-- first create p3_neon_reader separately with a unique private password
-- and NO elevated memberships. Never share that password.
BEGIN;
DO $$
BEGIN
  IF current_database() <> 'zoho_clone_synthetic' THEN
    RAISE EXCEPTION 'STOP: wrong Neon database';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='p3_neon_reader') THEN
    RAISE EXCEPTION 'STOP: create p3_neon_reader first (without admin memberships)';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_roles
    WHERE rolname='p3_neon_reader' AND (rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole)
  ) THEN
    RAISE EXCEPTION 'STOP: p3_neon_reader must be unprivileged';
  END IF;
END $$;
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA synthetic FROM p3_neon_reader;
GRANT CONNECT ON DATABASE zoho_clone_synthetic TO p3_neon_reader;
GRANT USAGE ON SCHEMA synthetic TO p3_neon_reader;
GRANT SELECT ON synthetic.organizations, synthetic.memberships,
 synthetic.leads, synthetic.idempotency_records TO p3_neon_reader;
COMMIT;
