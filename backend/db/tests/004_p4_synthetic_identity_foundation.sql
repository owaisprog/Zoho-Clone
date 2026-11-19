-- P4 candidate actual PostgreSQL RLS/unique-key/rollback smoke.
-- Run ONLY in zoho_clone_synthetic_ci after candidate schema.
\set ON_ERROR_STOP on

-- Without trusted server-installed context, no identity data is visible.
DO $test$
BEGIN
  IF (SELECT count(*) FROM p4_synthetic.users) <> 0 THEN
    RAISE EXCEPTION 'P4 default deny missing';
  END IF;
END
$test$;

BEGIN;
SELECT set_config('app.actor_id', 'user_demo_alice', true);
INSERT INTO p4_synthetic.users(id) VALUES ('user_demo_alice');
INSERT INTO p4_synthetic.identity_subjects
  (issuer, external_subject, user_id, canonical_email, email_verified)
VALUES ('https://demo.us.auth0.com/', 'auth0|demo-alice',
        'user_demo_alice', 'alice@example.com', true);
INSERT INTO p4_synthetic.global_profiles(user_id, display_name, locale, time_zone)
VALUES ('user_demo_alice', 'Demo Alice', 'en-US', 'Asia/Karachi');
COMMIT;

BEGIN;
SELECT set_config('app.actor_id', 'user_demo_bob', true);
INSERT INTO p4_synthetic.users(id) VALUES ('user_demo_bob');
INSERT INTO p4_synthetic.identity_subjects
  (issuer, external_subject, user_id, canonical_email, email_verified)
VALUES ('https://demo.us.auth0.com/', 'auth0|demo-bob',
        'user_demo_bob', 'alice@example.com', false);
COMMIT;

-- One verified global user may create two distinct orgs; no implicit
-- membership of another user or unverified identity.
BEGIN;
SELECT set_config('app.actor_id', 'user_demo_alice', true);
SELECT set_config('app.tenant_id', '10000000-0000-4000-8000-000000000001', true);
INSERT INTO p4_synthetic.organizations(id, slug, display_name, created_by)
VALUES ('10000000-0000-4000-8000-000000000001', 'demo-maple-payments',
        'Demo Maple Payments','user_demo_alice');
INSERT INTO p4_synthetic.memberships(org_id,user_id,role,active)
VALUES ('10000000-0000-4000-8000-000000000001','user_demo_alice','OWNER',true);
COMMIT;

BEGIN;
SELECT set_config('app.actor_id', 'user_demo_alice', true);
SELECT set_config('app.tenant_id', '10000000-0000-4000-8000-000000000002', true);
INSERT INTO p4_synthetic.organizations(id, slug, display_name, created_by)
VALUES ('10000000-0000-4000-8000-000000000002', 'demo-cedar-payments',
        'Demo Cedar Payments','user_demo_alice');
INSERT INTO p4_synthetic.memberships(org_id,user_id,role,active)
VALUES ('10000000-0000-4000-8000-000000000002','user_demo_alice','OWNER',true);
DO $test$
BEGIN
  IF (SELECT count(*) FROM p4_synthetic.global_profiles) <> 1 THEN
    RAISE EXCEPTION 'global profile unexpectedly org-scoped';
  END IF;
  IF (SELECT count(*) FROM p4_synthetic.organizations) <> 1 THEN
    RAISE EXCEPTION 'wrong org visible outside transaction-local tenant';
  END IF;
END
$test$;
COMMIT;

-- Org slug is unique at the database layer, not by a race-prone SELECT.
BEGIN;
SELECT set_config('app.actor_id', 'user_demo_alice', true);
SELECT set_config('app.tenant_id', '10000000-0000-4000-8000-000000000003', true);
DO $test$
BEGIN
  BEGIN
    INSERT INTO p4_synthetic.organizations(id,slug,display_name,created_by)
    VALUES ('10000000-0000-4000-8000-000000000003','demo-maple-payments',
            'Demo Duplicate','user_demo_alice');
    RAISE EXCEPTION 'duplicate slug unexpectedly inserted';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;
  IF EXISTS (
    SELECT 1 FROM p4_synthetic.organizations
    WHERE id = '10000000-0000-4000-8000-000000000003'
  ) THEN RAISE EXCEPTION 'duplicate org survived failed insert'; END IF;
END
$test$;
COMMIT;

-- A failed owner-membership insert must roll back its org insert
-- when the two are in the same transaction / savepoint.
BEGIN;
SELECT set_config('app.actor_id', 'user_demo_alice', true);
SELECT set_config('app.tenant_id', '10000000-0000-4000-8000-000000000004', true);
DO $test$
BEGIN
  BEGIN
    INSERT INTO p4_synthetic.organizations(id,slug,display_name,created_by)
    VALUES ('10000000-0000-4000-8000-000000000004','demo-rollback',
            'Demo Rollback','user_demo_alice');
    INSERT INTO p4_synthetic.memberships(org_id,user_id,role)
    VALUES ('10000000-0000-4000-8000-000000000004','user_demo_bob','OWNER');
    RAISE EXCEPTION 'forged member unexpectedly inserted';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  IF EXISTS (
    SELECT 1 FROM p4_synthetic.organizations
    WHERE id = '10000000-0000-4000-8000-000000000004'
  ) THEN RAISE EXCEPTION 'atomic rollback failed'; END IF;
END
$test$;
COMMIT;

-- Bob cannot read Alice's org or profile, even by guessing tenant ID.
BEGIN;
SELECT set_config('app.actor_id', 'user_demo_bob', true);
SELECT set_config('app.tenant_id', '10000000-0000-4000-8000-000000000001', true);
DO $test$
BEGIN
  IF (SELECT count(*) FROM p4_synthetic.organizations) <> 0 OR
     (SELECT count(*) FROM p4_synthetic.memberships) <> 0 OR
     (SELECT count(*) FROM p4_synthetic.global_profiles) <> 0 THEN
    RAISE EXCEPTION 'cross-user visibility leak';
  END IF;
  -- Match Bob's requested tenant context to test email verification,
  -- not merely the tenant-ID mismatch guard.
  PERFORM set_config('app.tenant_id', '10000000-0000-4000-8000-000000000005', true);
  BEGIN
    INSERT INTO p4_synthetic.organizations(id,slug,display_name,created_by)
    VALUES ('10000000-0000-4000-8000-000000000005','demo-bob-unverified',
            'Demo Bob Unverified','user_demo_bob');
    RAISE EXCEPTION 'unverified email unexpectedly provisioned';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END
$test$;
COMMIT;

DO $test$
BEGIN
  IF (SELECT count(*) FROM p4_synthetic.organizations) <> 0 OR
     (SELECT count(*) FROM p4_synthetic.global_profiles) <> 0 THEN
    RAISE EXCEPTION 'session context survived COMMIT';
  END IF;
END
$test$;

SELECT 'P4 candidate synthetic identity and org SQL acceptance PASS' AS result;
