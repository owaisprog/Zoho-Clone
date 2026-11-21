-- P4 R13 PostgreSQL privileges, tenant identity, current grants and cleanup.
\set ON_ERROR_STOP on
DO $guard$
BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' OR current_user<>'demo_ci'
   OR NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='p4_r13_ci') THEN
  RAISE EXCEPTION 'P4 R13 SQL assertions require disposable CI';
 END IF;
END $guard$;
SET ROLE p4_v1_ci_runtime;
DO $blank$
BEGIN
 IF (SELECT count(*) FROM p4_r13_ci.read_team_summaries())<>0 THEN
  RAISE EXCEPTION 'Team rows visible without actor/tenant';
 END IF;
 BEGIN
  PERFORM title FROM p4_v1_ci.teams LIMIT 1;
  RAISE EXCEPTION 'Direct team table SELECT unexpectedly permitted';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
  PERFORM token_hash_private FROM p4_r11_ci.invitation_status LIMIT 1;
  RAISE EXCEPTION 'Private invite tokens visible';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
  UPDATE p4_r7_ci.team_grants SET managed=true;
  RAISE EXCEPTION 'Team management write unexpectedly permitted';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $blank$;

BEGIN;
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000a1',true);
DO $owner$
BEGIN
 IF (SELECT count(*) FROM p4_r13_ci.read_team_summaries())<>1
   OR (SELECT member_count FROM p4_r13_ci.read_team_summaries() LIMIT 1)<>2
   OR (SELECT count(*) FROM p4_r13_ci.read_team_summaries()
        WHERE team_id='30000000-0000-4000-8000-000000000002')<>0 THEN
  RAISE EXCEPTION 'Owner team count or tenant isolation incorrect';
 END IF;
END $owner$;
COMMIT;
BEGIN;
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000002',true);
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000a1',true);
DO $cedar$
BEGIN
 IF (SELECT count(*) FROM p4_r13_ci.read_team_summaries())<>1
   OR (SELECT count(*) FROM p4_r13_ci.read_team_summaries()
       WHERE team_id='30000000-0000-4000-8000-000000000001')<>0 THEN
  RAISE EXCEPTION 'Cedar sees Orchid team';
 END IF;
END $cedar$;
COMMIT;
BEGIN;
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000d1',true);
DO $manager$
BEGIN
 IF (SELECT count(*) FROM p4_r13_ci.read_team_summaries())<>1
    OR NOT (SELECT is_manager FROM p4_r13_ci.read_team_summaries() LIMIT 1) THEN
   RAISE EXCEPTION 'Manager lacks own managed team';
 END IF;
END $manager$;
COMMIT;
BEGIN;
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000c1',true);
DO $rep$
BEGIN
 IF (SELECT count(*) FROM p4_r13_ci.read_team_summaries())<>0 THEN
  RAISE EXCEPTION 'Sales rep enumerated teams';
 END IF;
END $rep$;
COMMIT;
RESET ROLE;
-- Nonowner runtime sees each membership/revocation immediately.
UPDATE p4_r7_ci.team_grants SET managed=false
 WHERE organization_id='20000000-0000-4000-8000-000000000001'
   AND actor_id='10000000-0000-4000-8000-0000000000d1';
SET ROLE p4_v1_ci_runtime;
BEGIN;
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000d1',true);
DO $unmanaged$
BEGIN
 IF (SELECT count(*) FROM p4_r13_ci.read_team_summaries())<>0 THEN
  RAISE EXCEPTION 'Revoked management still sees teams';
 END IF;
END $unmanaged$;
COMMIT;
RESET ROLE;
UPDATE p4_r7_ci.team_grants SET managed=true
 WHERE organization_id='20000000-0000-4000-8000-000000000001'
   AND actor_id='10000000-0000-4000-8000-0000000000d1';
UPDATE p4_r7_ci.app_grants SET active=false
 WHERE organization_id='20000000-0000-4000-8000-000000000001'
   AND app_code='platform';
SET ROLE p4_v1_ci_runtime;
BEGIN;
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000a1',true);
DO $disabled$
BEGIN
 IF (SELECT count(*) FROM p4_r13_ci.read_team_summaries())<>0 THEN
  RAISE EXCEPTION 'Disabled platform entitlement still sees teams';
 END IF;
END $disabled$;
COMMIT;
RESET ROLE;
UPDATE p4_r7_ci.app_grants SET active=true
 WHERE organization_id='20000000-0000-4000-8000-000000000001'
   AND app_code='platform';
SET ROLE p4_v1_ci_runtime;
DO $cleanup$
BEGIN
 IF (SELECT count(*) FROM p4_r13_ci.read_team_summaries())<>0 THEN
  RAISE EXCEPTION 'Transaction-local RLS context leaked';
 END IF;
END $cleanup$;
RESET ROLE;
SELECT 'P4 R13 disposable PostgreSQL team isolation, revocation, grants and no-writes PASS' AS result;
