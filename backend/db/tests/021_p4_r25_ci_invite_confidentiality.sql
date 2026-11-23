-- P4 R25: CI-only invitation confidentiality / no-mutation proof.
\set ON_ERROR_STOP on
DO $guard$
BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci'
 OR current_user<>'demo_ci'
 OR NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='p4_r13_ci')
 THEN RAISE EXCEPTION 'P4_R25_DISPOSABLE_CI_ONLY'; END IF;
END $guard$;
SET ROLE p4_v1_ci_runtime;
DO $no_context$
BEGIN
 IF (SELECT count(*) FROM p4_r11_ci.invitation_status)<>0
 THEN RAISE EXCEPTION 'P4_R25_UNSCOPED_INVITES_EXPOSED'; END IF;
 BEGIN
  PERFORM token_hash_private FROM p4_r11_ci.invitation_status;
  RAISE EXCEPTION 'P4_R25_TOKEN_HASH_EXPOSED';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
  PERFORM recipient_email_private FROM p4_r11_ci.invitation_status;
  RAISE EXCEPTION 'P4_R25_RECIPIENT_EMAIL_EXPOSED';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
  UPDATE p4_r11_ci.invitation_status SET status='accepted';
  RAISE EXCEPTION 'P4_R25_UNAUTHORIZED_INVITE_UPDATE';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
  DELETE FROM p4_r11_ci.invitation_status;
  RAISE EXCEPTION 'P4_R25_UNAUTHORIZED_INVITE_DELETE';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
  INSERT INTO p4_r11_ci.invitation_status DEFAULT VALUES;
  RAISE EXCEPTION 'P4_R25_UNAUTHORIZED_INVITE_CREATE';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $no_context$;
BEGIN;
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000a1',true);
DO $owner$
BEGIN
 IF (SELECT count(*) FROM p4_r11_ci.invitation_status)<>1 OR
    (SELECT status FROM p4_r11_ci.invitation_status LIMIT 1)<>'pending' OR
    EXISTS(SELECT 1 FROM p4_r11_ci.invitation_status
      WHERE organization_id<>'20000000-0000-4000-8000-000000000001')
 THEN RAISE EXCEPTION 'P4_R25_OWNER_SCOPED_INVITE_READ_FAIL'; END IF;
END $owner$;
COMMIT;
BEGIN;
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000f1',true);
DO $reviewer$
BEGIN
 IF (SELECT count(*) FROM p4_r11_ci.invitation_status)<>0
 THEN RAISE EXCEPTION 'P4_R25_REVIEWER_UNAPPROVED_INVITE_READ'; END IF;
END $reviewer$;
COMMIT;
BEGIN;
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000c1',true);
DO $rep$
BEGIN
 IF (SELECT count(*) FROM p4_r11_ci.invitation_status)<>0
 THEN RAISE EXCEPTION 'P4_R25_SALES_ROLE_INVITE_READ'; END IF;
END $rep$;
COMMIT;
DO $clean$
BEGIN
 IF (SELECT count(*) FROM p4_r11_ci.invitation_status)<>0
 THEN RAISE EXCEPTION 'P4_R25_POOLED_CONTEXT_LEAK'; END IF;
END $clean$;
RESET ROLE;
SELECT 'P4 R25 restricted invitation secrets, tenant grants and no-writes PASS' AS result;
