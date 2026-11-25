-- R84: UUID tenant platform read API, no production migration.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' OR current_user<>'demo_ci'
 OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
 OR to_regnamespace('p4_r82_ci') IS NULL OR to_regnamespace('p4_r84_ci') IS NOT NULL
 THEN RAISE EXCEPTION 'P4_R84_DISPOSABLE_ONLY'; END IF;
END $$;
CREATE SCHEMA p4_r84_ci AUTHORIZATION p4_r82_ci_owner;
REVOKE ALL ON SCHEMA p4_r84_ci FROM PUBLIC;
GRANT USAGE ON SCHEMA p4_r84_ci TO p4_r82_ci_lookup,p4_r82_ci_runtime;
CREATE TABLE p4_r84_ci.app_entitlements(
 organization_id p4_r82_ci.uuid_v4 NOT NULL REFERENCES p4_r82_ci.organizations(id),
 app_code text NOT NULL CHECK(app_code IN ('platform','crm')),
 active boolean NOT NULL DEFAULT false,
 PRIMARY KEY(organization_id,app_code));
CREATE TABLE p4_r84_ci.sales_roles(
 organization_id p4_r82_ci.uuid_v4 NOT NULL,user_id p4_r82_ci.uuid_v4 NOT NULL,
 role_code text NOT NULL CHECK(role_code IN ('SALES_REP','SALES_MANAGER')),
 active boolean NOT NULL DEFAULT true,
 PRIMARY KEY(organization_id,user_id),
 FOREIGN KEY(organization_id,user_id) REFERENCES p4_r82_ci.memberships(organization_id,user_id));
CREATE TABLE p4_r84_ci.audit_events(
 organization_id p4_r82_ci.uuid_v4 NOT NULL,id p4_r82_ci.uuid_v4 NOT NULL,
 actor_id p4_r82_ci.uuid_v4 NOT NULL,
 action text NOT NULL CHECK(action IN ('membership.changed','file.created','file.scanned','file.downloaded','file.deleted','notice.read')),
 occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(organization_id,id),
 FOREIGN KEY(organization_id,actor_id) REFERENCES p4_r82_ci.memberships(organization_id,user_id));
CREATE FUNCTION p4_r84_ci.immutable() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN RAISE EXCEPTION USING ERRCODE='P4003',MESSAGE='IMMUTABLE'; END $$;
REVOKE ALL ON FUNCTION p4_r84_ci.immutable() FROM PUBLIC;
CREATE TRIGGER immutable_audit BEFORE UPDATE OR DELETE ON p4_r84_ci.audit_events FOR EACH ROW EXECUTE FUNCTION p4_r84_ci.immutable();
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['app_entitlements','sales_roles','audit_events'] LOOP
  EXECUTE format('ALTER TABLE p4_r84_ci.%I OWNER TO p4_r82_ci_owner',t);
  EXECUTE format('ALTER TABLE p4_r84_ci.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE p4_r84_ci.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY r84_lookup ON p4_r84_ci.%I FOR SELECT TO p4_r82_ci_lookup USING(true)',t);
 END LOOP;
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA p4_r84_ci FROM PUBLIC,p4_r82_ci_runtime;
GRANT SELECT ON ALL TABLES IN SCHEMA p4_r84_ci TO p4_r82_ci_lookup;
GRANT SELECT(display_name) ON p4_r82_ci.organizations TO p4_r82_ci_lookup;
CREATE FUNCTION p4_r84_ci.require_member(p_issuer text,p_subject text,p_org uuid,p_app text)
 RETURNS TABLE(actor uuid,role text)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 RETURN QUERY SELECT m.actor_id,m.membership_role FROM p4_r82_ci.membership_check(p_issuer,p_subject,p_org) m
 WHERE EXISTS(SELECT 1 FROM p4_r84_ci.app_entitlements e WHERE e.organization_id=p_org AND e.app_code=p_app AND e.active);
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P4003',MESSAGE='ACCESS_DENIED'; END IF;
END $$;
ALTER FUNCTION p4_r84_ci.require_member(text,text,uuid,text) OWNER TO p4_r82_ci_lookup;
REVOKE ALL ON FUNCTION p4_r84_ci.require_member(text,text,uuid,text) FROM PUBLIC;
CREATE FUNCTION p4_r84_ci.platform_read(p_issuer text,p_subject text,p_org uuid,p_resource text,p_after uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE who uuid; membership_role text; sales text; result jsonb;
BEGIN
 SELECT m.actor,m.role INTO who,membership_role FROM p4_r84_ci.require_member(p_issuer,p_subject,p_org,'platform') m;
 IF p_resource='navigation' THEN
  SELECT r.role_code INTO sales FROM p4_r84_ci.sales_roles r WHERE r.organization_id=p_org AND r.user_id=who AND r.active;
  RETURN jsonb_build_object('organizationId',p_org,'membershipRole',membership_role,'crmAvailable',
   membership_role='MEMBER' AND sales IS NOT NULL AND EXISTS(SELECT 1 FROM p4_r84_ci.app_entitlements e WHERE e.organization_id=p_org AND e.app_code='crm' AND e.active));
 END IF;
 IF membership_role<>'OWNER' THEN RAISE EXCEPTION USING ERRCODE='P4003',MESSAGE='ACCESS_DENIED'; END IF;
 IF p_resource='organization' THEN
  RETURN (SELECT jsonb_build_object('id',o.id,'displayName',o.display_name) FROM p4_r82_ci.organizations o WHERE o.id=p_org AND o.active);
 ELSIF p_resource='members' THEN
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',s.user_id,'role',s.role) ORDER BY s.user_id),'[]') INTO result FROM
   (SELECT m.user_id,m.role FROM p4_r82_ci.memberships m JOIN p4_r82_ci.users u ON u.id=m.user_id AND u.active
   WHERE m.organization_id=p_org AND m.active AND (p_after IS NULL OR m.user_id>p_after) ORDER BY m.user_id LIMIT 21) s;
 ELSIF p_resource='entitlements' THEN
  SELECT coalesce(jsonb_agg(jsonb_build_object('app',e.app_code,'active',e.active) ORDER BY e.app_code),'[]') INTO result FROM p4_r84_ci.app_entitlements e WHERE e.organization_id=p_org;
 ELSIF p_resource='audit' THEN
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',s.id,'action',s.action,'occurredAt',to_char(s.occurred_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) ORDER BY s.id),'[]') INTO result FROM
   (SELECT a.id,a.action,a.occurred_at FROM p4_r84_ci.audit_events a WHERE a.organization_id=p_org AND (p_after IS NULL OR a.id>p_after) ORDER BY a.id LIMIT 21) s;
 ELSE RAISE EXCEPTION USING ERRCODE='P8400',MESSAGE='INVALID_INPUT'; END IF;
 RETURN result;
END $$;
ALTER FUNCTION p4_r84_ci.platform_read(text,text,uuid,text,uuid) OWNER TO p4_r82_ci_lookup;
REVOKE ALL ON FUNCTION p4_r84_ci.platform_read(text,text,uuid,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p4_r84_ci.platform_read(text,text,uuid,text,uuid) TO p4_r82_ci_runtime;
COMMIT;
