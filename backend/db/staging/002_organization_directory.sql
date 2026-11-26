-- Reviewed candidate only. Execute in disposable CI; external migration needs separate approval.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
 IF NOT ((current_database()='zoho_clone_synthetic_ci' AND current_user='demo_ci')
     OR (current_database()='zoho_clone_staging' AND current_user='p4_stage_migrator'))
 OR to_regnamespace('platform_stage') IS NULL
 OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='p4_stage_lookup' AND NOT
   (rolcanlogin OR rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolreplication OR rolinherit))
 THEN RAISE EXCEPTION 'P4_STAGE_DIRECTORY_SCOPE_DENIED'; END IF;
END $$;
CREATE FUNCTION platform_stage.organization_directory(p_issuer text,p_subject text,p_after uuid)
 RETURNS TABLE(organization_id uuid,membership_role text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT o.id,m.role
 FROM platform_stage.identity_subjects s
 JOIN platform_stage.users u ON u.id=s.user_id AND u.active
 JOIN platform_stage.memberships m ON m.user_id=u.id AND m.active
 JOIN platform_stage.organizations o ON o.id=m.organization_id AND o.active
 WHERE s.issuer=p_issuer AND s.subject=p_subject AND s.verified AND s.active
 AND (p_after IS NULL OR o.id>p_after)
 ORDER BY o.id LIMIT 21
$$;
GRANT CREATE ON SCHEMA platform_stage TO p4_stage_lookup;
ALTER FUNCTION platform_stage.organization_directory(text,text,uuid) OWNER TO p4_stage_lookup;
REVOKE CREATE ON SCHEMA platform_stage FROM p4_stage_lookup;
REVOKE ALL ON FUNCTION platform_stage.organization_directory(text,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION platform_stage.organization_directory(text,text,uuid) TO p4_stage_runtime;
COMMIT;
