-- P4.06-10 real PostgreSQL policy tests. CI-only role and synthetic database.
\set ON_ERROR_STOP on
DO $guard$
BEGIN
  IF current_database() <> 'zoho_clone_synthetic_ci' THEN
    RAISE EXCEPTION 'P4 tests may run ONLY in disposable CI';
  END IF;
END
$guard$;
SET ROLE p4_synthetic_ci_runtime;
DO $role$
BEGIN
  IF current_user <> 'p4_synthetic_ci_runtime' OR
     (SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname=current_user) THEN
    RAISE EXCEPTION 'P4 RLS test must not use superuser';
  END IF;
END
$role$;

-- Without server-installed context, a public read cannot enumerate invites.
DO $test$
BEGIN
  IF (SELECT count(*) FROM p4_synthetic.invitations) <> 0 THEN
    RAISE EXCEPTION 'P4 invitation default deny failure';
  END IF;
END
$test$;

-- Alice is the verified owner of org 1 from P4 candidate test 004.
BEGIN;
SELECT set_config('app.actor_id', 'user_demo_alice', true);
SELECT set_config('app.tenant_id', '10000000-0000-4000-8000-000000000001', true);
INSERT INTO p4_synthetic.invitations
 (id, org_id, invited_by, recipient_email, granted_role, token_hash, status,
  issued_at, expires_at, resend_count, version)
VALUES
 ('10000000-0000-4000-8000-000000000021',
  '10000000-0000-4000-8000-000000000001',
  'user_demo_alice','carla@example.com','MEMBER',repeat('a',64),
  'pending', '2030-01-01T00:00:00Z', '2030-01-03T00:00:00Z',0,1);

DO $test$
BEGIN
  IF (SELECT count(*) FROM p4_synthetic.invitations) <> 1 THEN
    RAISE EXCEPTION 'P4 owner invite invisible';
  END IF;
  BEGIN
    INSERT INTO p4_synthetic.invitations
     (id,org_id,invited_by,recipient_email,granted_role,token_hash,issued_at,expires_at)
    VALUES
     ('10000000-0000-4000-8000-000000000022',
      '10000000-0000-4000-8000-000000000001',
      'user_demo_alice','carla@example.com','MEMBER',repeat('b',64),
      '2030-01-01T00:00:00Z','2030-01-03T00:00:00Z');
    RAISE EXCEPTION 'pending invite duplicate not rejected';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO p4_synthetic.invitations
     (id,org_id,invited_by,recipient_email,granted_role,token_hash,issued_at,expires_at)
    VALUES
     ('10000000-0000-4000-8000-000000000023',
      '10000000-0000-4000-8000-000000000001',
      'user_demo_alice','dana@example.com','OWNER',repeat('c',64),
      '2030-01-01T00:00:00Z','2030-01-03T00:00:00Z');
    RAISE EXCEPTION 'invite role elevation not rejected';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END
$test$;
COMMIT;

-- A different tenant context cannot see Alice's original invite.
BEGIN;
SELECT set_config('app.actor_id', 'user_demo_alice', true);
SELECT set_config('app.tenant_id', '10000000-0000-4000-8000-000000000002', true);
DO $test$
BEGIN
  IF (SELECT count(*) FROM p4_synthetic.invitations) <> 0 THEN
    RAISE EXCEPTION 'cross-org invitation leak to same actor';
  END IF;
END
$test$;
COMMIT;

-- Bob has no verified OWNER membership and cannot view/issue invitations
-- even if he guesses the tenant UUID and forge-sends invite info.
BEGIN;
SELECT set_config('app.actor_id', 'user_demo_bob', true);
SELECT set_config('app.tenant_id', '10000000-0000-4000-8000-000000000001', true);
DO $test$
BEGIN
  IF (SELECT count(*) FROM p4_synthetic.invitations) <> 0 THEN
    RAISE EXCEPTION 'non-owner invitation enumeration';
  END IF;
  BEGIN
    INSERT INTO p4_synthetic.invitations
     (id,org_id,invited_by,recipient_email,granted_role,token_hash,issued_at,expires_at)
    VALUES
     ('10000000-0000-4000-8000-000000000024',
      '10000000-0000-4000-8000-000000000001',
      'user_demo_bob','dana@example.com','MEMBER',repeat('d',64),
      '2030-01-01T00:00:00Z','2030-01-03T00:00:00Z');
    RAISE EXCEPTION 'unverified non-owner created invitation';
  EXCEPTION WHEN insufficient_privilege OR foreign_key_violation THEN NULL;
  END;
END
$test$;
COMMIT;

-- Atomic conditional updates demonstrate single-use state transitions.
-- IMPORTANT: owner-only fixture update, NOT a live recipient acceptance API.
BEGIN;
SELECT set_config('app.actor_id', 'user_demo_alice', true);
SELECT set_config('app.tenant_id', '10000000-0000-4000-8000-000000000001', true);
DO $test$
DECLARE changed integer;
BEGIN
  UPDATE p4_synthetic.invitations SET status='accepted', version=version+1
  WHERE token_hash=repeat('a',64) AND status='pending';
  GET DIAGNOSTICS changed=ROW_COUNT;
  IF changed <> 1 THEN RAISE EXCEPTION 'pending token could not transition'; END IF;

  UPDATE p4_synthetic.invitations SET status='accepted', version=version+1
  WHERE token_hash=repeat('a',64) AND status='pending';
  GET DIAGNOSTICS changed=ROW_COUNT;
  IF changed <> 0 THEN RAISE EXCEPTION 'single-use token accepted twice'; END IF;
END
$test$;
COMMIT;

-- Same email can be reissued after old invite has become non-pending.
BEGIN;
SELECT set_config('app.actor_id','user_demo_alice',true);
SELECT set_config('app.tenant_id','10000000-0000-4000-8000-000000000001',true);
INSERT INTO p4_synthetic.invitations
 (id,org_id,invited_by,recipient_email,granted_role,token_hash,issued_at,expires_at)
VALUES
 ('10000000-0000-4000-8000-000000000025',
  '10000000-0000-4000-8000-000000000001',
  'user_demo_alice','carla@example.com','MEMBER',repeat('e',64),
  '2030-01-05T00:00:00Z','2030-01-07T00:00:00Z');
UPDATE p4_synthetic.invitations
 SET status='revoked', version=version+1
 WHERE token_hash=repeat('e',64) AND status='pending';
DO $test$
DECLARE changed integer;
BEGIN
  UPDATE p4_synthetic.invitations SET status='accepted', version=version+1
  WHERE token_hash=repeat('e',64) AND status='pending';
  GET DIAGNOSTICS changed=ROW_COUNT;
  IF changed <> 0 THEN RAISE EXCEPTION 'revoked token was reused'; END IF;
END
$test$;
COMMIT;

-- Verify SET LOCAL context is cleared on a new transaction/connection.
DO $test$
BEGIN
  IF (SELECT count(*) FROM p4_synthetic.invitations) <> 0 THEN
    RAISE EXCEPTION 'tenant context survived COMMIT';
  END IF;
END
$test$;

SELECT 'P4.06-10 CI-only invitation+tenant PostgreSQL restricted-role acceptance PASS' AS result;
