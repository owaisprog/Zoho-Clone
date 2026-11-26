-- Disposable CI only. This is not an authorized external migration.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' OR current_user<>'demo_ci'
 OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
 OR to_regclass('platform_stage.app_entitlements') IS NULL THEN RAISE EXCEPTION 'DISPOSABLE_ONLY'; END IF;
END $$;
-- Administrative grants must respect current platform entitlement too.
GRANT SELECT ON platform_stage.app_entitlements TO p4_stage_grant_definer;
CREATE POLICY stage_admin_entitlement ON platform_stage.app_entitlements FOR SELECT TO p4_stage_grant_definer USING(active AND app_code='platform');
CREATE OR REPLACE FUNCTION platform_stage.grant_actor(p_issuer text,p_subject text,p_org uuid,p_target uuid)
 RETURNS uuid LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
 DECLARE actor uuid;
 BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' OR session_user<>'p4_stage_grant_writer'
 OR current_setting('transaction_isolation')<>'serializable' OR p_target IS NULL THEN RETURN NULL; END IF;
 SELECT u.id INTO actor FROM platform_stage.identity_subjects s
 JOIN platform_stage.users u ON u.id=s.user_id AND u.active
 JOIN platform_stage.organizations o ON o.id=p_org AND o.active
 JOIN platform_stage.memberships m ON m.organization_id=o.id AND m.user_id=u.id AND m.active AND m.role='OWNER'
 WHERE s.issuer=p_issuer AND s.subject=p_subject AND s.verified AND s.active
 AND EXISTS(SELECT 1 FROM platform_stage.app_entitlements e WHERE e.organization_id=p_org AND e.app_code='platform' AND e.active);
 IF actor IS NULL OR actor=p_target OR NOT EXISTS(
  SELECT 1 FROM platform_stage.memberships m JOIN platform_stage.users u ON u.id=m.user_id AND u.active
  WHERE m.organization_id=p_org AND m.user_id=p_target AND m.active AND m.role='MEMBER'
 ) THEN RETURN NULL; END IF;
 RETURN actor;
 END $$;
REVOKE ALL ON FUNCTION platform_stage.grant_actor(text,text,uuid,uuid) FROM PUBLIC;
-- The runtime receives only a bounded owner-scoped projection, never raw audit access.
GRANT SELECT ON platform_stage.grant_audit TO p4_stage_lookup;
CREATE POLICY stage_audit_lookup ON platform_stage.grant_audit FOR SELECT TO p4_stage_lookup USING(true);
CREATE FUNCTION platform_stage.grant_audit_page(p_issuer text,p_subject text,p_org uuid,p_after uuid)
 RETURNS TABLE(request_id uuid,actor_id uuid,action text,occurred_at timestamptz)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' OR session_user<>'p4_stage_runtime'
 OR current_setting('transaction_read_only')<>'on'
 OR NOT EXISTS(SELECT 1 FROM platform_stage.membership_check(p_issuer,p_subject,p_org) m WHERE m.membership_role='OWNER')
 OR NOT EXISTS(SELECT 1 FROM platform_stage.app_entitlements e WHERE e.organization_id=p_org AND e.app_code='platform' AND e.active)
 THEN RAISE EXCEPTION 'ACCESS_DENIED' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT a.request_id,a.actor_id,a.kind,a.applied_at FROM platform_stage.grant_audit a
 WHERE a.organization_id=p_org AND (p_after IS NULL OR a.request_id>p_after)
 ORDER BY a.request_id LIMIT 21;
 END $$;
GRANT CREATE ON SCHEMA platform_stage TO p4_stage_lookup;
ALTER FUNCTION platform_stage.grant_audit_page(text,text,uuid,uuid) OWNER TO p4_stage_lookup;
REVOKE CREATE ON SCHEMA platform_stage FROM p4_stage_lookup;
REVOKE ALL ON FUNCTION platform_stage.grant_audit_page(text,text,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION platform_stage.grant_audit_page(text,text,uuid,uuid) TO p4_stage_runtime;
COMMIT;
