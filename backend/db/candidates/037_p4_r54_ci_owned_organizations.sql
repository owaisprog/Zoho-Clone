-- P4 R54: owner organization switcher, disposable synthetic CI database only.
\set ON_ERROR_STOP on
BEGIN;
DO $guard$ BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci'
 OR current_user<>'demo_ci'
 OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
 OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='p4_r54_ci')
 OR to_regprocedure('p4_r40_ci.require_current_owner(uuid)') IS NULL
 THEN RAISE EXCEPTION 'P4_R54_CI_ONLY'; END IF;
END $guard$;
CREATE SCHEMA p4_r54_ci;
REVOKE ALL ON SCHEMA p4_r54_ci FROM PUBLIC;
GRANT USAGE ON SCHEMA p4_r54_ci TO p4_synthetic_ci_runtime;
-- List limited, current verified OWNER organizations across tenant IDs.
-- This exception to a single app.tenant_id must NOT be reused for app data.
CREATE FUNCTION p4_r54_ci.list_owned_organizations()
RETURNS TABLE(id uuid,display_name text,slug text,owner_role text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $body$
DECLARE who text;
BEGIN
 who:=nullif(current_setting('app.actor_id',true),'');
 IF current_database()<>'zoho_clone_synthetic_ci'
 OR current_setting('role',true)<>'p4_synthetic_ci_runtime'
 OR nullif(current_setting('app.tenant_id',true),'') IS NOT NULL
 OR who IS NULL OR who !~ '^user_demo_[a-z]{2,16}$'
 OR NOT EXISTS (
  SELECT 1 FROM p4_synthetic.identity_subjects s
  WHERE s.user_id=who AND s.email_verified=true
   AND s.canonical_email ~ '^[a-z0-9._-]+@example[.]com$')
 THEN RAISE EXCEPTION USING ERRCODE='P4003',MESSAGE='ACCESS_DENIED'; END IF;
 RETURN QUERY SELECT o.id,o.display_name::text,o.slug::text,
  'OWNER'::text
 FROM p4_synthetic.organizations o
 JOIN p4_synthetic.memberships m ON m.org_id=o.id
  AND m.user_id=who AND m.role='OWNER' AND m.active=true
 ORDER BY o.display_name,o.id LIMIT 201;
END $body$;
REVOKE ALL ON FUNCTION p4_r54_ci.list_owned_organizations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p4_r54_ci.list_owned_organizations()
 TO p4_synthetic_ci_runtime;
COMMIT;
