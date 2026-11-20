-- P4 Batch 09: atomic, immutable, tenant-scoped audit for CI-only role/team changes.
\set ON_ERROR_STOP on
DO $guard$
BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' OR current_user<>'demo_ci'
    OR NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='p4_r9_ci')
    OR (SELECT count(*) FROM p4_r9_ci.change_audit)<>0 THEN
  RAISE EXCEPTION 'P4 R9 audit requires pristine disposable CI database';
 END IF;
END $guard$;
-- Missing scoped actor MUST deny, even for CI setup principal.
DO $noactor$
BEGIN
 BEGIN
  UPDATE p4_r7_ci.role_grants SET active=false
   WHERE organization_id='20000000-0000-4000-8000-000000000001'
    AND actor_id='10000000-0000-4000-8000-0000000000c1' AND role_code='SALES_REP';
  RAISE EXCEPTION 'Missing authenticated actor was allowed';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'CI_ONLY_ROLE_TEAM_CHANGE_DENIED' THEN RAISE; END IF;
 END;
END $noactor$;

-- Same transaction contains role modification AND its audit record.
BEGIN;
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000a1',true);
UPDATE p4_r7_ci.role_grants SET active=false
 WHERE organization_id='20000000-0000-4000-8000-000000000001'
   AND actor_id='10000000-0000-4000-8000-0000000000c1'
   AND role_code='SALES_REP';
DO $atomic$
BEGIN
 IF (SELECT count(*) FROM p4_r9_ci.change_audit)<>1 OR
    NOT EXISTS(SELECT 1 FROM p4_r9_ci.change_audit
      WHERE entity_code='role_grant' AND target_ref='SALES_REP'
        AND before_active=true AND after_active=false
        AND actor_id='10000000-0000-4000-8000-0000000000a1'::uuid) THEN
  RAISE EXCEPTION 'Role change audit not present inside same transaction';
 END IF;
END $atomic$;
COMMIT;
-- Re-check DB row visibility for revoked role, never trust cached role.
SET ROLE p4_v1_ci_runtime;
BEGIN;
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000c1',true);
DO $role_revoke$
BEGIN
 IF (SELECT count(*) FROM p4_r7_ci.leads)<>0 THEN
  RAISE EXCEPTION 'Role change not enforced on next RLS read';
 END IF;
END $role_revoke$;
COMMIT;
RESET ROLE;

BEGIN;
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000a1',true);
UPDATE p4_r7_ci.role_grants SET active=true
 WHERE organization_id='20000000-0000-4000-8000-000000000001'
   AND actor_id='10000000-0000-4000-8000-0000000000c1'
   AND role_code='SALES_REP';
COMMIT;
DO $role_restore$
BEGIN
 IF (SELECT count(*) FROM p4_r9_ci.change_audit)<>2 THEN
  RAISE EXCEPTION 'Role restoration was not audited';
 END IF;
END $role_restore$;

BEGIN;
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000a1',true);
UPDATE p4_r7_ci.team_grants SET active=false
 WHERE organization_id='20000000-0000-4000-8000-000000000001'
   AND actor_id='10000000-0000-4000-8000-0000000000c1'
   AND team_id='30000000-0000-4000-8000-000000000001';
COMMIT;
SET ROLE p4_v1_ci_runtime;
BEGIN;
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000c1',true);
DO $team_revoke$
BEGIN
 IF (SELECT count(*) FROM p4_r7_ci.leads)<>2 THEN
  RAISE EXCEPTION 'Team deactivation did not hide shared lead';
 END IF;
END $team_revoke$;
COMMIT;
RESET ROLE;
BEGIN;
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000a1',true);
UPDATE p4_r7_ci.team_grants SET active=true
 WHERE organization_id='20000000-0000-4000-8000-000000000001'
   AND actor_id='10000000-0000-4000-8000-0000000000c1'
   AND team_id='30000000-0000-4000-8000-000000000001';
COMMIT;
DO $four$
BEGIN
 IF (SELECT count(*) FROM p4_r9_ci.change_audit)<>4 OR
    (SELECT count(*) FROM p4_r9_ci.change_audit
      WHERE entity_code='team_grant')<>2 OR
    EXISTS(SELECT 1 FROM p4_r9_ci.change_audit
      WHERE organization_id<>'20000000-0000-4000-8000-000000000001'::uuid)
 THEN RAISE EXCEPTION 'Team/role audit count or scope mismatch';
 END IF;
END $four$;

-- No-op changes generate NO audit event.
BEGIN;
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000a1',true);
UPDATE p4_r7_ci.role_grants SET active=true
 WHERE organization_id='20000000-0000-4000-8000-000000000001'
   AND actor_id='10000000-0000-4000-8000-0000000000c1'
   AND role_code='SALES_REP';
COMMIT;
DO $noop$
BEGIN
 IF (SELECT count(*) FROM p4_r9_ci.change_audit)<>4 THEN
  RAISE EXCEPTION 'No-op generated a false audit event';
 END IF;
END $noop$;

-- A rolled-back role mutation MUST also roll back its audit entry.
BEGIN;
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000a1',true);
UPDATE p4_r7_ci.role_grants SET active=false
 WHERE organization_id='20000000-0000-4000-8000-000000000001'
   AND actor_id='10000000-0000-4000-8000-0000000000c1'
   AND role_code='SALES_REP';
DO $inside$
BEGIN
 IF (SELECT count(*) FROM p4_r9_ci.change_audit)<>5 THEN
  RAISE EXCEPTION 'Rolled back transaction did not stage audit';
 END IF;
END $inside$;
ROLLBACK;
DO $after$
BEGIN
 IF (SELECT count(*) FROM p4_r9_ci.change_audit)<>4 OR
    NOT EXISTS(SELECT 1 FROM p4_r7_ci.role_grants
      WHERE role_code='SALES_REP' AND active
        AND actor_id='10000000-0000-4000-8000-0000000000c1'::uuid) THEN
  RAISE EXCEPTION 'Rolled back audit/role remained committed';
 END IF;
END $after$;

-- Team/role updates must be refused for impersonators and wrong orgs.
BEGIN;
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000c1',true);
DO $impersonate$
BEGIN
 BEGIN
  UPDATE p4_r7_ci.team_grants SET active=false
   WHERE organization_id='20000000-0000-4000-8000-000000000001'
     AND actor_id='10000000-0000-4000-8000-0000000000d1';
  RAISE EXCEPTION 'SALES_REP escalated role/team write';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'CI_ONLY_ROLE_TEAM_CHANGE_DENIED' THEN RAISE; END IF;
 END;
END $impersonate$;
ROLLBACK;

BEGIN;
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000002',true);
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000a1',true);
DO $wrong_org$
BEGIN
 BEGIN
  UPDATE p4_r7_ci.role_grants SET active=false
   WHERE organization_id='20000000-0000-4000-8000-000000000001'
     AND actor_id='10000000-0000-4000-8000-0000000000c1'
     AND role_code='SALES_REP';
  RAISE EXCEPTION 'Owner toggled another tenant through mismatched scope';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'CI_ONLY_ROLE_TEAM_CHANGE_DENIED' THEN RAISE; END IF;
 END;
END $wrong_org$;
ROLLBACK;

BEGIN;
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000a1',true);
DO $reserved$
BEGIN
 BEGIN
  UPDATE p4_r7_ci.role_grants SET active=false
   WHERE organization_id='20000000-0000-4000-8000-000000000001'
     AND actor_id='10000000-0000-4000-8000-0000000000a1'
     AND role_code='ORG_OWNER';
  RAISE EXCEPTION 'Reserved ORG_OWNER role was mutable';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'CI_ONLY_ROLE_TEAM_CHANGE_DENIED' THEN RAISE; END IF;
 END;
 BEGIN
  UPDATE p4_r7_ci.team_grants SET managed=true
   WHERE organization_id='20000000-0000-4000-8000-000000000001'
     AND actor_id='10000000-0000-4000-8000-0000000000c1';
  RAISE EXCEPTION 'Team management scope was mutable without approval';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'CI_ONLY_ROLE_TEAM_CHANGE_DENIED' THEN RAISE; END IF;
 END;
END $reserved$;
ROLLBACK;

-- Audits are immutable even to the setup role (except schema owner DROP,
-- which is a separate production role/backup decision and NOT tested here).
DO $immutable$
BEGIN
 BEGIN
  UPDATE p4_r9_ci.change_audit SET after_active=true WHERE before_active=true;
  RAISE EXCEPTION 'Audit history can be updated';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'P4_R9_CI_AUDIT_IMMUTABLE' THEN RAISE; END IF;
 END;
 BEGIN
  DELETE FROM p4_r9_ci.change_audit;
  RAISE EXCEPTION 'Audit history can be deleted';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'P4_R9_CI_AUDIT_IMMUTABLE' THEN RAISE; END IF;
 END;
 IF (SELECT count(*) FROM p4_r9_ci.change_audit)<>4 THEN
  RAISE EXCEPTION 'Audit log has been changed by denied actions';
 END IF;
END $immutable$;

SET ROLE p4_v1_ci_runtime;
DO $sealed$
BEGIN
 BEGIN
  PERFORM count(*) FROM p4_r9_ci.change_audit;
  RAISE EXCEPTION 'Runtime role enumerated private audit rows';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
  UPDATE p4_r7_ci.role_grants SET active=false;
  RAISE EXCEPTION 'Runtime role mutated another users permissions';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $sealed$;
RESET ROLE;
SELECT 'P4 R9 CI-only atomic role/team audit, rollback, actor checks, immutable history PASS' AS result;
