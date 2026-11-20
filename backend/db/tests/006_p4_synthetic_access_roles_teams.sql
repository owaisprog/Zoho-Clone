-- P4.11–P4.15: real CI PostgreSQL role/RLS test; never Neon.
\set ON_ERROR_STOP on
DO $guard$
BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' THEN
  RAISE EXCEPTION 'P4 access test requires disposable CI database';
 END IF;
END
$guard$;
SET ROLE p4_synthetic_ci_runtime;
DO $guard$
BEGIN
 IF current_user<>'p4_synthetic_ci_runtime' OR
    (SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname=current_user) THEN
   RAISE EXCEPTION 'P4 access test must use non-owner non-bypass role';
 END IF;
END
$guard$;

DO $test$
BEGIN
 IF (SELECT count(*) FROM p4_synthetic.roles)<>0
    OR (SELECT count(*) FROM p4_synthetic.role_assignments)<>0
    OR (SELECT count(*) FROM p4_synthetic.teams)<>0 THEN
   RAISE EXCEPTION 'default deny on roles/teams failed';
 END IF;
END
$test$;

BEGIN;
SELECT set_config('app.actor_id','user_demo_bob',true);
SELECT set_config('app.tenant_id','10000000-0000-4000-8000-000000000001',true);
DO $test$
BEGIN
 IF (SELECT count(*) FROM p4_synthetic.teams)<>1 OR
    NOT EXISTS(SELECT 1 FROM p4_synthetic.teams WHERE id='team_demo_sales') OR
    (SELECT count(*) FROM p4_synthetic.role_assignments WHERE role_code='MEMBER')<>1 OR
    (SELECT count(*) FROM p4_synthetic.roles)<>2 THEN
   RAISE EXCEPTION 'member scoped teams/role visibility mismatch';
 END IF;
 IF EXISTS (SELECT 1 FROM p4_synthetic.role_assignments WHERE role_code='OWNER') THEN
   RAISE EXCEPTION 'member inherited reserved OWNER role';
 END IF;
 -- The app DB role must never mutate immutable role templates.
 BEGIN
  UPDATE p4_synthetic.roles SET label='Escalated'
   WHERE code='MEMBER' AND org_id='10000000-0000-4000-8000-000000000001';
  RAISE EXCEPTION 'runtime modified reserved role';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
  INSERT INTO p4_synthetic.roles(org_id,code,label,reserved)
   VALUES ('10000000-0000-4000-8000-000000000001','demo_admin','Bad Role',false);
  RAISE EXCEPTION 'runtime inserted new role without approved grants';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END
$test$;
COMMIT;

BEGIN;
SELECT set_config('app.actor_id','user_demo_alice',true);
SELECT set_config('app.tenant_id','10000000-0000-4000-8000-000000000001',true);
DO $test$
BEGIN
 IF (SELECT count(*) FROM p4_synthetic.teams)<>2 OR
    (SELECT count(*) FROM p4_synthetic.roles)<>2 OR
    (SELECT count(*) FROM p4_synthetic.role_assignments)<>1 THEN
   RAISE EXCEPTION 'owner team/role scope mismatch';
 END IF;
 IF (SELECT count(*) FROM p4_synthetic.role_permissions
     WHERE role_code='MEMBER' AND permission_code='org.members.manage')<>0 THEN
   RAISE EXCEPTION 'invalid reserved MEMBER privilege';
 END IF;
 IF (SELECT count(*) FROM p4_synthetic.role_permissions
     WHERE role_code='OWNER')<>7 THEN
   RAISE EXCEPTION 'owner grant catalogue incomplete';
 END IF;
END
$test$;
COMMIT;

-- Same owner can belong to two orgs; context restricts rows to org 2.
BEGIN;
SELECT set_config('app.actor_id','user_demo_alice',true);
SELECT set_config('app.tenant_id','10000000-0000-4000-8000-000000000002',true);
DO $test$
BEGIN
 IF (SELECT count(*) FROM p4_synthetic.teams)<>1 OR
    NOT EXISTS(SELECT 1 FROM p4_synthetic.teams WHERE id='team_demo_cedar') OR
    (SELECT count(*) FROM p4_synthetic.roles)<>2 THEN
   RAISE EXCEPTION 'cross-tenant owner access leak';
 END IF;
END
$test$;
COMMIT;

-- No cross-organization team references. CI setup superuser may try an
-- illegal tenant FK but transaction cannot commit the mismatch.
RESET ROLE;
DO $test$
BEGIN
 BEGIN
  INSERT INTO p4_synthetic.team_memberships(org_id,team_id,user_id)
   VALUES ('10000000-0000-4000-8000-000000000002',
           'team_demo_sales','user_demo_bob');
  RAISE EXCEPTION 'cross-org team assignment succeeded';
 EXCEPTION WHEN foreign_key_violation THEN NULL;
 END;
END
$test$;

-- Revoke a member in the disposable database, as setup superuser only;
-- verify restricted role sees no protected rows even with same GUCs.
UPDATE p4_synthetic.memberships SET active=false
 WHERE org_id='10000000-0000-4000-8000-000000000001'
   AND user_id='user_demo_bob';
SET ROLE p4_synthetic_ci_runtime;
BEGIN;
SELECT set_config('app.actor_id','user_demo_bob',true);
SELECT set_config('app.tenant_id','10000000-0000-4000-8000-000000000001',true);
DO $test$
BEGIN
 IF (SELECT count(*) FROM p4_synthetic.teams)<>0 OR
    (SELECT count(*) FROM p4_synthetic.roles)<>0 OR
    (SELECT count(*) FROM p4_synthetic.role_assignments)<>0 OR
    (SELECT count(*) FROM p4_synthetic.team_memberships)<>0 THEN
   RAISE EXCEPTION 'revoked member retained scoped access';
 END IF;
END
$test$;
COMMIT;

DO $test$
BEGIN
 IF (SELECT count(*) FROM p4_synthetic.roles)<>0 OR
    (SELECT count(*) FROM p4_synthetic.teams)<>0 THEN
   RAISE EXCEPTION 'transaction-local context survived COMMIT';
 END IF;
END
$test$;
SELECT 'P4.11-15 CI-only access roles teams and revocation RLS PASS' AS result;
