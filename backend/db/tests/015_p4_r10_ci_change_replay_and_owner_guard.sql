-- P4 Batch 10: actual disposable PostgreSQL, strict synthetic commands.
-- Not proof of live audited writes, Auth0, owner transfer, or production.
\set ON_ERROR_STOP on
DO $guard$
BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' OR current_user<>'demo_ci'
    OR NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='p4_r10_ci')
    OR (SELECT count(*) FROM p4_r10_ci.command_log)<>0
    OR (SELECT count(*) FROM p4_r9_ci.change_audit)<>4 THEN
  RAISE EXCEPTION 'P4 R10 SQL test requires prior fresh CI 014 fixtures';
 END IF;
END $guard$;
DO $no_context$
BEGIN
 BEGIN
  PERFORM p4_r10_ci.apply_fixture_toggle(
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-0000000000a1',
    '10000000-0000-4000-8000-0000000000c1',
    'role_grant','SALES_REP',true,false,0,
    '90000000-0000-4000-8000-000000000001');
  RAISE EXCEPTION 'Missing actor/tenant context accepted';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'P4_R10_CHANGE_DENIED' THEN RAISE; END IF;
 END;
END $no_context$;

BEGIN;
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000a1',true);
DO $revoke_and_replay$
DECLARE v text;
BEGIN
 v:=p4_r10_ci.apply_fixture_toggle(
   '20000000-0000-4000-8000-000000000001',
   '10000000-0000-4000-8000-0000000000a1',
   '10000000-0000-4000-8000-0000000000c1',
   'role_grant','SALES_REP',true,false,0,
   '90000000-0000-4000-8000-000000000001');
 IF v<>'APPLIED' OR (SELECT count(*) FROM p4_r10_ci.command_log)<>1
   OR (SELECT count(*) FROM p4_r9_ci.change_audit)<>5
   OR NOT EXISTS(SELECT 1 FROM p4_r7_ci.role_grants
       WHERE role_code='SALES_REP' AND active=false AND revision=1
       AND actor_id='10000000-0000-4000-8000-0000000000c1') THEN
  RAISE EXCEPTION 'Atomic command/audit/revision failed';
 END IF;
 v:=p4_r10_ci.apply_fixture_toggle(
   '20000000-0000-4000-8000-000000000001',
   '10000000-0000-4000-8000-0000000000a1',
   '10000000-0000-4000-8000-0000000000c1',
   'role_grant','SALES_REP',true,false,0,
   '90000000-0000-4000-8000-000000000001');
 IF v<>'REPLAY_NO_CHANGE' OR (SELECT count(*) FROM p4_r10_ci.command_log)<>1
  OR (SELECT count(*) FROM p4_r9_ci.change_audit)<>5 THEN
  RAISE EXCEPTION 'Idempotency replay created duplicate audit or grant';
 END IF;
 BEGIN
  PERFORM p4_r10_ci.apply_fixture_toggle(
   '20000000-0000-4000-8000-000000000001',
   '10000000-0000-4000-8000-0000000000a1',
   '10000000-0000-4000-8000-0000000000c1',
   'role_grant','SALES_REP',false,true,1,
   '90000000-0000-4000-8000-000000000001');
  RAISE EXCEPTION 'Reused request with conflicting payload accepted';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'P4_R10_REPLAY_CONFLICT' THEN RAISE; END IF;
 END;
END $revoke_and_replay$;
COMMIT;

SET ROLE p4_v1_ci_runtime;
BEGIN;
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000c1',true);
DO $role_revoked$
BEGIN
 IF (SELECT count(*) FROM p4_r7_ci.leads)<>0 THEN
  RAISE EXCEPTION 'Role command did not revoke next-request CRM access';
 END IF;
 BEGIN
  PERFORM p4_r10_ci.apply_fixture_toggle(
   '20000000-0000-4000-8000-000000000001',
   '10000000-0000-4000-8000-0000000000a1',
   '10000000-0000-4000-8000-0000000000c1',
   'role_grant','SALES_REP',false,true,1,
   '90000000-0000-4000-8000-000000000002');
  RAISE EXCEPTION 'Runtime was allowed to call privileged fake mutation';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $role_revoked$;
COMMIT;
RESET ROLE;

BEGIN;
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000a1',true);
DO $restore_role$
BEGIN
 IF p4_r10_ci.apply_fixture_toggle(
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-0000000000a1',
    '10000000-0000-4000-8000-0000000000c1',
    'role_grant','SALES_REP',false,true,1,
    '90000000-0000-4000-8000-000000000002')<>'APPLIED' THEN
   RAISE EXCEPTION 'Cannot restore fictional role';
 END IF;
END $restore_role$;
COMMIT;

BEGIN;
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000a1',true);
DO $team_toggle$
BEGIN
 IF p4_r10_ci.apply_fixture_toggle(
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-0000000000a1',
    '10000000-0000-4000-8000-0000000000c1',
    'team_grant','30000000-0000-4000-8000-000000000001',
    true,false,0,
    '90000000-0000-4000-8000-000000000003')<>'APPLIED' THEN
   RAISE EXCEPTION 'Cannot toggle existing team assignment';
 END IF;
END $team_toggle$;
COMMIT;
SET ROLE p4_v1_ci_runtime;
BEGIN;
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000c1',true);
DO $team_revoked$
BEGIN
 IF (SELECT count(*) FROM p4_r7_ci.leads)<>2 THEN
  RAISE EXCEPTION 'Team command failed next-read shared lead revocation';
 END IF;
END $team_revoked$;
COMMIT;
RESET ROLE;
BEGIN;
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000a1',true);
DO $team_restore$
BEGIN
 IF p4_r10_ci.apply_fixture_toggle(
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-0000000000a1',
    '10000000-0000-4000-8000-0000000000c1',
    'team_grant','30000000-0000-4000-8000-000000000001',
    false,true,1,
    '90000000-0000-4000-8000-000000000004')<>'APPLIED' THEN
   RAISE EXCEPTION 'Cannot restore team grant';
 END IF;
END $team_restore$;
COMMIT;

-- The exact optimistic revision must match. Failure may not produce a
-- command or audit event (which could leak hidden state).
BEGIN;
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000a1',true);
DO $unsafe$
BEGIN
 BEGIN
  PERFORM p4_r10_ci.apply_fixture_toggle(
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-0000000000a1',
    '10000000-0000-4000-8000-0000000000c1',
    'role_grant','SALES_REP',true,false,0,
    '90000000-0000-4000-8000-000000000005');
  RAISE EXCEPTION 'Stale revision accepted';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'P4_R10_VERSION_CONFLICT' THEN RAISE; END IF;
 END;
 BEGIN
  PERFORM p4_r10_ci.apply_fixture_toggle(
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-0000000000a1',
    '10000000-0000-4000-8000-0000000000c1',
    'role_grant','ORG_OWNER',true,false,0,
    '90000000-0000-4000-8000-000000000006');
  RAISE EXCEPTION 'Owner role mutation accepted';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'P4_R10_CHANGE_DENIED' THEN RAISE; END IF;
 END;
 BEGIN
  PERFORM p4_r10_ci.apply_fixture_toggle(
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-0000000000a1',
    '10000000-0000-4000-8000-0000000000c1',
    'team_grant','30000000-0000-4000-8000-000000000099',
    true,false,0,
    '90000000-0000-4000-8000-000000000007');
  RAISE EXCEPTION 'Foreign/unknown team assignment accepted';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'P4_R10_VERSION_CONFLICT' THEN RAISE; END IF;
 END;
 BEGIN
  UPDATE p4_r7_ci.role_grants SET active=false
   WHERE organization_id='20000000-0000-4000-8000-000000000001'
    AND actor_id='10000000-0000-4000-8000-0000000000a1'
    AND role_code='ORG_OWNER';
  RAISE EXCEPTION 'Owner role revoked without transfer';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'P4_R10_OWNER_TRANSFER_NOT_APPROVED' THEN RAISE; END IF;
 END;
 BEGIN
  UPDATE p4_r7_ci.memberships SET active=false
   WHERE organization_id='20000000-0000-4000-8000-000000000001'
    AND actor_id='10000000-0000-4000-8000-0000000000a1';
  RAISE EXCEPTION 'Last owner membership deactivated';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'P4_R10_OWNER_TRANSFER_NOT_APPROVED' THEN RAISE; END IF;
 END;
 IF (SELECT count(*) FROM p4_r10_ci.command_log)<>4 OR
    (SELECT count(*) FROM p4_r9_ci.change_audit)<>8 THEN
  RAISE EXCEPTION 'Denied action added audit/command event';
 END IF;
END $unsafe$;
COMMIT;

-- Atomic rollback of the only supported command path.
BEGIN;
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000a1',true);
DO $rollback$
BEGIN
 IF p4_r10_ci.apply_fixture_toggle(
   '20000000-0000-4000-8000-000000000001',
   '10000000-0000-4000-8000-0000000000a1',
   '10000000-0000-4000-8000-0000000000c1',
   'role_grant','SALES_REP',true,false,2,
   '90000000-0000-4000-8000-000000000008')<>'APPLIED' THEN
  RAISE EXCEPTION 'Failed to stage rollback command';
 END IF;
 IF (SELECT count(*) FROM p4_r10_ci.command_log)<>5 OR
    (SELECT count(*) FROM p4_r9_ci.change_audit)<>9 THEN
  RAISE EXCEPTION 'Command/audit are not atomic before rollback';
 END IF;
END $rollback$;
ROLLBACK;
DO $after_rollback$
BEGIN
 IF (SELECT count(*) FROM p4_r10_ci.command_log)<>4 OR
    (SELECT count(*) FROM p4_r9_ci.change_audit)<>8
    OR NOT EXISTS(SELECT 1 FROM p4_r7_ci.role_grants
      WHERE organization_id='20000000-0000-4000-8000-000000000001'
        AND actor_id='10000000-0000-4000-8000-0000000000c1'
        AND role_code='SALES_REP' AND active=true AND revision=2) THEN
  RAISE EXCEPTION 'Rollback left command/audit/grant mutations';
 END IF;
END $after_rollback$;

-- A forged verified actor or foreign scope cannot use the fake command.
BEGIN;
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000c1',true);
DO $attacker$
BEGIN
 BEGIN
  PERFORM p4_r10_ci.apply_fixture_toggle(
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-0000000000c1',
    '10000000-0000-4000-8000-0000000000d1',
    'role_grant','SALES_MANAGER',true,false,0,
    '90000000-0000-4000-8000-000000000009');
  RAISE EXCEPTION 'Rep became role administrator';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'P4_R10_CHANGE_DENIED' THEN RAISE; END IF;
 END;
END $attacker$;
ROLLBACK;
BEGIN;
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000002',true);
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000a1',true);
DO $foreign$
BEGIN
 BEGIN
  PERFORM p4_r10_ci.apply_fixture_toggle(
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-0000000000a1',
    '10000000-0000-4000-8000-0000000000c1',
    'role_grant','SALES_REP',true,false,2,
    '90000000-0000-4000-8000-000000000010');
  RAISE EXCEPTION 'Cedar actor changed Orchid role';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'P4_R10_CHANGE_DENIED' THEN RAISE; END IF;
 END;
END $foreign$;
ROLLBACK;
SET ROLE p4_v1_ci_runtime;
DO $sealed$
BEGIN
 BEGIN
  PERFORM count(*) FROM p4_r10_ci.command_log;
  RAISE EXCEPTION 'Tenant runtime enumerated command log';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
  PERFORM count(*) FROM p4_r9_ci.change_audit;
  RAISE EXCEPTION 'Tenant runtime enumerated private audit';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $sealed$;
RESET ROLE;
DO $immutable$
BEGIN
 BEGIN
  DELETE FROM p4_r10_ci.command_log;
  RAISE EXCEPTION 'Command log could be erased';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'P4_R10_COMMAND_LOG_IMMUTABLE' THEN RAISE; END IF;
 END;
END $immutable$;
SELECT 'P4 R10 CI-only owner guard, idempotent command, stale-version denial, atomic audit and rollback PASS' AS result;
