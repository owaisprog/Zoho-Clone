-- P4 Batch 11, real disposable PostgreSQL tests, no owner Neon.
\set ON_ERROR_STOP on
DO $guard$
BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' OR current_user<>'demo_ci'
  OR NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='p4_r11_ci')
  OR (SELECT count(*) FROM pg_class c JOIN pg_namespace n
    ON n.oid=c.relnamespace
    WHERE n.nspname='p4_r11_ci' AND c.relkind='r'
      AND c.relrowsecurity AND c.relforcerowsecurity)<>2 THEN
  RAISE EXCEPTION 'P4 R11 only disposable CI and FORCE RLS';
 END IF;
END $guard$;
SET ROLE p4_v1_ci_runtime;
DO $no_context$
BEGIN
 IF (SELECT count(*) FROM p4_r11_ci.invitation_status)<>0
   OR (SELECT count(*) FROM p4_r11_ci.audit_status)<>0
   OR (SELECT count(*) FROM p4_r11_ci.read_member_roles())<>0 THEN
  RAISE EXCEPTION 'R11 no-context default deny failed';
 END IF;
 BEGIN
  PERFORM token_hash_private FROM p4_r11_ci.invitation_status LIMIT 1;
  RAISE EXCEPTION 'Private token leaked';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
  PERFORM recipient_email_private FROM p4_r11_ci.invitation_status LIMIT 1;
  RAISE EXCEPTION 'Private recipient email leaked';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
  PERFORM raw_payload_private FROM p4_r11_ci.audit_status LIMIT 1;
  RAISE EXCEPTION 'Raw audit payload leaked';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
  UPDATE p4_r11_ci.invitation_status SET status='accepted';
  RAISE EXCEPTION 'Runtime mutated invitation';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
  INSERT INTO p4_r11_ci.audit_status
   (organization_id,id,actor_user_id,action,occurred_at)
   VALUES('20000000-0000-4000-8000-000000000001',
     '70000000-0000-4000-8000-000000000099',
     '10000000-0000-4000-8000-0000000000a1','invitation.created',now());
  RAISE EXCEPTION 'Runtime wrote audit';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $no_context$;

BEGIN;
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000a1',true);
DO $owner$
BEGIN
 IF (SELECT count(*) FROM p4_r11_ci.invitation_status)<>1
   OR (SELECT count(*) FROM p4_r11_ci.audit_status)<>1
   OR (SELECT count(*) FROM p4_r11_ci.read_member_roles())<>5 THEN
  RAISE EXCEPTION 'R11 owner safe membership/invite/audit projection failed';
 END IF;
END $owner$;
COMMIT;
BEGIN;
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000002',true);
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000a1',true);
DO $cedar$
BEGIN
 IF (SELECT count(*) FROM p4_r11_ci.invitation_status)<>1 OR
   (SELECT count(*) FROM p4_r11_ci.audit_status)<>1 OR
   (SELECT count(*) FROM p4_r11_ci.read_member_roles())<>1 THEN
  RAISE EXCEPTION 'R11 Cedar owner cross-org isolation failed';
 END IF;
END $cedar$;
COMMIT;
BEGIN;
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000e1',true);
DO $admin$
BEGIN
 IF (SELECT count(*) FROM p4_r11_ci.invitation_status)<>1
   OR (SELECT count(*) FROM p4_r11_ci.audit_status)<>0
   OR (SELECT count(*) FROM p4_r11_ci.read_member_roles())<>2
   OR EXISTS (SELECT 1 FROM p4_r11_ci.read_member_roles()
     WHERE role_code IN ('ORG_OWNER','ORG_ADMIN','SECURITY_REVIEWER')) THEN
  RAISE EXCEPTION 'Admin saw restricted role or private audit metadata';
 END IF;
END $admin$;
COMMIT;
BEGIN;
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000f1',true);
DO $reviewer$
BEGIN
 IF (SELECT count(*) FROM p4_r11_ci.invitation_status)<>0
    OR (SELECT count(*) FROM p4_r11_ci.audit_status)<>1
    OR (SELECT count(*) FROM p4_r11_ci.read_member_roles())<>5 THEN
  RAISE EXCEPTION 'Reviewer did not respect sanitized audit/membership access';
 END IF;
END $reviewer$;
COMMIT;
BEGIN;
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000c1',true);
DO $rep$
BEGIN
 IF (SELECT count(*) FROM p4_r11_ci.invitation_status)<>0
   OR (SELECT count(*) FROM p4_r11_ci.audit_status)<>0
   OR (SELECT count(*) FROM p4_r11_ci.read_member_roles())<>0 THEN
  RAISE EXCEPTION 'SALES_REP enumerated admin/member/audit metadata';
 END IF;
END $rep$;
COMMIT;
BEGIN;
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000002',true);
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000f1',true);
DO $foreign$
BEGIN
 IF (SELECT count(*) FROM p4_r11_ci.audit_status)<>0
   OR (SELECT count(*) FROM p4_r11_ci.read_member_roles())<>0 THEN
  RAISE EXCEPTION 'Unassigned security reviewer queried Cedar';
 END IF;
END $foreign$;
COMMIT;
RESET ROLE;

UPDATE p4_r7_ci.memberships SET active=false
 WHERE organization_id='20000000-0000-4000-8000-000000000001'
   AND actor_id='10000000-0000-4000-8000-0000000000e1';
SET ROLE p4_v1_ci_runtime;
BEGIN;
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000e1',true);
DO $revoked$
BEGIN
 IF (SELECT count(*) FROM p4_r11_ci.invitation_status)<>0
   OR (SELECT count(*) FROM p4_r11_ci.read_member_roles())<>0 THEN
  RAISE EXCEPTION 'Revoked admin still has IAM read access';
 END IF;
END $revoked$;
COMMIT;
RESET ROLE;
UPDATE p4_r7_ci.memberships SET active=true
 WHERE organization_id='20000000-0000-4000-8000-000000000001'
   AND actor_id='10000000-0000-4000-8000-0000000000e1';

UPDATE p4_r7_ci.app_grants SET active=false
 WHERE organization_id='20000000-0000-4000-8000-000000000001'
   AND app_code='platform';
SET ROLE p4_v1_ci_runtime;
BEGIN;
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000a1',true);
DO $entitlement$
BEGIN
 IF (SELECT count(*) FROM p4_r11_ci.invitation_status)<>0
    OR (SELECT count(*) FROM p4_r11_ci.audit_status)<>0
    OR (SELECT count(*) FROM p4_r11_ci.read_member_roles())<>0 THEN
  RAISE EXCEPTION 'Disabled platform entitlement retained read capability';
 END IF;
END $entitlement$;
COMMIT;
RESET ROLE;
UPDATE p4_r7_ci.app_grants SET active=true
 WHERE organization_id='20000000-0000-4000-8000-000000000001'
   AND app_code='platform';
-- Re-check cleanup of transaction-local context in a previously used role.
SET ROLE p4_v1_ci_runtime;
DO $cleanup$
BEGIN
 IF (SELECT count(*) FROM p4_r11_ci.invitation_status)<>0 OR
    (SELECT count(*) FROM p4_r11_ci.audit_status)<>0 OR
    (SELECT count(*) FROM p4_r11_ci.read_member_roles())<>0 THEN
  RAISE EXCEPTION 'R11 transaction-local context leaked after commit';
 END IF;
END $cleanup$;
RESET ROLE;
SELECT 'P4 R11 CI-only IAM directory, invitation, audit least privilege and next-request revocation PASS' AS result;
