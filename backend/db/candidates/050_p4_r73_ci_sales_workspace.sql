-- R73 sales workspace discovery and single-snapshot own-record counts; disposable CI only.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' OR current_user<>'demo_ci'
 OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
 OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='p4_r73_ci')
 OR to_regclass('p4_r72_ci.leads') IS NULL
 THEN RAISE EXCEPTION 'P4_R73_CI_ONLY'; END IF;
END $$;
CREATE SCHEMA p4_r73_ci;
REVOKE ALL ON SCHEMA p4_r73_ci FROM PUBLIC;
GRANT USAGE ON SCHEMA p4_r73_ci TO p4_synthetic_ci_runtime;
CREATE FUNCTION p4_r73_ci.organizations()
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
 WHERE m.user_id=who AND m.active AND m.role='MEMBER' AND r.role_code='SALES_REP'
 ORDER BY o.id LIMIT 201;
END $$;
CREATE FUNCTION p4_r73_ci.overview(p_org uuid)
 RETURNS TABLE(leads integer,qualified integer,converted integer,accounts integer,contacts integer,deals integer,open_deals integer,won_deals integer,lost_deals integer)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE who text:=p4_r69_ci.require_rep(p_org);
BEGIN
 RETURN QUERY SELECT
 (SELECT count(*)::int FROM p4_r72_ci.leads l WHERE l.org_id=p_org AND l.owner_user_id=who),
 (SELECT count(*)::int FROM p4_r72_ci.leads l WHERE l.org_id=p_org AND l.owner_user_id=who AND l.status='QUALIFIED'),
 (SELECT count(*)::int FROM p4_r72_ci.leads l WHERE l.org_id=p_org AND l.owner_user_id=who AND l.status='CONVERTED'),
 (SELECT count(*)::int FROM p4_r69_ci.accounts a WHERE a.org_id=p_org AND a.owner_user_id=who),
 (SELECT count(*)::int FROM p4_r70_ci.contacts c WHERE c.org_id=p_org AND c.owner_user_id=who),
 (SELECT count(*)::int FROM p4_r71_ci.deals d WHERE d.org_id=p_org AND d.owner_user_id=who),
 (SELECT count(*)::int FROM p4_r71_ci.deals d JOIN p4_r71_ci.stages s ON s.org_id=d.org_id AND s.pipeline_id=d.pipeline_id AND s.id=d.stage_id WHERE d.org_id=p_org AND d.owner_user_id=who AND s.code NOT IN ('WON','LOST')),
 (SELECT count(*)::int FROM p4_r71_ci.deals d JOIN p4_r71_ci.stages s ON s.org_id=d.org_id AND s.pipeline_id=d.pipeline_id AND s.id=d.stage_id WHERE d.org_id=p_org AND d.owner_user_id=who AND s.code='WON'),
 (SELECT count(*)::int FROM p4_r71_ci.deals d JOIN p4_r71_ci.stages s ON s.org_id=d.org_id AND s.pipeline_id=d.pipeline_id AND s.id=d.stage_id WHERE d.org_id=p_org AND d.owner_user_id=who AND s.code='LOST');
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA p4_r73_ci FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p4_r73_ci.organizations(),p4_r73_ci.overview(uuid) TO p4_synthetic_ci_runtime;
COMMIT;
