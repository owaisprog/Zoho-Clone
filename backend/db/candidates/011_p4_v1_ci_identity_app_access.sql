-- P4 integration batch 05: CI-only Auth0 subject lookup + entitlement/RBAC.
-- NEVER run against Neon, staging or production. NO customer data.
\set ON_ERROR_STOP on
BEGIN;
DO $guard$
BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' OR current_user<>'demo_ci' OR
    NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user) OR
    NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='p4_v1_ci') THEN
   RAISE EXCEPTION 'P4 V1 candidate 011 requires disposable PostgreSQL CI bootstrap';
 END IF;
END $guard$;

-- A SECURITY DEFINER identity resolver is segregated from tenant permissions.
-- The non-login definer has SELECT on ONLY the subject mappings table.
CREATE ROLE p4_v1_ci_identity_owner NOLOGIN NOSUPERUSER NOBYPASSRLS
  NOCREATEDB NOCREATEROLE NOREPLICATION;
CREATE ROLE p4_v1_ci_identity_lookup NOLOGIN NOSUPERUSER NOBYPASSRLS
  NOCREATEDB NOCREATEROLE NOREPLICATION;
GRANT USAGE ON SCHEMA p4_v1_ci TO p4_v1_ci_identity_owner,p4_v1_ci_identity_lookup;
GRANT SELECT ON p4_v1_ci.identity_subjects TO p4_v1_ci_identity_owner;
CREATE POLICY p4_v1_identity_definer_select ON p4_v1_ci.identity_subjects
  FOR SELECT TO p4_v1_ci_identity_owner USING (true);
CREATE FUNCTION p4_v1_ci.lookup_verified_subject(p_issuer text,p_subject text)
RETURNS TABLE(user_id uuid,email_verified boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
  SELECT s.user_id::uuid, s.email_verified
  FROM p4_v1_ci.identity_subjects s
  WHERE s.issuer = p_issuer AND s.external_subject = p_subject
    AND s.email_verified = true
    AND p_issuer ~ '^https://[a-z0-9.-]+[.]auth0[.]com/$'
    AND length(p_subject) BETWEEN 3 AND 200
  LIMIT 1;
$$;
ALTER FUNCTION p4_v1_ci.lookup_verified_subject(text,text)
 OWNER TO p4_v1_ci_identity_owner;
REVOKE ALL ON FUNCTION p4_v1_ci.lookup_verified_subject(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p4_v1_ci.lookup_verified_subject(text,text)
 TO p4_v1_ci_identity_lookup;
-- The regular tenant role cannot call or query the identity resolver.

-- Entitlement is not RBAC. Both must pass in the SAME authenticated
-- tenant transaction before exposing a business app route.
CREATE TABLE p4_v1_ci.app_grants (
  organization_id p4_v1_ci.internal_id NOT NULL
    REFERENCES p4_v1_ci.organizations(id) ON DELETE RESTRICT,
  app_code text NOT NULL CHECK(app_code IN ('crm','teams')),
  active boolean NOT NULL DEFAULT false,
  PRIMARY KEY(organization_id,app_code)
);
CREATE TABLE p4_v1_ci.role_permissions (
  organization_id p4_v1_ci.internal_id NOT NULL,
  role_code text NOT NULL CHECK(role_code IN ('OWNER','MEMBER')),
  permission_code text NOT NULL CHECK(permission_code IN ('crm.leads.read','teams.read')),
  PRIMARY KEY(organization_id,role_code,permission_code),
  FOREIGN KEY (organization_id) REFERENCES p4_v1_ci.organizations(id) ON DELETE RESTRICT
);
INSERT INTO p4_v1_ci.app_grants (organization_id,app_code,active) VALUES
 ('20000000-0000-4000-8000-000000000001','crm',true),
 ('20000000-0000-4000-8000-000000000001','teams',false),
 ('20000000-0000-4000-8000-000000000002','crm',true),
 ('20000000-0000-4000-8000-000000000002','teams',false);
INSERT INTO p4_v1_ci.role_permissions (organization_id,role_code,permission_code) VALUES
 ('20000000-0000-4000-8000-000000000001','OWNER','crm.leads.read'),
 ('20000000-0000-4000-8000-000000000001','OWNER','teams.read'),
 ('20000000-0000-4000-8000-000000000001','MEMBER','crm.leads.read'),
 ('20000000-0000-4000-8000-000000000002','OWNER','crm.leads.read'),
 ('20000000-0000-4000-8000-000000000002','OWNER','teams.read');

ALTER TABLE p4_v1_ci.app_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE p4_v1_ci.app_grants FORCE ROW LEVEL SECURITY;
ALTER TABLE p4_v1_ci.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE p4_v1_ci.role_permissions FORCE ROW LEVEL SECURITY;
CREATE POLICY p4_v1_app_active_member ON p4_v1_ci.app_grants FOR SELECT
USING (
  organization_id::text = nullif(current_setting('app.tenant_id',true),'')
  AND EXISTS(SELECT 1 FROM p4_v1_ci.memberships m
    WHERE m.organization_id=app_grants.organization_id AND m.active)
);
CREATE POLICY p4_v1_role_current_member ON p4_v1_ci.role_permissions FOR SELECT
USING (
  organization_id::text = nullif(current_setting('app.tenant_id',true),'')
  AND EXISTS(SELECT 1 FROM p4_v1_ci.memberships m
    WHERE m.organization_id=role_permissions.organization_id AND m.active
      AND m.role=role_permissions.role_code)
);
GRANT SELECT ON p4_v1_ci.app_grants,p4_v1_ci.role_permissions
 TO p4_v1_ci_runtime;
-- No mutation GRANT for either table. No generic role-editor API.
COMMIT;
