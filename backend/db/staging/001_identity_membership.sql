-- First staging identity slice. Review before any external execution.
-- Required separately provisioned roles: p4_stage_owner, p4_stage_lookup (NOLOGIN),
-- p4_stage_runtime (restricted LOGIN), and p4_stage_migrator for staging.
-- No passwords, seed data, connection commands or legacy schema changes.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
 IF NOT ((current_database()='zoho_clone_synthetic_ci' AND current_user='demo_ci')
     OR (current_database()='zoho_clone_staging' AND current_user='p4_stage_migrator'))
 OR to_regnamespace('platform_stage') IS NOT NULL
 OR (SELECT count(*) FROM pg_roles WHERE rolname IN ('p4_stage_owner','p4_stage_lookup','p4_stage_runtime')
     AND NOT (rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication OR rolinherit)
     AND rolcanlogin=(rolname='p4_stage_runtime'))<>3
 OR EXISTS(SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.member WHERE r.rolname='p4_stage_runtime')
 THEN RAISE EXCEPTION 'P4_STAGE_MIGRATION_SCOPE_DENIED'; END IF;
END $$;
CREATE SCHEMA platform_stage AUTHORIZATION p4_stage_owner;
REVOKE ALL ON SCHEMA platform_stage FROM PUBLIC;
GRANT USAGE ON SCHEMA platform_stage TO p4_stage_lookup,p4_stage_runtime;
CREATE TABLE platform_stage.users(
 id uuid PRIMARY KEY CHECK(substring(id::text from 15 for 1)='4' AND substring(id::text from 20 for 1) IN ('8','9','a','b')),
 active boolean NOT NULL DEFAULT true);
CREATE TABLE platform_stage.identity_subjects(
 issuer text NOT NULL CHECK(issuer ~ '^https://[a-z0-9-]+([.][a-z0-9-]+)*[.]auth0[.]com/$'),
 subject text NOT NULL CHECK(subject ~ '^auth0[|][A-Za-z0-9_-]{3,180}$'),
 user_id uuid NOT NULL REFERENCES platform_stage.users(id) ON DELETE RESTRICT,
 verified boolean NOT NULL DEFAULT false, active boolean NOT NULL DEFAULT true,
 PRIMARY KEY(issuer,subject));
CREATE TABLE platform_stage.organizations(
 id uuid PRIMARY KEY CHECK(substring(id::text from 15 for 1)='4' AND substring(id::text from 20 for 1) IN ('8','9','a','b')),
 active boolean NOT NULL DEFAULT true);
CREATE TABLE platform_stage.memberships(
 organization_id uuid NOT NULL REFERENCES platform_stage.organizations(id) ON DELETE RESTRICT,
 user_id uuid NOT NULL REFERENCES platform_stage.users(id) ON DELETE RESTRICT,
 role text NOT NULL CHECK(role IN ('OWNER','MEMBER')),
 active boolean NOT NULL DEFAULT true, revision integer NOT NULL DEFAULT 0 CHECK(revision>=0),
 PRIMARY KEY(organization_id,user_id));
CREATE INDEX stage_membership_user ON platform_stage.memberships(user_id,organization_id);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['users','identity_subjects','organizations','memberships'] LOOP
  EXECUTE format('ALTER TABLE platform_stage.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE platform_stage.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON platform_stage.%I FROM PUBLIC,p4_stage_runtime,p4_stage_lookup',t);
  EXECUTE format('GRANT SELECT ON platform_stage.%I TO p4_stage_lookup',t);
  EXECUTE format('ALTER TABLE platform_stage.%I OWNER TO p4_stage_owner',t);
 END LOOP;
END $$;
CREATE POLICY stage_users_lookup ON platform_stage.users FOR SELECT TO p4_stage_lookup USING(active);
CREATE POLICY stage_identity_lookup ON platform_stage.identity_subjects FOR SELECT TO p4_stage_lookup USING(active AND verified);
CREATE POLICY stage_org_lookup ON platform_stage.organizations FOR SELECT TO p4_stage_lookup USING(active);
CREATE POLICY stage_member_lookup ON platform_stage.memberships FOR SELECT TO p4_stage_lookup USING(active);
CREATE FUNCTION platform_stage.membership_check(p_issuer text,p_subject text,p_org uuid)
 RETURNS TABLE(actor_id uuid,organization_id uuid,membership_role text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT u.id,m.organization_id,m.role
 FROM platform_stage.identity_subjects s
 JOIN platform_stage.users u ON u.id=s.user_id AND u.active
 JOIN platform_stage.memberships m ON m.user_id=u.id AND m.active AND m.organization_id=p_org
 JOIN platform_stage.organizations o ON o.id=m.organization_id AND o.active
 WHERE s.issuer=p_issuer AND s.subject=p_subject AND s.verified AND s.active
 LIMIT 1
$$;
-- The migration principal must be authorized to transfer function ownership;
-- give the NOLOGIN lookup role temporary schema CREATE in this transaction only.
GRANT CREATE ON SCHEMA platform_stage TO p4_stage_lookup;
ALTER FUNCTION platform_stage.membership_check(text,text,uuid) OWNER TO p4_stage_lookup;
REVOKE CREATE ON SCHEMA platform_stage FROM p4_stage_lookup;
REVOKE ALL ON FUNCTION platform_stage.membership_check(text,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION platform_stage.membership_check(text,text,uuid) TO p4_stage_runtime;
COMMIT;
