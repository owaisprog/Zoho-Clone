-- P4.16-20: real PostgreSQL synthetic CI RLS + immutable audit tests.
\set ON_ERROR_STOP on
DO $guard$
BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' THEN
   RAISE EXCEPTION 'P4.16-20 SQL tests only allowed on disposable CI';
 END IF;
END
$guard$;
SET ROLE p4_synthetic_ci_runtime;
DO $role$
BEGIN
 IF current_user<>'p4_synthetic_ci_runtime' OR
    (SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname=current_user) THEN
  RAISE EXCEPTION 'P4 SQL isolation test must execute under restricted role';
 END IF;
END
$role$;

DO $test$
BEGIN
 IF (SELECT count(*) FROM p4_synthetic.organization_settings)<>0 OR
    (SELECT count(*) FROM p4_synthetic.app_grants)<>0 OR
    (SELECT count(*) FROM p4_synthetic.audit_logs)<>0 OR
    (SELECT count(*) FROM p4_synthetic.files)<>0 OR
    (SELECT count(*) FROM p4_synthetic.file_versions)<>0 THEN
  RAISE EXCEPTION 'P4.16-20 default deny failed';
 END IF;
END
$test$;

BEGIN;
SELECT set_config('app.actor_id','user_demo_alice',true);
SELECT set_config('app.tenant_id','10000000-0000-4000-8000-000000000001',true);
DO $test$
BEGIN
 IF (SELECT count(*) FROM p4_synthetic.organization_settings)<>1 OR
    NOT EXISTS(SELECT 1 FROM p4_synthetic.organization_settings WHERE time_zone='Asia/Karachi') THEN
   RAISE EXCEPTION 'owner org preference isolation failed';
 END IF;
 IF (SELECT count(*) FROM p4_synthetic.app_grants)<>2 OR
    (SELECT count(*) FROM p4_synthetic.app_grants WHERE active=true)<>1 OR
    (SELECT count(*) FROM p4_synthetic.app_grants WHERE app_code='finance' AND active=true)<>0 THEN
   RAISE EXCEPTION 'per-org entitlement or locked app isolation failed';
 END IF;
 IF (SELECT count(*) FROM p4_synthetic.files)<>1 OR
    (SELECT count(*) FROM p4_synthetic.file_versions)<>1 OR
    EXISTS(SELECT 1 FROM p4_synthetic.files WHERE id='10000000-0000-4000-8000-000000000032') THEN
   RAISE EXCEPTION 'foreign file metadata unexpectedly visible';
 END IF;
 BEGIN
  UPDATE p4_synthetic.organization_settings SET display_currency='USD'
    WHERE org_id='10000000-0000-4000-8000-000000000001';
  RAISE EXCEPTION 'restricted runtime edited preferences';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
  DELETE FROM p4_synthetic.files WHERE org_id='10000000-0000-4000-8000-000000000001';
  RAISE EXCEPTION 'restricted runtime deleted file';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END
$test$;
COMMIT;

BEGIN;
SELECT set_config('app.actor_id','user_demo_alice',true);
SELECT set_config('app.tenant_id','10000000-0000-4000-8000-000000000002',true);
DO $test$
BEGIN
 IF (SELECT count(*) FROM p4_synthetic.organization_settings)<>1 OR
    NOT EXISTS(SELECT 1 FROM p4_synthetic.organization_settings WHERE display_currency='USD') OR
    (SELECT count(*) FROM p4_synthetic.app_grants)<>1 OR
    (SELECT count(*) FROM p4_synthetic.app_grants WHERE active=true)<>0 OR
    (SELECT count(*) FROM p4_synthetic.files)<>1 OR
    EXISTS (SELECT 1 FROM p4_synthetic.files
      WHERE id='10000000-0000-4000-8000-000000000031') THEN
   RAISE EXCEPTION 'same user leaked org settings, grants or files between tenants';
 END IF;
END
$test$;
COMMIT;

-- Bob was revoked from org1 in 006 test; old context and past org role
-- must not expose settings, app grants, attachments or audit logs.
BEGIN;
SELECT set_config('app.actor_id','user_demo_bob',true);
SELECT set_config('app.tenant_id','10000000-0000-4000-8000-000000000001',true);
DO $test$
BEGIN
 IF (SELECT count(*) FROM p4_synthetic.organization_settings)<>0 OR
    (SELECT count(*) FROM p4_synthetic.app_grants)<>0 OR
    (SELECT count(*) FROM p4_synthetic.files)<>0 OR
    (SELECT count(*) FROM p4_synthetic.file_versions)<>0 THEN
   RAISE EXCEPTION 'revoked user gained access to platform records';
 END IF;
END
$test$;
COMMIT;
RESET ROLE;

-- App users cannot edit logs. A separate INSERT-only service DB role
-- may write a redacted audit event with a current verified actor/tenant
-- context. No provider credentials, raw values or PII in this fixture.
SET ROLE p4_synthetic_ci_audit_writer;
BEGIN;
SELECT set_config('app.actor_id','user_demo_alice',true);
SELECT set_config('app.tenant_id','10000000-0000-4000-8000-000000000001',true);
INSERT INTO p4_synthetic.audit_logs(
 event_id,org_id,actor_user_id,action,object_type,object_ref,
 before_redacted,after_redacted)
VALUES (
 '10000000-0000-4000-8000-000000000041',
 '10000000-0000-4000-8000-000000000001',
 'user_demo_alice','team.created','team','team_demo_sales',
 '[REDACTED]','[REDACTED]');
DO $test$
BEGIN
 BEGIN
  UPDATE p4_synthetic.audit_logs SET action='membership.revoked'
   WHERE event_id='10000000-0000-4000-8000-000000000041';
  RAISE EXCEPTION 'audit writer updated existing entry';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
  DELETE FROM p4_synthetic.audit_logs WHERE
   event_id='10000000-0000-4000-8000-000000000041';
  RAISE EXCEPTION 'audit writer deleted existing entry';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END
$test$;
COMMIT;
RESET ROLE;

SET ROLE p4_synthetic_ci_runtime;
BEGIN;
SELECT set_config('app.actor_id','user_demo_alice',true);
SELECT set_config('app.tenant_id','10000000-0000-4000-8000-000000000001',true);
DO $test$
BEGIN
 IF (SELECT count(*) FROM p4_synthetic.audit_logs)<>1 OR
    NOT EXISTS(SELECT 1 FROM p4_synthetic.audit_logs
      WHERE before_redacted='[REDACTED]' AND after_redacted='[REDACTED]') THEN
  RAISE EXCEPTION 'owner audit event not redacted or not visible';
 END IF;
 BEGIN
  UPDATE p4_synthetic.audit_logs SET after_redacted='raw customer text'
    WHERE event_id='10000000-0000-4000-8000-000000000041';
  RAISE EXCEPTION 'runtime role modified audit log';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END
$test$;
COMMIT;

BEGIN;
SELECT set_config('app.actor_id','user_demo_alice',true);
SELECT set_config('app.tenant_id','10000000-0000-4000-8000-000000000002',true);
DO $test$
BEGIN
 IF (SELECT count(*) FROM p4_synthetic.audit_logs)<>0 THEN
  RAISE EXCEPTION 'cross-tenant audit disclosure';
 END IF;
END
$test$;
COMMIT;

DO $test$
BEGIN
 IF (SELECT count(*) FROM p4_synthetic.audit_logs)<>0 THEN
  RAISE EXCEPTION 'transaction-local audit context remained after COMMIT';
 END IF;
END
$test$;
SELECT 'P4.16-20 CI-only preference, app, audit and private file RLS PASS' AS result;
