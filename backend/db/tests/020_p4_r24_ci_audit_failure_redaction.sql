-- P4 R24: negative audit confidentiality and immutable-history proof.
-- Runs only in disposable GitHub PostgreSQL after existing R15 read grants.
\set ON_ERROR_STOP on
DO $guard$
BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci'
 OR current_user<>'demo_ci'
 OR NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='p4_r15_ci')
 THEN RAISE EXCEPTION 'P4_R24_DISPOSABLE_CI_ONLY'; END IF;
END $guard$;
SET ROLE p4_v1_ci_runtime;
DO $negative$
BEGIN
 -- No direct audit table reads, even of seemingly innocuous metadata.
 BEGIN
  PERFORM id FROM p4_r11_ci.audit_status;
  RAISE EXCEPTION 'P4_R24_DIRECT_AUDIT_READ_ALLOWED';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
  PERFORM raw_payload_private FROM p4_r11_ci.audit_status;
  RAISE EXCEPTION 'P4_R24_PRIVATE_AUDIT_PAYLOAD_ALLOWED';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
  DELETE FROM p4_r11_ci.audit_status;
  RAISE EXCEPTION 'P4_R24_AUDIT_DELETE_ALLOWED';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
  UPDATE p4_r11_ci.audit_status SET action='invitation.created';
  RAISE EXCEPTION 'P4_R24_AUDIT_UPDATE_ALLOWED';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
  INSERT INTO p4_r11_ci.audit_status DEFAULT VALUES;
  RAISE EXCEPTION 'P4_R24_AUDIT_INSERT_ALLOWED';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 IF (SELECT count(*) FROM p4_r15_ci.read_audit_page(NULL,21))<>0
 THEN RAISE EXCEPTION 'P4_R24_EMPTY_CONTEXT_LEAK'; END IF;
END $negative$;
RESET ROLE;
-- Superuser bootstrap's immutable audit trigger is a separate invariant.
DO $immutable$
BEGIN
 BEGIN
  UPDATE p4_r9_ci.change_audit SET before_active=before_active;
  RAISE EXCEPTION 'P4_R24_AUDIT_HISTORY_MUTABLE';
 EXCEPTION WHEN raise_exception THEN
  -- Only accept the expected trigger rejection, not our assertion exception.
  IF SQLERRM <> 'P4_R9_CI_AUDIT_IMMUTABLE'
   THEN RAISE; END IF;
 END;
END $immutable$;
SET ROLE p4_v1_ci_runtime;
BEGIN;
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000a1',true);
DO $projection$
BEGIN
 IF (SELECT count(*) FROM p4_r15_ci.read_audit_page(NULL,21))<>1
 OR (SELECT count(*) FROM p4_r15_ci.read_audit_page(NULL,0))<>0
 OR (SELECT count(*) FROM p4_r15_ci.read_audit_page(NULL,22))<>0
 OR EXISTS(
  SELECT 1 FROM p4_r15_ci.read_audit_page(NULL,21)
  WHERE org_id<>'20000000-0000-4000-8000-000000000001'
 )
 THEN RAISE EXCEPTION 'P4_R24_OWNER_PROJECTION_BOUNDARY_FAIL'; END IF;
END $projection$;
COMMIT;
BEGIN;
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000c1',true);
DO $rep$
BEGIN
 IF (SELECT count(*) FROM p4_r15_ci.read_audit_page(NULL,21))<>0
 THEN RAISE EXCEPTION 'P4_R24_SALES_REP_AUDIT_LEAK'; END IF;
END $rep$;
COMMIT;
DO $cleanup$
BEGIN
 IF (SELECT count(*) FROM p4_r15_ci.read_audit_page(NULL,21))<>0
 THEN RAISE EXCEPTION 'P4_R24_AUDIT_CONTEXT_LEAK'; END IF;
END $cleanup$;
RESET ROLE;
SELECT 'P4 R24 immutable and private audit SQL boundaries PASS' AS result;
