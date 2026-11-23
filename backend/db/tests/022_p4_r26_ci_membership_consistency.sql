-- P4 R26: role/membership read consistency in disposable synthetic PostgreSQL.
\set ON_ERROR_STOP on
DO $guard$
BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' OR current_user<>'demo_ci'
 OR NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='p4_r11_ci')
 THEN RAISE EXCEPTION 'P4_R26_CI_ONLY'; END IF;
END $guard$;
SET ROLE p4_v1_ci_runtime;
DO $empty$
BEGIN
 IF (SELECT count(*) FROM p4_r11_ci.read_member_roles())<>0
 THEN RAISE EXCEPTION 'P4_R26_MEMBER_ROWS_WITHOUT_CONTEXT'; END IF;
 BEGIN
  PERFORM email_verified FROM p4_v1_ci.identity_subjects LIMIT 1;
  RAISE EXCEPTION 'P4_R26_IDENTITY_SUBJECT_READ_ALLOWED';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $empty$;
BEGIN;
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000a1',true);
DO $owner$
BEGIN
 IF (SELECT count(*) FROM p4_r11_ci.read_member_roles())<>5
 OR (SELECT count(*) FROM p4_r11_ci.read_member_roles()
     WHERE role_code='ORG_OWNER')<>1
 THEN RAISE EXCEPTION 'P4_R26_OWNER_MEMBER_PROJECTION'; END IF;
END $owner$;
COMMIT;
BEGIN;
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000e1',true);
DO $admin$
BEGIN
 IF (SELECT count(*) FROM p4_r11_ci.read_member_roles())<>2
 OR EXISTS(SELECT 1 FROM p4_r11_ci.read_member_roles()
   WHERE role_code IN ('ORG_OWNER','ORG_ADMIN','SECURITY_REVIEWER','PLATFORM_SUPPORT'))
 THEN RAISE EXCEPTION 'P4_R26_ADMIN_ELEVATED_MEMBERS'; END IF;
END $admin$;
COMMIT;
BEGIN;
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000c1',true);
DO $rep$
BEGIN
 IF (SELECT count(*) FROM p4_r11_ci.read_member_roles())<>0
 THEN RAISE EXCEPTION 'P4_R26_REP_MEMBER_LIST'; END IF;
END $rep$;
COMMIT;
BEGIN;
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000002',true);
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000a1',true);
DO $other$
BEGIN
 IF (SELECT count(*) FROM p4_r11_ci.read_member_roles())<>1
 OR EXISTS(SELECT 1 FROM p4_r11_ci.read_member_roles()
    WHERE actor_id='10000000-0000-4000-8000-0000000000e1')
 THEN RAISE EXCEPTION 'P4_R26_CROSS_ORG_MEMBER_LEAK'; END IF;
END $other$;
COMMIT;
DO $cleanup$
BEGIN
 IF (SELECT count(*) FROM p4_r11_ci.read_member_roles())<>0
 THEN RAISE EXCEPTION 'P4_R26_POOLED_CONTEXT_LEAK'; END IF;
END $cleanup$;
RESET ROLE;
SELECT 'P4 R26 membership role projection, admin masking and scope PASS' AS result;
