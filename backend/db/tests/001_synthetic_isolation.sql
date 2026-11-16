-- Assertions against disposable PostgreSQL CI service only.
-- Abort immediately if fixture constraints or isolation fail.
\set ON_ERROR_STOP on

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'p3_preview_runtime') THEN
    CREATE ROLE p3_preview_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS;
  END IF;
END $$;

GRANT USAGE ON SCHEMA synthetic TO p3_preview_runtime;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA synthetic TO p3_preview_runtime;

-- All four tables have RLS forced; privileged CI fixture bootstrap remains separate.
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM pg_class c
    JOIN pg_namespace ns ON ns.oid = c.relnamespace
    WHERE ns.nspname='synthetic' AND c.relkind='r'
      AND c.relrowsecurity=true AND c.relforcerowsecurity=true;
  IF n <> 4 THEN RAISE EXCEPTION 'Expected 4 forced RLS tables, got %',n; END IF;
END $$;

-- Cross-tenant ownership FK rejects a forged owner relation.
DO $$
BEGIN
  BEGIN
    INSERT INTO synthetic.leads (org_id,id,owner_id,organization,contact,email)
      VALUES('org_demo_orchid','LEAD-DEMO-999','user_demo_carla',
        'Demo Wrong Owner','Example Contact Z','wrong-owner@example.com');
    RAISE EXCEPTION 'Cross-org owner FK must reject write';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
END $$;

-- Test fixtures forbid real addresses (even during privileged fixture setup).
DO $$
BEGIN
  BEGIN
    INSERT INTO synthetic.leads (org_id,id,owner_id,organization,contact,email)
      VALUES('org_demo_orchid','LEAD-DEMO-999','user_demo_alice',
        'Demo Unsafe Lead','Example Person','real@business.com');
    RAISE EXCEPTION 'Non-example email must reject write';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;

-- Default-deny when transaction-scoped tenant/actor context is absent.
BEGIN;
SET LOCAL ROLE p3_preview_runtime;
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM synthetic.leads;
  IF n <> 0 THEN RAISE EXCEPTION 'Missing session context leaked rows (%)',n; END IF;
END $$;
ROLLBACK;

-- A valid active fictional actor sees ONLY the matching tenant's data.
BEGIN;
SET LOCAL ROLE p3_preview_runtime;
SET LOCAL app.tenant_id = 'org_demo_orchid';
SET LOCAL app.actor_id = 'user_demo_alice';
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM synthetic.leads;
  IF n <> 2 THEN RAISE EXCEPTION 'Orchid tenant should see 2 rows, got %',n; END IF;
  SELECT count(*) INTO n FROM synthetic.leads WHERE id='LEAD-DEMO-301';
  IF n <> 0 THEN RAISE EXCEPTION 'Cross tenant lead leaked'; END IF;
  SELECT count(*) INTO n FROM synthetic.memberships;
  IF n <> 1 THEN RAISE EXCEPTION 'Membership RLS should show only self, got %',n; END IF;
  SELECT count(*) INTO n FROM synthetic.organizations;
  IF n <> 1 THEN RAISE EXCEPTION 'Organization RLS should show only tenant, got %',n; END IF;
END $$;
ROLLBACK;

-- An actor in the other org sees no records from the first org.
BEGIN;
SET LOCAL ROLE p3_preview_runtime;
SET LOCAL app.tenant_id = 'org_demo_cedar';
SET LOCAL app.actor_id = 'user_demo_carla';
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM synthetic.leads;
  IF n <> 1 THEN RAISE EXCEPTION 'Cedar tenant should see 1 row, got %',n; END IF;
  SELECT count(*) INTO n FROM synthetic.leads WHERE id='LEAD-DEMO-201';
  IF n <> 0 THEN RAISE EXCEPTION 'Orchid lead leaked to cedar'; END IF;
END $$;
ROLLBACK;

-- Tenant setting alone is insufficient for membership visibility.
BEGIN;
SET LOCAL ROLE p3_preview_runtime;
SET LOCAL app.tenant_id = 'org_demo_cedar';
SET LOCAL app.actor_id = 'user_demo_alice';
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM synthetic.memberships;
  IF n <> 0 THEN RAISE EXCEPTION 'Cross-tenant actor saw membership'; END IF;
END $$;
ROLLBACK;

-- RLS enforces tenant-scoped writes for non-owner runtime role.
BEGIN;
SET LOCAL ROLE p3_preview_runtime;
SET LOCAL app.tenant_id = 'org_demo_orchid';
SET LOCAL app.actor_id = 'user_demo_alice';
DO $$
BEGIN
  BEGIN
    INSERT INTO synthetic.leads (org_id,id,owner_id,organization,contact,email)
      VALUES('org_demo_cedar','LEAD-DEMO-999','user_demo_carla',
        'Demo Forbidden Write','Example Contact Z','no-access@example.com');
    RAISE EXCEPTION 'RLS should have blocked cross tenant write';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
ROLLBACK;

SELECT 'P3 synthetic-only PostgreSQL tenant isolation assertions PASS' AS result;
