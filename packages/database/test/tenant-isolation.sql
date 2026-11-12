\set ON_ERROR_STOP on

-- CI-only fixtures; run with a superuser on an empty disposable test database.
-- The runtime business_os_app role must not be a superuser, table owner, or BYPASSRLS role.
BEGIN;

INSERT INTO business_os.organizations (id, slug, name) VALUES
  ('11111111-1111-4111-8111-111111111111', 'tenant-a', 'Tenant A'),
  ('22222222-2222-4222-8222-222222222222', 'tenant-b', 'Tenant B');

INSERT INTO business_os.users (id, email) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a@example.test'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'b@example.test');

INSERT INTO business_os.memberships (tenant_id, user_id, role) VALUES
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'owner'),
  ('22222222-2222-4222-8222-222222222222', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'owner');

INSERT INTO business_os.crm_accounts (id, tenant_id, name, owner_user_id) VALUES
  ('aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Account A', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  ('bbbbbbbb-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'Account B', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

INSERT INTO business_os.crm_contacts (id, tenant_id, account_id, full_name) VALUES
  ('aaaaaaaa-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0000-4000-8000-000000000001', 'Contact A'),
  ('bbbbbbbb-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222', 'bbbbbbbb-0000-4000-8000-000000000001', 'Contact B');

COMMIT;

-- Missing context must not expose any tenant data.
BEGIN;
SET LOCAL ROLE business_os_app;
DO $test$
BEGIN
  IF (SELECT count(*) FROM business_os.organizations) <> 0 THEN
    RAISE EXCEPTION 'missing context leaked organizations';
  END IF;
  IF (SELECT count(*) FROM business_os.memberships) <> 0 THEN
    RAISE EXCEPTION 'missing context leaked memberships';
  END IF;
  IF (SELECT count(*) FROM business_os.crm_accounts) <> 0 THEN
    RAISE EXCEPTION 'missing context leaked accounts';
  END IF;
  IF (SELECT count(*) FROM business_os.crm_contacts) <> 0 THEN
    RAISE EXCEPTION 'missing context leaked contacts';
  END IF;
END
$test$;
ROLLBACK;

-- Tenant A: only A rows can be read and altered.
BEGIN;
SET LOCAL ROLE business_os_app;
SET LOCAL business_os.tenant_id = '11111111-1111-4111-8111-111111111111';

DO $test$
DECLARE
  n integer;
  rejected boolean := false;
BEGIN
  IF (SELECT count(*) FROM business_os.organizations) <> 1 THEN
    RAISE EXCEPTION 'tenant A organization visibility failed';
  END IF;
  IF (SELECT count(*) FROM business_os.memberships) <> 1 THEN
    RAISE EXCEPTION 'tenant A membership visibility failed';
  END IF;
  IF (SELECT count(*) FROM business_os.crm_accounts) <> 1 THEN
    RAISE EXCEPTION 'tenant A account visibility failed';
  END IF;
  IF (SELECT count(*) FROM business_os.crm_contacts) <> 1 THEN
    RAISE EXCEPTION 'tenant A contact visibility failed';
  END IF;

  UPDATE business_os.crm_accounts SET name = 'Should not change'
  WHERE id = 'bbbbbbbb-0000-4000-8000-000000000001';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'cross-tenant UPDATE succeeded'; END IF;

  DELETE FROM business_os.crm_contacts
  WHERE id = 'bbbbbbbb-0000-4000-8000-000000000002';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'cross-tenant DELETE succeeded'; END IF;

  BEGIN
    INSERT INTO business_os.crm_accounts (tenant_id, name)
    VALUES ('22222222-2222-4222-8222-222222222222', 'Forbidden account');
  EXCEPTION WHEN insufficient_privilege THEN
    rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'cross-tenant INSERT succeeded'; END IF;

  rejected := false;
  BEGIN
    INSERT INTO business_os.crm_contacts (tenant_id, account_id, full_name)
    VALUES ('11111111-1111-4111-8111-111111111111',
            'bbbbbbbb-0000-4000-8000-000000000001', 'Wrong account tenant');
  EXCEPTION WHEN foreign_key_violation THEN
    rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'cross-tenant account reference succeeded'; END IF;

  rejected := false;
  BEGIN
    PERFORM id FROM business_os.users LIMIT 1;
  EXCEPTION WHEN insufficient_privilege THEN
    rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'runtime role accessed users table'; END IF;
END
$test$;

-- In-tenant INSERT works. Entire test transaction is rolled back below.
INSERT INTO business_os.crm_accounts (tenant_id, name)
VALUES ('11111111-1111-4111-8111-111111111111', 'Allowed A Account');

DO $test$
BEGIN
  IF (SELECT count(*) FROM business_os.crm_accounts) <> 2 THEN
    RAISE EXCEPTION 'tenant A allowed insert failed';
  END IF;
END
$test$;
ROLLBACK;

-- Tenant B sees only its own baseline rows.
BEGIN;
SET LOCAL ROLE business_os_app;
SET LOCAL business_os.tenant_id = '22222222-2222-4222-8222-222222222222';
DO $test$
BEGIN
  IF (SELECT count(*) FROM business_os.crm_accounts) <> 1 THEN
    RAISE EXCEPTION 'tenant B account visibility failed';
  END IF;
  IF (SELECT count(*) FROM business_os.crm_contacts) <> 1 THEN
    RAISE EXCEPTION 'tenant B contact visibility failed';
  END IF;
END
$test$;
ROLLBACK;

-- No test fixtures left behind.
TRUNCATE business_os.crm_contacts, business_os.crm_accounts,
         business_os.memberships, business_os.users, business_os.organizations
         RESTART IDENTITY;

SELECT 'tenant isolation smoke checks passed' AS result;
