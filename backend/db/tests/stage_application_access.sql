-- Disposable CI only: never execute on Neon/staging.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' OR current_user<>'demo_ci'
 OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
 OR to_regclass('platform_stage.team_grants') IS NULL THEN RAISE EXCEPTION 'DISPOSABLE_ONLY'; END IF;
END $$;
CREATE TABLE platform_stage.app_entitlements(
 organization_id uuid NOT NULL REFERENCES platform_stage.organizations(id),
 app_code text NOT NULL CHECK(app_code IN ('platform','crm')),
 active boolean NOT NULL DEFAULT false, PRIMARY KEY(organization_id,app_code)
);
CREATE TABLE platform_stage.lead_read_fixtures(
 organization_id uuid NOT NULL,id uuid NOT NULL,
 owner_id uuid NOT NULL,team_id uuid,
 label text NOT NULL CHECK(label ~ '^Demo [A-Za-z0-9 ]{1,75}$'),
 active boolean NOT NULL DEFAULT true,
 PRIMARY KEY(organization_id,id),
 CHECK(substring(id::text from 15 for 1)='4' AND substring(id::text from 20 for 1) IN ('8','9','a','b')),
 FOREIGN KEY(organization_id,owner_id) REFERENCES platform_stage.memberships(organization_id,user_id),
 FOREIGN KEY(organization_id,team_id) REFERENCES platform_stage.teams(organization_id,id)
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['app_entitlements','lead_read_fixtures'] LOOP
  EXECUTE format('ALTER TABLE platform_stage.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE platform_stage.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE platform_stage.%I OWNER TO p4_stage_owner',t);
  EXECUTE format('REVOKE ALL ON platform_stage.%I FROM PUBLIC,p4_stage_runtime,p4_stage_grant_writer',t);
  EXECUTE format('GRANT SELECT ON platform_stage.%I TO p4_stage_lookup',t);
  EXECUTE format('CREATE POLICY stage_app_lookup ON platform_stage.%I FOR SELECT TO p4_stage_lookup USING(active)',t);
 END LOOP;
END $$;
GRANT SELECT ON platform_stage.sales_grants TO p4_stage_lookup;
CREATE POLICY stage_sales_active_lookup ON platform_stage.sales_grants FOR SELECT TO p4_stage_lookup USING(active);
CREATE FUNCTION platform_stage.app_read(p_issuer text,p_subject text,p_org uuid,p_resource text,p_after uuid,p_id uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 DECLARE actor uuid; member_role text; rep boolean; manager boolean; result jsonb;
 BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' OR session_user<>'p4_stage_runtime'
 OR current_setting('transaction_read_only')<>'on' THEN RAISE EXCEPTION 'ACCESS_DENIED' USING ERRCODE='42501'; END IF;
 SELECT m.actor_id,m.membership_role INTO actor,member_role FROM platform_stage.membership_check(p_issuer,p_subject,p_org) m;
 IF actor IS NULL OR NOT EXISTS(SELECT 1 FROM platform_stage.app_entitlements e WHERE e.organization_id=p_org AND e.app_code='platform' AND e.active)
 THEN RAISE EXCEPTION 'ACCESS_DENIED' USING ERRCODE='42501'; END IF;
 SELECT EXISTS(SELECT 1 FROM platform_stage.sales_grants g WHERE g.organization_id=p_org AND g.user_id=actor AND g.role_code='SALES_REP' AND g.active),
 EXISTS(SELECT 1 FROM platform_stage.sales_grants g WHERE g.organization_id=p_org AND g.user_id=actor AND g.role_code='SALES_MANAGER' AND g.active) INTO rep,manager;
 IF NOT EXISTS(SELECT 1 FROM platform_stage.app_entitlements e WHERE e.organization_id=p_org AND e.app_code='crm' AND e.active) THEN rep:=false;manager:=false; END IF;
 IF p_resource='navigation' AND p_after IS NULL AND p_id IS NULL THEN
  RETURN jsonb_build_object('organizationId',p_org,'membershipRole',member_role,'crmAvailable',rep OR manager);
 END IF;
 IF NOT(rep OR manager) THEN RAISE EXCEPTION 'ACCESS_DENIED' USING ERRCODE='42501'; END IF;
 IF NOT ((p_resource='leads' AND p_id IS NULL) OR (p_resource='lead' AND p_id IS NOT NULL AND p_after IS NULL)) THEN
  RAISE EXCEPTION 'ACCESS_DENIED' USING ERRCODE='42501';
 END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',s.id,'label',s.label) ORDER BY s.id),'[]'::jsonb) INTO result FROM
 (SELECT l.id,l.label FROM platform_stage.lead_read_fixtures l
 WHERE l.organization_id=p_org AND l.active AND (p_after IS NULL OR l.id>p_after) AND (p_id IS NULL OR l.id=p_id)
 AND ((rep AND l.owner_id=actor) OR (l.team_id IS NOT NULL AND
 platform_stage.team_membership_check(p_issuer,p_subject,p_org,l.team_id)))
 ORDER BY l.id LIMIT 21) s;
 IF p_resource='lead' THEN RETURN result->0; END IF;
 RETURN result;
 END $$;
GRANT CREATE ON SCHEMA platform_stage TO p4_stage_lookup;
ALTER FUNCTION platform_stage.app_read(text,text,uuid,text,uuid,uuid) OWNER TO p4_stage_lookup;
REVOKE CREATE ON SCHEMA platform_stage FROM p4_stage_lookup;
REVOKE ALL ON FUNCTION platform_stage.app_read(text,text,uuid,text,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION platform_stage.app_read(text,text,uuid,text,uuid,uuid) TO p4_stage_runtime;
COMMIT;
