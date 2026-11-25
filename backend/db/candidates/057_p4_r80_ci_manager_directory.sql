-- R80 manager discovery with current managed team scope, disposable CI only.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' OR current_user<>'demo_ci'
 OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
 OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='p4_r80_ci')
 OR to_regnamespace('p4_r79_ci') IS NULL THEN RAISE EXCEPTION 'P4_R80_CI_ONLY'; END IF;
END $$;
CREATE SCHEMA p4_r80_ci;
REVOKE ALL ON SCHEMA p4_r80_ci FROM PUBLIC;
GRANT USAGE ON SCHEMA p4_r80_ci TO p4_synthetic_ci_runtime;
CREATE FUNCTION p4_r80_ci.organizations()
 RETURNS TABLE(id uuid,display_name text,slug text,sales_role text)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE who text:=nullif(current_setting('app.actor_id',true),'');
BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' OR current_setting('role',true)<>'p4_synthetic_ci_runtime'
 OR nullif(current_setting('app.tenant_id',true),'') IS NOT NULL
 OR who IS NULL OR NOT EXISTS(SELECT 1 FROM p4_synthetic.identity_subjects s
 WHERE s.user_id=who AND s.email_verified AND s.canonical_email ~ '^[a-z0-9._-]+@example[.]com$')
 THEN RAISE EXCEPTION USING ERRCODE='P4003',MESSAGE='ACCESS_DENIED'; END IF;
 RETURN QUERY SELECT o.id,o.display_name::text,o.slug::text,r.role_code
 FROM p4_synthetic.organizations o JOIN p4_synthetic.memberships m ON m.org_id=o.id
 JOIN p4_r40_ci.sales_roles r ON r.org_id=m.org_id AND r.user_id=m.user_id
 JOIN p4_r69_ci.crm_entitlements e ON e.org_id=o.id AND e.active
 WHERE m.user_id=who AND m.active AND m.role='MEMBER' AND r.role_code='SALES_MANAGER'
 AND EXISTS(SELECT 1 FROM p4_synthetic.teams t JOIN p4_synthetic.departments dep ON dep.org_id=t.org_id AND dep.id=t.department_id AND dep.active JOIN p4_synthetic.team_memberships tm ON tm.org_id=t.org_id AND tm.team_id=t.id AND tm.user_id=who AND tm.active WHERE t.org_id=o.id AND t.active AND t.manager_user_id=who)
 ORDER BY o.id LIMIT 201;
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA p4_r80_ci FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p4_r80_ci.organizations() TO p4_synthetic_ci_runtime;
COMMIT;
