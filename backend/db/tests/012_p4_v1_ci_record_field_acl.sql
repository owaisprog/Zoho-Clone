-- ADR 0007 P4.13 provisional record and field security acceptance.
-- NEVER use on owner Neon: disposable GitHub CI only.
\set ON_ERROR_STOP on
DO $guard$
BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' OR current_user<>'demo_ci'
    OR NOT EXISTS(SELECT 1 FROM pg_class
      WHERE oid='p4_v1_ci.team_memberships'::regclass) THEN
   RAISE EXCEPTION 'CI-only P4.13 ACL test database mismatch';
 END IF;
END $guard$;

SET ROLE p4_v1_ci_runtime;
DO $field$
BEGIN
 IF NOT has_any_column_privilege(current_user,'p4_v1_ci.crm_leads','SELECT')
    OR NOT has_column_privilege(current_user,'p4_v1_ci.crm_leads','display_name','SELECT')
    OR has_column_privilege(current_user,'p4_v1_ci.crm_leads','confidential_note','SELECT')
    OR has_column_privilege(current_user,'p4_v1_ci.file_metadata','private_object_locator','SELECT')
    OR has_table_privilege(current_user,'p4_v1_ci.crm_leads','INSERT')
    OR has_table_privilege(current_user,'p4_v1_ci.crm_leads','UPDATE') THEN
   RAISE EXCEPTION 'P4.13 prohibited SQL column or DML grant';
 END IF;
 BEGIN
   PERFORM confidential_note FROM p4_v1_ci.crm_leads LIMIT 1;
   RAISE EXCEPTION 'Private CRM note visible through raw SQL';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
   PERFORM private_object_locator FROM p4_v1_ci.file_metadata LIMIT 1;
   RAISE EXCEPTION 'Private storage locator visible through raw SQL';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $field$;

BEGIN;
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000c1',true);
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000001',true);
DO $team$
BEGIN
 IF (SELECT count(*) FROM p4_v1_ci.memberships)<>1
   OR (SELECT count(*) FROM p4_v1_ci.team_memberships)<>1
   OR (SELECT count(*) FROM p4_v1_ci.crm_leads)<>2
   OR (SELECT count(*) FROM p4_v1_ci.file_metadata)<>0
   OR (SELECT count(*) FROM p4_v1_ci.audit_logs)<>0 THEN
   RAISE EXCEPTION 'Member team-share scope leaked file/audit or denied assigned leads';
 END IF;
END $team$;
COMMIT;

BEGIN;
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000c1',true);
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000002',true);
DO $foreign$
BEGIN
 IF (SELECT count(*) FROM p4_v1_ci.memberships)<>0
   OR (SELECT count(*) FROM p4_v1_ci.team_memberships)<>0
   OR (SELECT count(*) FROM p4_v1_ci.crm_leads)<>0 THEN
   RAISE EXCEPTION 'Orchid member read Cedar tenant data';
 END IF;
END $foreign$;
COMMIT;
RESET ROLE;

-- Exercise three independent denial gates and leave final fixture intact.
DELETE FROM p4_v1_ci.team_memberships
 WHERE user_id='10000000-0000-4000-8000-0000000000c1';
SET ROLE p4_v1_ci_runtime;
BEGIN;
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000c1',true);
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000001',true);
DO $unassigned$
BEGIN
 IF (SELECT count(*) FROM p4_v1_ci.crm_leads)<>0 THEN
  RAISE EXCEPTION 'Unassigned team member retained shared lead access';
 END IF;
END $unassigned$;
COMMIT;
RESET ROLE;

INSERT INTO p4_v1_ci.team_memberships(organization_id,team_id,user_id)
 VALUES('20000000-0000-4000-8000-000000000001',
        '30000000-0000-4000-8000-000000000001',
        '10000000-0000-4000-8000-0000000000c1');
UPDATE p4_v1_ci.app_grants SET active=false
 WHERE organization_id='20000000-0000-4000-8000-000000000001'
 AND app_code='crm';
SET ROLE p4_v1_ci_runtime;
BEGIN;
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000c1',true);
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000001',true);
DO $unentitled$
BEGIN
 IF (SELECT count(*) FROM p4_v1_ci.crm_leads)<>0 THEN
  RAISE EXCEPTION 'Disabled CRM entitlement failed to block RLS';
 END IF;
END $unentitled$;
COMMIT;
RESET ROLE;

UPDATE p4_v1_ci.app_grants SET active=true
 WHERE organization_id='20000000-0000-4000-8000-000000000001'
 AND app_code='crm';
DELETE FROM p4_v1_ci.role_permissions
 WHERE organization_id='20000000-0000-4000-8000-000000000001'
 AND role_code='MEMBER' AND permission_code='crm.leads.read';
SET ROLE p4_v1_ci_runtime;
BEGIN;
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000c1',true);
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000001',true);
DO $nopermission$
BEGIN
 IF (SELECT count(*) FROM p4_v1_ci.crm_leads)<>0 THEN
  RAISE EXCEPTION 'Missing CRM permission failed to block record access';
 END IF;
END $nopermission$;
COMMIT;
RESET ROLE;

INSERT INTO p4_v1_ci.role_permissions(organization_id,role_code,permission_code)
 VALUES('20000000-0000-4000-8000-000000000001',
   'MEMBER','crm.leads.read');

-- Setup role checks restored fixture values, so later CI scripts can
-- verify both independent read authorities for the same member.
SELECT 'P4.13 CI-only team record RLS, entitlement, RBAC, SQL field grant denial PASS' AS result;
