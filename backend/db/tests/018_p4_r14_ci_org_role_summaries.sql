-- Real disposable PostgreSQL P4 Batch 14 revocation and field minimization checks.
\set ON_ERROR_STOP on
DO $guard$
BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' OR current_user<>'demo_ci'
 OR NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='p4_r14_ci') THEN
  RAISE EXCEPTION 'P4 R14 tests only disposable CI';
 END IF;
END $guard$;
SET ROLE p4_v1_ci_runtime;
DO $blank$
BEGIN
 IF (SELECT count(*) FROM p4_r14_ci.read_organization())<>0 OR
   (SELECT count(*) FROM p4_r14_ci.read_role_summaries())<>0 THEN
  RAISE EXCEPTION 'R14 no context leaked organization or roles';
 END IF;
 BEGIN
  PERFORM display_name FROM p4_v1_ci.organizations LIMIT 1;
  RAISE EXCEPTION 'R14 direct org SELECT allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
  PERFORM external_subject FROM p4_v1_ci.identity_subjects LIMIT 1;
  RAISE EXCEPTION 'R14 identity subject SELECT allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
  UPDATE p4_r7_ci.role_grants SET active=true;
  RAISE EXCEPTION 'R14 role write allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $blank$;
BEGIN;
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000a1',true);
DO $owner$
BEGIN
 IF (SELECT count(*) FROM p4_r14_ci.read_organization())<>1 OR
   (SELECT display_name FROM p4_r14_ci.read_organization())<>'Demo Orchid' OR
   (SELECT count(*) FROM p4_r14_ci.read_role_summaries())<>5 OR
   (SELECT active_count FROM p4_r14_ci.read_role_summaries()
    WHERE role_code='ORG_OWNER')<>1 THEN
  RAISE EXCEPTION 'R14 Orchid owner metadata inaccurate';
 END IF;
END $owner$;
COMMIT;
BEGIN;
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000002',true);
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000a1',true);
DO $cedar$
BEGIN
 IF (SELECT display_name FROM p4_r14_ci.read_organization())<>'Demo Cedar'
    OR (SELECT count(*) FROM p4_r14_ci.read_role_summaries())<>1
    OR EXISTS(SELECT 1 FROM p4_r14_ci.read_role_summaries() WHERE role_code='ORG_ADMIN') THEN
  RAISE EXCEPTION 'R14 Cedar cross-tenant leak';
 END IF;
END $cedar$;
COMMIT;
BEGIN;
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000e1',true);
DO $admin$
BEGIN
 IF (SELECT display_name FROM p4_r14_ci.read_organization())<>'Demo Orchid'
   OR (SELECT count(*) FROM p4_r14_ci.read_role_summaries())<>2
   OR EXISTS(SELECT 1 FROM p4_r14_ci.read_role_summaries()
     WHERE role_code IN ('ORG_OWNER','ORG_ADMIN','SECURITY_REVIEWER','PLATFORM_SUPPORT')) THEN
  RAISE EXCEPTION 'R14 admin saw restricted role codes';
 END IF;
END $admin$;
COMMIT;
BEGIN;
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000f1',true);
DO $reviewer$
BEGIN
 IF (SELECT count(*) FROM p4_r14_ci.read_organization())<>1
    OR (SELECT display_name FROM p4_r14_ci.read_organization()) IS NOT NULL
    OR (SELECT count(*) FROM p4_r14_ci.read_role_summaries())<>5
    OR EXISTS(SELECT 1 FROM p4_r14_ci.read_role_summaries() WHERE active_count IS NOT NULL) THEN
  RAISE EXCEPTION 'R14 reviewer field count redaction failed';
 END IF;
END $reviewer$;
COMMIT;
BEGIN;
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000c1',true);
DO $rep$
BEGIN
 IF (SELECT count(*) FROM p4_r14_ci.read_organization())<>0 OR
    (SELECT count(*) FROM p4_r14_ci.read_role_summaries())<>0 THEN
   RAISE EXCEPTION 'R14 sales rep enumerated IAM metadata';
 END IF;
END $rep$;
COMMIT;
RESET ROLE;
-- Role revoke is a CI superuser fixture update, not a public role mutator.
-- R10's immutable role-change guard forbids direct fixture updates.
-- Test current grant denial in unit tests; test SQL membership revocation below.
UPDATE p4_r7_ci.memberships SET active=false
 WHERE organization_id='20000000-0000-4000-8000-000000000001'
 AND actor_id='10000000-0000-4000-8000-0000000000e1';
SET ROLE p4_v1_ci_runtime;
BEGIN;
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000e1',true);
DO $revoked_member$
BEGIN
 IF (SELECT count(*) FROM p4_r14_ci.read_organization())<>0 OR
    (SELECT count(*) FROM p4_r14_ci.read_role_summaries())<>0 THEN
  RAISE EXCEPTION 'Revoked admin membership retained IAM reads';
 END IF;
END $revoked_member$;
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
DO $app_off$
BEGIN
 IF (SELECT count(*) FROM p4_r14_ci.read_organization())<>0 OR
    (SELECT count(*) FROM p4_r14_ci.read_role_summaries())<>0 THEN
  RAISE EXCEPTION 'Disabled platform entitlement retained IAM';
 END IF;
END $app_off$;
COMMIT;
RESET ROLE;
UPDATE p4_r7_ci.app_grants SET active=true
 WHERE organization_id='20000000-0000-4000-8000-000000000001'
 AND app_code='platform';
SET ROLE p4_v1_ci_runtime;
DO $clean$
BEGIN
 IF (SELECT count(*) FROM p4_r14_ci.read_organization())<>0 OR
    (SELECT count(*) FROM p4_r14_ci.read_role_summaries())<>0 THEN
  RAISE EXCEPTION 'R14 pooled transaction context leaked';
 END IF;
END $clean$;
RESET ROLE;
SELECT 'P4 R14 CI-only policy-scoped organization and role reads PASS' AS result;
