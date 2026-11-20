-- ADR 0007: actual disposable PostgreSQL relational / RLS proof.
-- Uses setup superuser ONLY for intentional constraint violation checks.
-- All access tests MUST use p4_v1_ci_runtime (NOLOGIN, no BYPASSRLS).
\set ON_ERROR_STOP on
DO $guard$
BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' OR current_user<>'demo_ci'
    OR NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='p4_v1_ci') THEN
  RAISE EXCEPTION 'P4 v1 UUIDv4 isolation tests require disposable CI setup';
 END IF;
 IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='p4_v1_ci' AND c.relkind='r'
     AND c.relrowsecurity=true AND c.relforcerowsecurity=true)<>10 THEN
  RAISE EXCEPTION 'P4 v1 all ten tables must enable AND FORCE RLS';
 END IF;
 IF (SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname='p4_v1_ci_runtime') THEN
  RAISE EXCEPTION 'P4 v1 runtime role bypasses RLS';
 END IF;
 IF EXISTS(SELECT 1 FROM pg_class c
   WHERE c.relname='crm_leads' AND c.relnamespace='p4_v1_ci'::regnamespace
   AND c.relowner=(SELECT oid FROM pg_roles WHERE rolname='p4_v1_ci_runtime')) THEN
  RAISE EXCEPTION 'Runtime role owns business tables';
 END IF;
END $guard$;

-- Prove illegal UUID versions, cross-organization foreign references and
-- duplicate OIDC subjects / idempotency are rejected by PostgreSQL itself.
DO $constraints$
BEGIN
 BEGIN
  INSERT INTO p4_v1_ci.users(id,display_name) VALUES
   ('10000000-0000-1000-8000-0000000000c1','Demo Wrong UUID Version');
  RAISE EXCEPTION 'UUIDv1 accepted as an internal user ID';
 EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN
  INSERT INTO p4_v1_ci.crm_leads(organization_id,id,owner_user_id,team_id,display_name) VALUES
   ('20000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000099',
    '10000000-0000-4000-8000-0000000000a1','30000000-0000-4000-8000-000000000001','Demo Illegal Team');
  RAISE EXCEPTION 'Cross-org team foreign key accepted';
 EXCEPTION WHEN foreign_key_violation THEN NULL; END;
 BEGIN
  INSERT INTO p4_v1_ci.team_memberships(organization_id,team_id,user_id) VALUES
   ('20000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-0000000000a1');
  RAISE EXCEPTION 'Cross-org team membership accepted';
 EXCEPTION WHEN foreign_key_violation THEN NULL; END;
 BEGIN
  INSERT INTO p4_v1_ci.file_metadata(organization_id,id,lead_id,owner_user_id) VALUES
   ('20000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000099',
    '40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-0000000000a1');
  RAISE EXCEPTION 'Cross-org file link accepted';
 EXCEPTION WHEN foreign_key_violation THEN NULL; END;
 BEGIN
  INSERT INTO p4_v1_ci.file_metadata(organization_id,id,lead_id,owner_user_id) VALUES
   ('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000099',
    '40000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-0000000000a1');
  RAISE EXCEPTION 'File mismatched its lead owner';
 EXCEPTION WHEN foreign_key_violation THEN NULL; END;
 BEGIN
  INSERT INTO p4_v1_ci.outbox_events(organization_id,id,actor_user_id,lead_id,event_name,idempotency_key) VALUES
   ('20000000-0000-4000-8000-000000000002','60000000-0000-4000-8000-000000000099',
    '10000000-0000-4000-8000-0000000000a1','40000000-0000-4000-8000-000000000001',
    'file.scan.requested','demo_scan_foreign');
  RAISE EXCEPTION 'Outbox linked foreign org record';
 EXCEPTION WHEN foreign_key_violation THEN NULL; END;
 BEGIN
  INSERT INTO p4_v1_ci.outbox_events(organization_id,id,actor_user_id,lead_id,event_name,idempotency_key) VALUES
   ('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000099',
    '10000000-0000-4000-8000-0000000000a1','40000000-0000-4000-8000-000000000001',
    'file.scan.requested','demo_scan_001');
  RAISE EXCEPTION 'Duplicate org outbox idempotency accepted';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 BEGIN
  INSERT INTO p4_v1_ci.identity_subjects(issuer,external_subject,user_id,email_verified) VALUES
   ('https://demo.us.auth0.com/','auth0|demo-alice',
    '10000000-0000-4000-8000-0000000000b1',true);
  RAISE EXCEPTION 'Duplicate exact OIDC issuer+subject accepted';
 EXCEPTION WHEN unique_violation THEN NULL; END;
END $constraints$;

SET ROLE p4_v1_ci_runtime;
DO $defaultdeny$
BEGIN
 IF current_user<>'p4_v1_ci_runtime' OR
   (SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname=current_user) THEN
  RAISE EXCEPTION 'RLS test not running as a nonprivileged role';
 END IF;
 IF (SELECT count(*) FROM p4_v1_ci.organizations)<>0 OR
    (SELECT count(*) FROM p4_v1_ci.memberships)<>0 OR
    (SELECT count(*) FROM p4_v1_ci.crm_leads)<>0 OR
    (SELECT count(*) FROM p4_v1_ci.file_metadata)<>0 OR
    (SELECT count(*) FROM p4_v1_ci.audit_logs)<>0 THEN
  RAISE EXCEPTION 'P4 v1 RLS default deny failed without transaction context';
 END IF;
 BEGIN
  PERFORM count(*) FROM p4_v1_ci.identity_subjects;
  RAISE EXCEPTION 'Runtime leaked global OIDC mappings';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM count(*) FROM p4_v1_ci.users;
  RAISE EXCEPTION 'Runtime leaked global users';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM count(*) FROM p4_v1_ci.outbox_events;
  RAISE EXCEPTION 'Runtime leaked outbox payload metadata';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM count(*) FROM p4_v1_ci.teams;
  RAISE EXCEPTION 'Runtime leaked team table';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  UPDATE p4_v1_ci.crm_leads SET version=version+1;
  RAISE EXCEPTION 'Runtime mutated tenant records';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  DELETE FROM p4_v1_ci.file_metadata;
  RAISE EXCEPTION 'Runtime deleted private file metadata';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $defaultdeny$;

-- One global user is owner in both organizations, but one transaction
-- sees only its selected tenant (never a union of both).
BEGIN;
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000a1',true);
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000001',true);
DO $tenant_a$
BEGIN
 IF (SELECT count(*) FROM p4_v1_ci.organizations)<>1 OR
    (SELECT count(*) FROM p4_v1_ci.memberships)<>1 OR
    (SELECT count(*) FROM p4_v1_ci.crm_leads)<>2 OR
    (SELECT count(*) FROM p4_v1_ci.file_metadata)<>1 OR
    (SELECT count(*) FROM p4_v1_ci.audit_logs)<>1 OR
    EXISTS(SELECT 1 FROM p4_v1_ci.organizations WHERE slug='demo-cedar') THEN
  RAISE EXCEPTION 'Owner tenant A isolation or record visibility failed';
 END IF;
END $tenant_a$;
COMMIT;
DO $cleanup$
BEGIN
 IF (SELECT count(*) FROM p4_v1_ci.crm_leads)<>0 THEN
  RAISE EXCEPTION 'Transaction-local GUC leaked after COMMIT';
 END IF;
END $cleanup$;

BEGIN;
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000a1',true);
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000002',true);
DO $tenant_b$
BEGIN
 IF (SELECT count(*) FROM p4_v1_ci.organizations)<>1 OR
    (SELECT count(*) FROM p4_v1_ci.memberships)<>1 OR
    (SELECT count(*) FROM p4_v1_ci.crm_leads)<>1 OR
    (SELECT count(*) FROM p4_v1_ci.file_metadata)<>1 OR
    (SELECT count(*) FROM p4_v1_ci.audit_logs)<>0 OR
    NOT EXISTS(SELECT 1 FROM p4_v1_ci.organizations WHERE slug='demo-cedar') THEN
  RAISE EXCEPTION 'Owner tenant B isolation failed';
 END IF;
END $tenant_b$;
COMMIT;

-- Member B cannot see owner A's records even in the correct org.
BEGIN;
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000b1',true);
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000001',true);
DO $member$
BEGIN
 IF (SELECT count(*) FROM p4_v1_ci.crm_leads)<>1 OR
    NOT EXISTS(SELECT 1 FROM p4_v1_ci.crm_leads WHERE display_name='Demo Bob Lead') OR
    (SELECT count(*) FROM p4_v1_ci.file_metadata)<>0 OR
    (SELECT count(*) FROM p4_v1_ci.audit_logs)<>0 THEN
  RAISE EXCEPTION 'Member access leaked owner records or file metadata';
 END IF;
END $member$;
COMMIT;

-- Requested org B cannot be granted by an authenticated ID that only
-- belongs to org A. No client role/org header can make this pass.
BEGIN;
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000b1',true);
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000002',true);
DO $foreign$
BEGIN
 IF (SELECT count(*) FROM p4_v1_ci.organizations)<>0 OR
    (SELECT count(*) FROM p4_v1_ci.crm_leads)<>0 OR
    (SELECT count(*) FROM p4_v1_ci.file_metadata)<>0 THEN
  RAISE EXCEPTION 'Foreign org actor gained tenant access';
 END IF;
END $foreign$;
COMMIT;

-- Revocation is applied by setup-only fixture role. The same protected
-- access must immediately fail after membership becomes inactive.
RESET ROLE;
UPDATE p4_v1_ci.memberships SET active=false
 WHERE organization_id='20000000-0000-4000-8000-000000000001'
   AND user_id='10000000-0000-4000-8000-0000000000b1';
SET ROLE p4_v1_ci_runtime;
BEGIN;
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000b1',true);
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000001',true);
DO $revoked$
BEGIN
 IF (SELECT count(*) FROM p4_v1_ci.memberships)<>0 OR
    (SELECT count(*) FROM p4_v1_ci.organizations)<>0 OR
    (SELECT count(*) FROM p4_v1_ci.crm_leads)<>0 OR
    (SELECT count(*) FROM p4_v1_ci.file_metadata)<>0 THEN
  RAISE EXCEPTION 'Revoked user remained authorized';
 END IF;
END $revoked$;
COMMIT;

-- A ROLLBACK must also discard requested actor and tenant scopes.
BEGIN;
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000a1',true);
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000001',true);
DO $pre_rollback$
BEGIN
 IF (SELECT count(*) FROM p4_v1_ci.organizations)<>1 THEN
  RAISE EXCEPTION 'Test setup failed before rollback';
 END IF;
END $pre_rollback$;
ROLLBACK;
DO $post_rollback$
BEGIN
 IF (SELECT count(*) FROM p4_v1_ci.organizations)<>0 THEN
  RAISE EXCEPTION 'Transaction-local scope leaked after ROLLBACK';
 END IF;
END $post_rollback$;
RESET ROLE;
SELECT 'P4 architecture v1 CI-only UUIDv4 tenant composite FK + FORCE RLS PASS' AS result;
