-- R82: expand-only candidate for the future UUID identity/tenant foundation.
-- Run ONLY in disposable CI. No legacy rows copied and no Neon migration.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' OR current_user<>'demo_ci'
 OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
 OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='p4_r82_ci')
 OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN ('p4_r82_ci_owner','p4_r82_ci_lookup','p4_r82_ci_runtime'))
 THEN RAISE EXCEPTION 'P4_R82_DISPOSABLE_ONLY'; END IF;
END $$;
CREATE ROLE p4_r82_ci_owner NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
CREATE ROLE p4_r82_ci_lookup NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
CREATE ROLE p4_r82_ci_runtime LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION
 PASSWORD 'fake_ci_not_for_real_accounts';
CREATE SCHEMA p4_r82_ci AUTHORIZATION p4_r82_ci_owner;
REVOKE ALL ON SCHEMA p4_r82_ci FROM PUBLIC;
GRANT USAGE ON SCHEMA p4_r82_ci TO p4_r82_ci_lookup,p4_r82_ci_runtime;
SET LOCAL ROLE p4_r82_ci_owner;
ALTER DEFAULT PRIVILEGES IN SCHEMA p4_r82_ci REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
CREATE DOMAIN p4_r82_ci.uuid_v4 AS uuid CHECK(substring(value::text from 15 for 1)='4' AND substring(value::text from 20 for 1) IN ('8','9','a','b'));
CREATE TABLE p4_r82_ci.users(
 id p4_r82_ci.uuid_v4 PRIMARY KEY,active boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE p4_r82_ci.identity_subjects(
 issuer text NOT NULL CHECK(issuer ~ '^https://[a-z0-9-]+([.][a-z0-9-]+)*[.]auth0[.]com/$'),
 external_subject text NOT NULL CHECK(external_subject ~ '^auth0[|][A-Za-z0-9_-]{3,180}$'),
 user_id p4_r82_ci.uuid_v4 NOT NULL REFERENCES p4_r82_ci.users(id) ON DELETE RESTRICT,
 verified boolean NOT NULL DEFAULT false,active boolean NOT NULL DEFAULT true,
 PRIMARY KEY(issuer,external_subject)
);
CREATE INDEX r82_subject_user ON p4_r82_ci.identity_subjects(user_id);
CREATE TABLE p4_r82_ci.organizations(
 id p4_r82_ci.uuid_v4 PRIMARY KEY,slug text NOT NULL UNIQUE CHECK(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug)<=48),
 display_name text NOT NULL CHECK(length(trim(display_name)) BETWEEN 2 AND 160),
 active boolean NOT NULL DEFAULT true,created_by p4_r82_ci.uuid_v4 NOT NULL REFERENCES p4_r82_ci.users(id) ON DELETE RESTRICT
);
CREATE TABLE p4_r82_ci.memberships(
 organization_id p4_r82_ci.uuid_v4 NOT NULL REFERENCES p4_r82_ci.organizations(id) ON DELETE RESTRICT,
 user_id p4_r82_ci.uuid_v4 NOT NULL REFERENCES p4_r82_ci.users(id) ON DELETE RESTRICT,
 role text NOT NULL CHECK(role IN ('OWNER','MEMBER')),
 active boolean NOT NULL DEFAULT true,revision integer NOT NULL DEFAULT 0 CHECK(revision>=0),
 PRIMARY KEY(organization_id,user_id)
);
CREATE INDEX r82_member_active ON p4_r82_ci.memberships(user_id,organization_id) WHERE active;
CREATE TABLE p4_r82_ci.teams(
 organization_id p4_r82_ci.uuid_v4 NOT NULL REFERENCES p4_r82_ci.organizations(id) ON DELETE RESTRICT,
 id p4_r82_ci.uuid_v4 NOT NULL,name text NOT NULL CHECK(length(trim(name)) BETWEEN 2 AND 160),
 manager_user_id p4_r82_ci.uuid_v4 NOT NULL,active boolean NOT NULL DEFAULT true,
 PRIMARY KEY(organization_id,id),
 FOREIGN KEY(organization_id,manager_user_id) REFERENCES p4_r82_ci.memberships(organization_id,user_id) ON DELETE RESTRICT
);
CREATE TABLE p4_r82_ci.team_memberships(
 organization_id p4_r82_ci.uuid_v4 NOT NULL,team_id p4_r82_ci.uuid_v4 NOT NULL,user_id p4_r82_ci.uuid_v4 NOT NULL,active boolean NOT NULL DEFAULT true,
 PRIMARY KEY(organization_id,team_id,user_id),
 FOREIGN KEY(organization_id,team_id) REFERENCES p4_r82_ci.teams(organization_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(organization_id,user_id) REFERENCES p4_r82_ci.memberships(organization_id,user_id) ON DELETE RESTRICT
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['users','identity_subjects','organizations','memberships','teams','team_memberships'] LOOP
  EXECUTE format('ALTER TABLE p4_r82_ci.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE p4_r82_ci.%I FORCE ROW LEVEL SECURITY',t);
 END LOOP;
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA p4_r82_ci FROM PUBLIC,p4_r82_ci_runtime,p4_r82_ci_lookup;
GRANT SELECT(id,active) ON p4_r82_ci.users TO p4_r82_ci_lookup;
GRANT SELECT(issuer,external_subject,user_id,verified,active) ON p4_r82_ci.identity_subjects TO p4_r82_ci_lookup;
GRANT SELECT(id,active) ON p4_r82_ci.organizations TO p4_r82_ci_lookup;
GRANT SELECT(organization_id,user_id,role,active) ON p4_r82_ci.memberships TO p4_r82_ci_lookup;
CREATE POLICY r82_users_lookup ON p4_r82_ci.users FOR SELECT TO p4_r82_ci_lookup USING(active);
CREATE POLICY r82_subject_lookup ON p4_r82_ci.identity_subjects FOR SELECT TO p4_r82_ci_lookup USING(active AND verified);
CREATE POLICY r82_org_lookup ON p4_r82_ci.organizations FOR SELECT TO p4_r82_ci_lookup USING(active);
CREATE POLICY r82_member_lookup ON p4_r82_ci.memberships FOR SELECT TO p4_r82_ci_lookup USING(active);
RESET ROLE;
CREATE FUNCTION p4_r82_ci.membership_check(p_issuer text,p_subject text,p_org uuid)
 RETURNS TABLE(actor_id uuid,organization_id uuid,membership_role text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT u.id::uuid,m.organization_id::uuid,m.role
 FROM p4_r82_ci.identity_subjects s
 JOIN p4_r82_ci.users u ON u.id=s.user_id AND u.active
 JOIN p4_r82_ci.memberships m ON m.user_id=u.id AND m.active AND m.organization_id=p_org
 JOIN p4_r82_ci.organizations o ON o.id=m.organization_id AND o.active
 WHERE s.issuer=p_issuer AND s.external_subject=p_subject AND s.verified AND s.active
 AND p_issuer ~ '^https://[a-z0-9-]+([.][a-z0-9-]+)*[.]auth0[.]com/$'
 AND p_subject ~ '^auth0[|][A-Za-z0-9_-]{3,180}$'
 LIMIT 1;
$$;
ALTER FUNCTION p4_r82_ci.membership_check(text,text,uuid) OWNER TO p4_r82_ci_lookup;
REVOKE ALL ON FUNCTION p4_r82_ci.membership_check(text,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p4_r82_ci.membership_check(text,text,uuid) TO p4_r82_ci_runtime;
COMMIT;
