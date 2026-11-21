-- P4.21-P4.25 disposable PostgreSQL isolation acceptance.
\set ON_ERROR_STOP on
DO $guard$
BEGIN
 IF current_database() <> 'zoho_clone_synthetic_ci' THEN
  RAISE EXCEPTION 'P4 continuity SQL test only allowed in disposable CI';
 END IF;
END
$guard$;
SET ROLE p4_synthetic_ci_runtime;
DO $role$
BEGIN
 IF current_user <> 'p4_synthetic_ci_runtime' OR
   (SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname=current_user) THEN
  RAISE EXCEPTION 'Restricted nonowner role required';
 END IF;
END
$role$;
DO $test$
BEGIN
 IF (SELECT count(*) FROM p4_synthetic.file_links)<>0 OR
    (SELECT count(*) FROM p4_synthetic.notifications)<>0 OR
    (SELECT count(*) FROM p4_synthetic.notification_preferences)<>0 OR
    (SELECT count(*) FROM p4_synthetic.export_jobs)<>0 OR
    (SELECT count(*) FROM p4_synthetic.deletion_jobs)<>0 THEN
  RAISE EXCEPTION 'Default-deny on P4 continuity tables failed';
 END IF;
 BEGIN
  PERFORM count(*) FROM p4_synthetic.platform_admin_grants;
  RAISE EXCEPTION 'Tenant runtime could inspect platform admin grants';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
  PERFORM count(*) FROM p4_synthetic.support_access_grants;
  RAISE EXCEPTION 'Tenant runtime could inspect support access grants';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END
$test$;
BEGIN;
SELECT set_config('app.actor_id','user_demo_alice',true);
SELECT set_config('app.tenant_id','10000000-0000-4000-8000-000000000001',true);
DO $test$
BEGIN
 IF (SELECT count(*) FROM p4_synthetic.file_links)<>1 OR
    (SELECT count(*) FROM p4_synthetic.notifications)<>1 OR
    (SELECT count(*) FROM p4_synthetic.notification_preferences)<>1 OR
    (SELECT count(*) FROM p4_synthetic.export_jobs)<>1 OR
    (SELECT count(*) FROM p4_synthetic.deletion_jobs)<>0 THEN
  RAISE EXCEPTION 'org1 file/recipient/owner closure isolation failed';
 END IF;
 BEGIN
  UPDATE p4_synthetic.notifications SET read_at=now();
  RAISE EXCEPTION 'Tenant runtime updated notifications';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
  DELETE FROM p4_synthetic.file_links;
  RAISE EXCEPTION 'Tenant runtime deleted file links';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
  INSERT INTO p4_synthetic.deletion_jobs(id,org_id,owner_user_id,status)
   VALUES('10000000-0000-4000-8000-000000000099','10000000-0000-4000-8000-000000000001','user_demo_alice','draft_only');
  RAISE EXCEPTION 'Tenant runtime submitted deletion';
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
 IF (SELECT count(*) FROM p4_synthetic.file_links)<>1 OR
    (SELECT count(*) FROM p4_synthetic.notifications)<>1 OR
    (SELECT count(*) FROM p4_synthetic.notification_preferences)<>1 OR
    (SELECT count(*) FROM p4_synthetic.export_jobs)<>0 OR
    (SELECT count(*) FROM p4_synthetic.deletion_jobs)<>1 THEN
  RAISE EXCEPTION 'same actor leaked P4 continuity data between orgs';
 END IF;
END
$test$;
COMMIT;
BEGIN;
SELECT set_config('app.actor_id','user_demo_bob',true);
SELECT set_config('app.tenant_id','10000000-0000-4000-8000-000000000001',true);
DO $test$
BEGIN
 IF (SELECT count(*) FROM p4_synthetic.file_links)<>0 OR
    (SELECT count(*) FROM p4_synthetic.notifications)<>0 OR
    (SELECT count(*) FROM p4_synthetic.notification_preferences)<>0 OR
    (SELECT count(*) FROM p4_synthetic.export_jobs)<>0 OR
    (SELECT count(*) FROM p4_synthetic.deletion_jobs)<>0 THEN
  RAISE EXCEPTION 'revoked member accessed P4 continuity data';
 END IF;
END
$test$;
COMMIT;
DO $test$
BEGIN
 IF (SELECT count(*) FROM p4_synthetic.notifications)<>0 THEN
  RAISE EXCEPTION 'transaction-local identity context leaked';
 END IF;
END
$test$;
RESET ROLE;
SELECT 'P4.21-25 disposable CI-only file, notification, support, and closure RLS PASS' AS result;
