-- CI-only validation of segregated identity and tenant app/permission roles.
\set ON_ERROR_STOP on
DO $guards$
BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' OR current_user<>'demo_ci' THEN
   RAISE EXCEPTION 'Disposable P4 CI only';
 END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN
      ('p4_v1_ci_identity_owner','p4_v1_ci_identity_lookup','p4_v1_ci_runtime')
   AND (rolsuper OR rolbypassrls OR rolcanlogin)) THEN
   RAISE EXCEPTION 'P4 V1 lookup/runtime roles must not login, own elevated access or bypass RLS';
 END IF;
 IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='p4_v1_ci' AND c.relkind='r'
       AND c.relrowsecurity AND c.relforcerowsecurity)<>12 THEN
   RAISE EXCEPTION 'P4 V1 all twelve tables must FORCE RLS';
 END IF;
END $guards$;
SET ROLE p4_v1_ci_identity_lookup;
DO $identity$
DECLARE u uuid;
BEGIN
 SELECT s.user_id INTO u FROM p4_v1_ci.lookup_verified_subject(
   'https://demo.us.auth0.com/','auth0|demo-alice') s;
 IF u IS DISTINCT FROM '10000000-0000-4000-8000-0000000000a1'::uuid THEN
   RAISE EXCEPTION 'Verified exact Auth0 mapping failed';
 END IF;
 IF EXISTS(SELECT 1 FROM p4_v1_ci.lookup_verified_subject(
   'https://demo.us.auth0.com/','auth0|unknown')) OR
    EXISTS(SELECT 1 FROM p4_v1_ci.lookup_verified_subject(
   'https://other.us.auth0.com/','auth0|demo-alice')) THEN
    RAISE EXCEPTION 'Unknown or wrong issuer returned a mapped identity';
 END IF;
 BEGIN
   PERFORM count(*) FROM p4_v1_ci.identity_subjects;
   RAISE EXCEPTION 'Lookup role can enumerate identity table';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
   PERFORM count(*) FROM p4_v1_ci.crm_leads;
   RAISE EXCEPTION 'Lookup role can query tenant CRM';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
   PERFORM count(*) FROM p4_v1_ci.memberships;
   RAISE EXCEPTION 'Lookup role can query tenant memberships';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $identity$;
RESET ROLE;
-- Never allow public or tenant runtime to call identity lookup.
SET ROLE p4_v1_ci_runtime;
DO $runtime$
BEGIN
 BEGIN
   PERFORM * FROM p4_v1_ci.lookup_verified_subject(
     'https://demo.us.auth0.com/','auth0|demo-alice');
   RAISE EXCEPTION 'Tenant runtime role may read identity mapping';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 IF (SELECT count(*) FROM p4_v1_ci.app_grants)<>0 OR
    (SELECT count(*) FROM p4_v1_ci.role_permissions)<>0 THEN
   RAISE EXCEPTION 'App/permission tables exposed without tenant context';
 END IF;
 BEGIN
   UPDATE p4_v1_ci.app_grants SET active=true WHERE app_code='teams';
   RAISE EXCEPTION 'Runtime role can update entitlements';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
   INSERT INTO p4_v1_ci.role_permissions
     (organization_id,role_code,permission_code)
     VALUES('20000000-0000-4000-8000-000000000001','MEMBER','teams.read');
   RAISE EXCEPTION 'Runtime role can escalate role grants';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $runtime$;
BEGIN;
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000a1',true);
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000001',true);
DO $orchid$
BEGIN
 IF (SELECT count(*) FROM p4_v1_ci.app_grants)<>2 OR
    (SELECT count(*) FROM p4_v1_ci.role_permissions)<>2 OR
    NOT EXISTS(SELECT 1 FROM p4_v1_ci.app_grants WHERE app_code='crm' AND active) OR
    EXISTS(SELECT 1 FROM p4_v1_ci.app_grants WHERE app_code='teams' AND active) THEN
    RAISE EXCEPTION 'Orchid role grant or app entitlement access mismatch';
 END IF;
END $orchid$;
COMMIT;
BEGIN;
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000a1',true);
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000002',true);
DO $cedar$
BEGIN
 IF (SELECT count(*) FROM p4_v1_ci.app_grants)<>2 OR
    (SELECT count(*) FROM p4_v1_ci.role_permissions)<>2 OR
    NOT EXISTS(SELECT 1 FROM p4_v1_ci.app_grants WHERE app_code='crm' AND active) THEN
    RAISE EXCEPTION 'Cedar grants crossed org boundary';
 END IF;
END $cedar$;
COMMIT;
-- Revoked Bob must not see permissions even with caller-set org/role GUC.
BEGIN;
SELECT set_config('app.actor_id','10000000-0000-4000-8000-0000000000b1',true);
SELECT set_config('app.tenant_id','20000000-0000-4000-8000-000000000001',true);
DO $revoked$
BEGIN
 IF (SELECT count(*) FROM p4_v1_ci.app_grants)<>0 OR
    (SELECT count(*) FROM p4_v1_ci.role_permissions)<>0 THEN
   RAISE EXCEPTION 'Revoked member retained entitlement or role grant access';
 END IF;
END $revoked$;
COMMIT;
DO $cleanup$
BEGIN
 IF (SELECT count(*) FROM p4_v1_ci.app_grants)<>0 OR
    (SELECT count(*) FROM p4_v1_ci.role_permissions)<>0 THEN
   RAISE EXCEPTION 'Tenant context leaked after COMMIT';
 END IF;
END $cleanup$;
RESET ROLE;
SELECT 'P4.17 CI-only issuer-subject lookup isolation and entitlement/RBAC RLS PASS' AS result;
