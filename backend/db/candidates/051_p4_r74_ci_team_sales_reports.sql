-- R74 explicit team-assigned Deal reporting; no manager mutation privileges.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' OR current_user<>'demo_ci'
 OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
 OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='p4_r74_ci')
 OR to_regclass('p4_r71_ci.deals') IS NULL
 THEN RAISE EXCEPTION 'P4_R74_CI_ONLY'; END IF;
END $$;
CREATE SCHEMA p4_r74_ci;
REVOKE ALL ON SCHEMA p4_r74_ci FROM PUBLIC;
GRANT USAGE ON SCHEMA p4_r74_ci TO p4_synthetic_ci_runtime;
CREATE TABLE p4_r74_ci.deal_team_assignments(
 org_id uuid NOT NULL,deal_id uuid NOT NULL,team_id text NOT NULL,
 active boolean NOT NULL DEFAULT true,
 PRIMARY KEY(org_id,deal_id),
 FOREIGN KEY(org_id,deal_id) REFERENCES p4_r71_ci.deals(org_id,id),
 FOREIGN KEY(org_id,team_id) REFERENCES p4_synthetic.teams(org_id,id)
);
ALTER TABLE p4_r74_ci.deal_team_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE p4_r74_ci.deal_team_assignments FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA p4_r74_ci FROM PUBLIC,p4_synthetic_ci_runtime;
CREATE FUNCTION p4_r74_ci.require_manager(p_org uuid) RETURNS text
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE who text:=nullif(current_setting('app.actor_id',true),'');
BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci'
 OR current_setting('role',true)<>'p4_synthetic_ci_runtime'
 OR p_org::text IS DISTINCT FROM nullif(current_setting('app.tenant_id',true),'')
 OR NOT EXISTS(SELECT 1 FROM p4_synthetic.memberships m
 JOIN p4_synthetic.identity_subjects s ON s.user_id=m.user_id AND s.email_verified
 JOIN p4_r40_ci.sales_roles r ON r.org_id=m.org_id AND r.user_id=m.user_id AND r.role_code='SALES_MANAGER'
 JOIN p4_r69_ci.crm_entitlements e ON e.org_id=m.org_id AND e.active
 WHERE m.org_id=p_org AND m.user_id=who AND m.active AND m.role='MEMBER')
 THEN RAISE EXCEPTION USING ERRCODE='P4003',MESSAGE='ACCESS_DENIED'; END IF;
 RETURN who;
END $$;
CREATE FUNCTION p4_r74_ci.teams(p_org uuid)
 RETURNS TABLE(id text,name text) LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE who text:=p4_r74_ci.require_manager(p_org);
BEGIN
 RETURN QUERY SELECT t.id,t.name FROM p4_synthetic.teams t
 JOIN p4_synthetic.team_memberships tm ON tm.org_id=t.org_id AND tm.team_id=t.id AND tm.user_id=who AND tm.active
 JOIN p4_synthetic.departments dep ON dep.org_id=t.org_id AND dep.id=t.department_id AND dep.active
 WHERE t.org_id=p_org AND t.active AND t.manager_user_id=who ORDER BY t.id LIMIT 101;
END $$;
CREATE FUNCTION p4_r74_ci.deal_report(p_org uuid,p_team text,p_owner text,p_stage text,p_from date,p_to date)
 RETURNS TABLE(owner_user_id text,stage text,total integer)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE who text:=p4_r74_ci.require_manager(p_org);
BEGIN
 IF p_team IS NULL OR p_team !~ '^team_demo_[a-z]{2,24}$'
 OR (p_owner IS NOT NULL AND p_owner !~ '^user_demo_[a-z]{2,16}$')
 OR (p_stage IS NOT NULL AND p_stage NOT IN ('OPEN','DISCOVERY','PROPOSAL','NEGOTIATION','WON','LOST'))
 OR p_from IS NULL OR p_to IS NULL OR p_from>=p_to OR p_to-p_from>366
 THEN RAISE EXCEPTION USING ERRCODE='P7400',MESSAGE='INVALID_INPUT'; END IF;
 IF NOT EXISTS(SELECT 1 FROM p4_r74_ci.teams(p_org) t WHERE t.id=p_team)
 THEN RAISE EXCEPTION USING ERRCODE='P4003',MESSAGE='ACCESS_DENIED'; END IF;
 IF p_owner IS NOT NULL AND NOT EXISTS(SELECT 1 FROM p4_synthetic.team_memberships tm
 JOIN p4_synthetic.memberships m ON m.org_id=tm.org_id AND m.user_id=tm.user_id AND m.active
 JOIN p4_r40_ci.sales_roles r ON r.org_id=m.org_id AND r.user_id=m.user_id AND r.role_code='SALES_REP'
 WHERE tm.org_id=p_org AND tm.team_id=p_team AND tm.user_id=p_owner AND tm.active)
 THEN RAISE EXCEPTION USING ERRCODE='P4003',MESSAGE='ACCESS_DENIED'; END IF;
 RETURN QUERY SELECT d.owner_user_id,s.code,count(*)::integer
 FROM p4_r74_ci.deal_team_assignments a
 JOIN p4_r71_ci.deals d ON d.org_id=a.org_id AND d.id=a.deal_id
 JOIN p4_r71_ci.stages s ON s.org_id=d.org_id AND s.pipeline_id=d.pipeline_id AND s.id=d.stage_id
 JOIN p4_synthetic.team_memberships tm ON tm.org_id=d.org_id AND tm.team_id=a.team_id AND tm.user_id=d.owner_user_id AND tm.active
 JOIN p4_synthetic.memberships m ON m.org_id=d.org_id AND m.user_id=d.owner_user_id AND m.active
 JOIN p4_r40_ci.sales_roles r ON r.org_id=m.org_id AND r.user_id=m.user_id AND r.role_code='SALES_REP'
 WHERE a.org_id=p_org AND a.team_id=p_team AND a.active
 AND (p_owner IS NULL OR d.owner_user_id=p_owner)
 AND (p_stage IS NULL OR s.code=p_stage)
 AND d.created_at >= (p_from::timestamp AT TIME ZONE 'UTC')
 AND d.created_at < (p_to::timestamp AT TIME ZONE 'UTC')
 GROUP BY d.owner_user_id,s.code ORDER BY d.owner_user_id,s.code LIMIT 601;
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA p4_r74_ci FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p4_r74_ci.teams(uuid),p4_r74_ci.deal_report(uuid,text,text,text,date,date) TO p4_synthetic_ci_runtime;
COMMIT;
