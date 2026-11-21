-- P4 Batch 07: restricted-role permission verdicts with ACTUAL PostgreSQL.
-- All test data is fictional, all checks run in a disposable CI DB only.
\set ON_ERROR_STOP on
DO $guard$
BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' OR current_user<>'demo_ci'
    OR (SELECT rolsuper OR rolbypassrls FROM pg_roles
        WHERE rolname='p4_v1_ci_runtime')
    OR (SELECT count(*) FROM pg_class c JOIN pg_namespace n
       ON n.oid=c.relnamespace WHERE n.nspname='p4_r7_ci'
       AND c.relkind='r' AND c.relrowsecurity AND c.relforcerowsecurity)<>5 THEN
   RAISE EXCEPTION 'P4 R7 not disposable CI / FORCE RLS missing';
 END IF;
END $guard$;
-- No cross-tenant team, assignment or owner foreign references.
DO $refs$
BEGIN
 BEGIN
   INSERT INTO p4_r7_ci.team_grants
    (organization_id,team_id,actor_id,active,managed) VALUES
    ('20000000-0000-4000-8000-000000000002',
     '30000000-0000-4000-8000-000000000001',
     '10000000-0000-4000-8000-0000000000a1',true,true);
   RAISE EXCEPTION 'cross-org team assignment was accepted';
 EXCEPTION WHEN foreign_key_violation THEN NULL;
 END;
 BEGIN
   INSERT INTO p4_r7_ci.leads(
     organization_id,id,owner_user_id,team_id,display_name) VALUES
    ('20000000-0000-4000-8000-000000000002',
     '80000000-0000-4000-8000-000000000099',
     '10000000-0000-4000-8000-0000000000a1',
     '30000000-0000-4000-8000-000000000001',
     'Demo Cross Org Attempt');
   RAISE EXCEPTION 'cross-org lead/team link was accepted';
 EXCEPTION WHEN foreign_key_violation THEN NULL;
 END;
END $refs$;
SET ROLE p4_v1_ci_runtime;
DO $defaultdeny$
BEGIN
 IF (SELECT count(*) FROM p4_r7_ci.memberships)<>0 OR
    (SELECT count(*) FROM p4_r7_ci.leads)<>0 OR
    (SELECT count(*) FROM p4_r7_ci.role_grants)<>0 OR
    (SELECT count(*) FROM p4_r7_ci.team_grants)<>0 THEN
   RAISE EXCEPTION 'P4 R7 default deny missing';
 END IF;
 IF has_column_privilege(current_user,'p4_r7_ci.leads','confidential_note','SELECT')
    OR has_table_privilege(current_user,'p4_r7_ci.leads','UPDATE')
    OR has_table_privilege(current_user,'p4_r7_ci.role_grants','INSERT') THEN
   RAISE EXCEPTION 'Runtime role has forbidden field or mutation privileges';
 END IF;
 BEGIN
   PERFORM confidential_note FROM p4_r7_ci.leads;
   RAISE EXCEPTION 'Runtime leaked private CRM note';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
   UPDATE p4_r7_ci.role_grants SET role_code='SALES_MANAGER';
   RAISE EXCEPTION 'Runtime can escalate its role';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $defaultdeny$;
-- ORG_OWNER may own the data row and still NOT have R1 CRM privileges.
BEGIN;
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000a1',true);
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000001',true);
DO $owner$
BEGIN
 IF (SELECT count(*) FROM p4_r7_ci.role_grants)<>1 OR
    (SELECT count(*) FROM p4_r7_ci.leads)<>0 THEN
   RAISE EXCEPTION 'ORG_OWNER incorrectly granted blanket CRM visibility';
 END IF;
END $owner$;
COMMIT;
BEGIN;
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000a1',true);
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000002',true);
DO $owner2$
BEGIN
 IF (SELECT count(*) FROM p4_r7_ci.leads)<>0 THEN
   RAISE EXCEPTION 'ORG_OWNER saw foreign/Cedar CRM records';
 END IF;
END $owner2$;
COMMIT;

-- The sales rep sees own, directly assigned and explicitly team-shared
-- records. Mere same-team placement does NOT expose the private lead.
BEGIN;
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000c1',true);
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000001',true);
DO $rep$
BEGIN
 IF (SELECT count(*) FROM p4_r7_ci.leads)<>3 OR
    EXISTS(SELECT 1 FROM p4_r7_ci.leads
      WHERE id='80000000-0000-4000-8000-000000000002'::uuid) OR
    NOT EXISTS(SELECT 1 FROM p4_r7_ci.leads
      WHERE id='80000000-0000-4000-8000-000000000001'::uuid) OR
    NOT EXISTS(SELECT 1 FROM p4_r7_ci.leads
      WHERE id='80000000-0000-4000-8000-000000000003'::uuid) OR
    NOT EXISTS(SELECT 1 FROM p4_r7_ci.leads
      WHERE id='80000000-0000-4000-8000-000000000004'::uuid) THEN
   RAISE EXCEPTION 'Private/team/assigned SALES_REP scope failed';
 END IF;
END $rep$;
COMMIT;
BEGIN;
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000d1',true);
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000001',true);
DO $manager$
BEGIN
 IF (SELECT count(*) FROM p4_r7_ci.leads)<>1 OR
    NOT EXISTS(SELECT 1 FROM p4_r7_ci.leads
      WHERE id='80000000-0000-4000-8000-000000000001'::uuid) THEN
   RAISE EXCEPTION 'SALES_MANAGER can read outside explicitly managed/shared team';
 END IF;
END $manager$;
COMMIT;
BEGIN;
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000c1',true);
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000002',true);
DO $foreign$
BEGIN
 IF (SELECT count(*) FROM p4_r7_ci.leads)<>0 THEN
   RAISE EXCEPTION 'SALES_REP accessed foreign tenant';
 END IF;
END $foreign$;
COMMIT;
RESET ROLE;
-- Removing the team grant must remove shared access on the next request.
UPDATE p4_r7_ci.team_grants SET active=false
 WHERE actor_id='10000000-0000-4000-8000-0000000000c1';
SET ROLE p4_v1_ci_runtime;
BEGIN;
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000c1',true);
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000001',true);
DO $no_team$
BEGIN
 IF (SELECT count(*) FROM p4_r7_ci.leads)<>2 THEN
   RAISE EXCEPTION 'Removed team assignment did not revoke shared access';
 END IF;
END $no_team$;
COMMIT;
RESET ROLE;
UPDATE p4_r7_ci.team_grants SET active=true
 WHERE actor_id='10000000-0000-4000-8000-0000000000c1';
UPDATE p4_r7_ci.app_grants SET active=false
 WHERE app_code='crm' AND organization_id='20000000-0000-4000-8000-000000000001';
SET ROLE p4_v1_ci_runtime;
BEGIN;
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000c1',true);
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000001',true);
DO $app_off$
BEGIN
 IF (SELECT count(*) FROM p4_r7_ci.leads)<>0 THEN
   RAISE EXCEPTION 'Disabled CRM entitlement did not revoke all record access';
 END IF;
END $app_off$;
COMMIT;
RESET ROLE;
UPDATE p4_r7_ci.app_grants SET active=true
 WHERE app_code='crm' AND organization_id='20000000-0000-4000-8000-000000000001';
UPDATE p4_r7_ci.role_grants SET active=false
 WHERE role_code='SALES_REP' AND actor_id='10000000-0000-4000-8000-0000000000c1';
SET ROLE p4_v1_ci_runtime;
BEGIN;
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000c1',true);
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000001',true);
DO $role_off$
BEGIN
 IF (SELECT count(*) FROM p4_r7_ci.leads)<>0 THEN
   RAISE EXCEPTION 'Removed SALES_REP role did not revoke all record access';
 END IF;
END $role_off$;
COMMIT;
RESET ROLE;
UPDATE p4_r7_ci.role_grants SET active=true
 WHERE role_code='SALES_REP' AND actor_id='10000000-0000-4000-8000-0000000000c1';
UPDATE p4_r7_ci.memberships SET active=false
 WHERE actor_id='10000000-0000-4000-8000-0000000000c1';
SET ROLE p4_v1_ci_runtime;
BEGIN;
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000c1',true);
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000001',true);
DO $membership_off$
BEGIN
 IF (SELECT count(*) FROM p4_r7_ci.leads)<>0 OR
    (SELECT count(*) FROM p4_r7_ci.role_grants)<>0 THEN
   RAISE EXCEPTION 'Revoked user retained role or record access';
 END IF;
END $membership_off$;
COMMIT;
RESET ROLE;
-- Restore to support subsequent safe pooled-client smoke.
UPDATE p4_r7_ci.memberships SET active=true
 WHERE actor_id='10000000-0000-4000-8000-0000000000c1';
SET ROLE p4_v1_ci_runtime;
DO $cleanup$
BEGIN
 IF (SELECT count(*) FROM p4_r7_ci.leads)<>0 THEN
   RAISE EXCEPTION 'Transaction-local R7 context survived after COMMIT';
 END IF;
END $cleanup$;
RESET ROLE;
SELECT 'P4 R7 P1.06 owner-no-CRM, sales scope, explicit team shares, field denial, revocation PASS' AS result;
