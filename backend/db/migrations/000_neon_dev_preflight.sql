-- Run FIRST in Neon SQL Editor on a BRAND NEW Zoho Clone development
-- database that has NEVER contained real, sensitive or customer data.
-- This is a READ-ONLY guard; it does not create/modify anything.
DO $$
BEGIN
  IF current_database() <> 'zoho_clone_synthetic' THEN
    RAISE EXCEPTION 'STOP: choose dedicated zoho_clone_synthetic database';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname NOT IN ('pg_catalog','information_schema','pg_toast')
      AND c.relkind IN ('r','p') AND n.nspname <> 'synthetic'
  ) THEN
    RAISE EXCEPTION 'STOP: this database contains unrelated tables';
  END IF;
END $$;
SELECT 'P3 Neon synthetic-only database preflight PASS' AS result;
