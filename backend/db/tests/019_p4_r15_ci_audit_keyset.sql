-- Batch 15 real PostgreSQL negative tests for audit data minimization.
\set ON_ERROR_STOP on
DO $guard$
BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' OR current_user<>'demo_ci'
 OR NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='p4_r15_ci') THEN
  RAISE EXCEPTION 'R15 SQL tests require disposable CI';
 END IF;
END $guard$;
SET ROLE p4_v1_ci_runtime;
DO $blank$
BEGIN
 IF (SELECT count(*) FROM p4_r15_ci.read_audit_page(NULL,21))<>0 THEN
  RAISE EXCEPTION 'R15 no tenant or actor leaked audit';
 END IF;
 BEGIN
  PERFORM raw_payload_private FROM p4_r11_ci.audit_status;
  RAISE EXCEPTION 'R15 raw audit payload accessible';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
  UPDATE p4_r11_ci.audit_status SET action='invitation.created';
  RAISE EXCEPTION 'R15 runtime audit write unexpectedly allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $blank$;
BEGIN;
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000a1',true);
DO $owner$
BEGIN
 IF (SELECT count(*) FROM p4_r15_ci.read_audit_page(NULL,21))<>1
  OR (SELECT count(*) FROM p4_r15_ci.read_audit_page(
    '70000000-0000-4000-8000-000000000001',21))<>0
  OR (SELECT count(*) FROM p4_r15_ci.read_audit_page(NULL,0))<>0
  OR (SELECT count(*) FROM p4_r15_ci.read_audit_page(NULL,22))<>0 THEN
  RAISE EXCEPTION 'R15 owner pagination boundary failed';
 END IF;
END $owner$;
COMMIT;
BEGIN;
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000002',true);
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000a1',true);
DO $cedar$
BEGIN
 IF (SELECT count(*) FROM p4_r15_ci.read_audit_page(NULL,21))<>1
  OR EXISTS(SELECT 1 FROM p4_r15_ci.read_audit_page(NULL,21)
    WHERE event_id='70000000-0000-4000-8000-000000000001') THEN
  RAISE EXCEPTION 'R15 cross-tenant audit leak';
 END IF;
END $cedar$;
COMMIT;
BEGIN;
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000f1',true);
DO $reviewer$
BEGIN
 IF (SELECT count(*) FROM p4_r15_ci.read_audit_page(NULL,21))<>1 THEN
  RAISE EXCEPTION 'R15 reviewer missed sanitized audit';
 END IF;
END $reviewer$;
COMMIT;
BEGIN;
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000e1',true);
DO $admin$
BEGIN
 IF (SELECT count(*) FROM p4_r15_ci.read_audit_page(NULL,21))<>0 THEN
  RAISE EXCEPTION 'R15 admin gained unapproved audit read';
 END IF;
END $admin$;
COMMIT;
BEGIN;
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000c1',true);
DO $rep$
BEGIN
 IF (SELECT count(*) FROM p4_r15_ci.read_audit_page(NULL,21))<>0 THEN
  RAISE EXCEPTION 'R15 sales rep enumerated audit';
 END IF;
END $rep$;
COMMIT;
BEGIN;
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000002',true);
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000f1',true);
DO $foreign$
BEGIN
 IF (SELECT count(*) FROM p4_r15_ci.read_audit_page(NULL,21))<>0 THEN
  RAISE EXCEPTION 'R15 foreign reviewer enumerated audit';
 END IF;
END $foreign$;
COMMIT;
RESET ROLE;
UPDATE p4_r7_ci.memberships SET active=false
 WHERE organization_id='20000000-0000-4000-8000-000000000001'
 AND actor_id='10000000-0000-4000-8000-0000000000f1';
SET ROLE p4_v1_ci_runtime;
BEGIN;
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000f1',true);
DO $revoked$
BEGIN
 IF (SELECT count(*) FROM p4_r15_ci.read_audit_page(NULL,21))<>0 THEN
  RAISE EXCEPTION 'R15 revoked reviewer retained audit access';
 END IF;
END $revoked$;
COMMIT;
RESET ROLE;
UPDATE p4_r7_ci.memberships SET active=true
 WHERE organization_id='20000000-0000-4000-8000-000000000001'
 AND actor_id='10000000-0000-4000-8000-0000000000f1';
UPDATE p4_r7_ci.app_grants SET active=false
 WHERE organization_id='20000000-0000-4000-8000-000000000001'
 AND app_code='platform';
SET ROLE p4_v1_ci_runtime;
BEGIN;
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000a1',true);
DO $unentitled$
BEGIN
 IF (SELECT count(*) FROM p4_r15_ci.read_audit_page(NULL,21))<>0 THEN
  RAISE EXCEPTION 'R15 disabled platform retained audit access';
 END IF;
END $unentitled$;
COMMIT;
RESET ROLE;
UPDATE p4_r7_ci.app_grants SET active=true
 WHERE organization_id='20000000-0000-4000-8000-000000000001'
 AND app_code='platform';
SET ROLE p4_v1_ci_runtime;
DO $cleanup$
BEGIN
 IF (SELECT count(*) FROM p4_r15_ci.read_audit_page(NULL,21))<>0 THEN
  RAISE EXCEPTION 'R15 transaction-local actor/tenant leaked';
 END IF;
END $cleanup$;
RESET ROLE;
SELECT 'P4 R15 restricted audit keyset, isolation and revocation PASS' AS result;
