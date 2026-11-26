-- Disposable implementation rehearsal only; no external database execution authorized.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' OR current_user<>'demo_ci'
 OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
 OR to_regnamespace('platform_stage') IS NULL THEN RAISE EXCEPTION 'DISPOSABLE_ONLY'; END IF;
END $$;
CREATE ROLE p4_stage_grant_definer NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
CREATE ROLE p4_stage_grant_writer LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
GRANT USAGE ON SCHEMA platform_stage TO p4_stage_grant_definer,p4_stage_grant_writer;
GRANT SELECT ON platform_stage.users,platform_stage.identity_subjects,platform_stage.organizations,platform_stage.memberships TO p4_stage_grant_definer;
CREATE POLICY grant_users_read ON platform_stage.users FOR SELECT TO p4_stage_grant_definer USING(active);
CREATE POLICY grant_identity_read ON platform_stage.identity_subjects FOR SELECT TO p4_stage_grant_definer USING(active AND verified);
CREATE POLICY grant_org_read ON platform_stage.organizations FOR SELECT TO p4_stage_grant_definer USING(active);
CREATE POLICY grant_member_read ON platform_stage.memberships FOR SELECT TO p4_stage_grant_definer USING(active);

CREATE TABLE platform_stage.sales_grants(
 organization_id uuid NOT NULL,user_id uuid NOT NULL,
 role_code text NOT NULL CHECK(role_code IN ('SALES_REP','SALES_MANAGER')),
 active boolean NOT NULL DEFAULT false,revision integer NOT NULL DEFAULT 0 CHECK(revision>=0 AND revision<=1000000000),
 PRIMARY KEY(organization_id,user_id,role_code),
 FOREIGN KEY(organization_id,user_id) REFERENCES platform_stage.memberships(organization_id,user_id) ON DELETE RESTRICT
);
CREATE TABLE platform_stage.grant_audit(
 organization_id uuid NOT NULL,request_id uuid NOT NULL,actor_id uuid NOT NULL,target_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('role_grant','team_grant')),target_ref text NOT NULL,
 before_active boolean NOT NULL,after_active boolean NOT NULL,previous_revision integer NOT NULL CHECK(previous_revision>=0),
 applied_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(organization_id,request_id),
 CHECK(before_active<>after_active)
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['sales_grants','grant_audit'] LOOP
  EXECUTE format('ALTER TABLE platform_stage.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE platform_stage.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE platform_stage.%I OWNER TO p4_stage_owner',t);
  EXECUTE format('REVOKE ALL ON platform_stage.%I FROM PUBLIC,p4_stage_runtime,p4_stage_grant_writer',t);
 END LOOP;
END $$;
GRANT SELECT ON platform_stage.sales_grants,platform_stage.grant_audit TO p4_stage_grant_definer;
GRANT UPDATE(active,revision) ON platform_stage.sales_grants TO p4_stage_grant_definer;
GRANT INSERT ON platform_stage.grant_audit TO p4_stage_grant_definer;
CREATE POLICY grant_sales_read ON platform_stage.sales_grants FOR SELECT TO p4_stage_grant_definer USING(true);
CREATE POLICY grant_sales_update ON platform_stage.sales_grants FOR UPDATE TO p4_stage_grant_definer USING(true) WITH CHECK(true);
CREATE POLICY grant_audit_read ON platform_stage.grant_audit FOR SELECT TO p4_stage_grant_definer USING(true);
CREATE POLICY grant_audit_insert ON platform_stage.grant_audit FOR INSERT TO p4_stage_grant_definer WITH CHECK(true);
CREATE FUNCTION platform_stage.grant_audit_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
 BEGIN RAISE EXCEPTION 'P4_GRANT_AUDIT_IMMUTABLE'; END $$;
REVOKE ALL ON FUNCTION platform_stage.grant_audit_immutable() FROM PUBLIC;
CREATE TRIGGER grant_audit_immutable BEFORE UPDATE OR DELETE ON platform_stage.grant_audit FOR EACH ROW EXECUTE FUNCTION platform_stage.grant_audit_immutable();

-- Recheck actual identity/membership inside the SERIALIZABLE transaction, never client role claims.
CREATE FUNCTION platform_stage.grant_actor(p_issuer text,p_subject text,p_org uuid,p_target uuid)
 RETURNS uuid LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
 DECLARE actor uuid;
 BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' OR session_user<>'p4_stage_grant_writer'
 OR current_setting('transaction_isolation')<>'serializable' OR p_target IS NULL THEN RETURN NULL; END IF;
 SELECT u.id INTO actor FROM platform_stage.identity_subjects s
 JOIN platform_stage.users u ON u.id=s.user_id AND u.active
 JOIN platform_stage.organizations o ON o.id=p_org AND o.active
 JOIN platform_stage.memberships m ON m.organization_id=o.id AND m.user_id=u.id AND m.active AND m.role='OWNER'
 WHERE s.issuer=p_issuer AND s.subject=p_subject AND s.verified AND s.active;
 IF actor IS NULL OR actor=p_target OR NOT EXISTS(
  SELECT 1 FROM platform_stage.memberships m JOIN platform_stage.users u ON u.id=m.user_id AND u.active
  WHERE m.organization_id=p_org AND m.user_id=p_target AND m.active AND m.role='MEMBER'
 ) THEN RETURN NULL; END IF;
 RETURN actor;
 END $$;
REVOKE ALL ON FUNCTION platform_stage.grant_actor(text,text,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION platform_stage.grant_actor(text,text,uuid,uuid) TO p4_stage_grant_definer;

CREATE FUNCTION platform_stage.list_sales_grants(p_issuer text,p_subject text,p_org uuid,p_target uuid)
 RETURNS TABLE(role_code text,active boolean,revision integer)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 BEGIN
 IF platform_stage.grant_actor(p_issuer,p_subject,p_org,p_target) IS NULL THEN RAISE EXCEPTION 'P4_GRANT_DENIED' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT g.role_code,g.active,g.revision FROM platform_stage.sales_grants g
 WHERE g.organization_id=p_org AND g.user_id=p_target ORDER BY g.role_code;
 END $$;
CREATE FUNCTION platform_stage.toggle_sales_grant(p_issuer text,p_subject text,p_org uuid,p_target uuid,p_role text,
 p_before boolean,p_after boolean,p_revision integer,p_request uuid)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
 DECLARE actor uuid; prior platform_stage.grant_audit%ROWTYPE; g platform_stage.sales_grants%ROWTYPE;
 BEGIN
 actor:=platform_stage.grant_actor(p_issuer,p_subject,p_org,p_target);
 IF actor IS NULL OR p_role IS NULL OR p_role NOT IN ('SALES_REP','SALES_MANAGER')
 OR p_before IS NULL OR p_after IS NULL OR p_before=p_after OR p_revision IS NULL OR p_revision<0 OR p_revision>=1000000000
 OR p_request IS NULL OR substring(p_request::text from 15 for 1)<>'4' OR substring(p_request::text from 20 for 1) NOT IN ('8','9','a','b')
 THEN RETURN 'denied'; END IF;
 SELECT * INTO prior FROM platform_stage.grant_audit WHERE organization_id=p_org AND request_id=p_request;
 IF FOUND THEN
  IF prior.actor_id=actor AND prior.target_id=p_target AND prior.kind='role_grant' AND prior.target_ref=p_role
   AND prior.before_active=p_before AND prior.after_active=p_after AND prior.previous_revision=p_revision THEN RETURN 'replay'; END IF;
  RETURN 'conflict';
 END IF;
 SELECT * INTO g FROM platform_stage.sales_grants WHERE organization_id=p_org AND user_id=p_target AND role_code=p_role FOR UPDATE;
 IF NOT FOUND THEN RETURN 'denied'; END IF;
 IF g.active<>p_before OR g.revision<>p_revision THEN RETURN 'conflict'; END IF;
 UPDATE platform_stage.sales_grants SET active=p_after,revision=revision+1 WHERE organization_id=p_org AND user_id=p_target AND role_code=p_role;
 INSERT INTO platform_stage.grant_audit(organization_id,request_id,actor_id,target_id,kind,target_ref,before_active,after_active,previous_revision)
 VALUES(p_org,p_request,actor,p_target,'role_grant',p_role,p_before,p_after,p_revision);
 RETURN 'applied';
 END $$;
GRANT CREATE ON SCHEMA platform_stage TO p4_stage_grant_definer;
ALTER FUNCTION platform_stage.list_sales_grants(text,text,uuid,uuid) OWNER TO p4_stage_grant_definer;
ALTER FUNCTION platform_stage.toggle_sales_grant(text,text,uuid,uuid,text,boolean,boolean,integer,uuid) OWNER TO p4_stage_grant_definer;
REVOKE CREATE ON SCHEMA platform_stage FROM p4_stage_grant_definer;
REVOKE ALL ON FUNCTION platform_stage.list_sales_grants(text,text,uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION platform_stage.toggle_sales_grant(text,text,uuid,uuid,text,boolean,boolean,integer,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION platform_stage.list_sales_grants(text,text,uuid,uuid) TO p4_stage_grant_writer;
GRANT EXECUTE ON FUNCTION platform_stage.toggle_sales_grant(text,text,uuid,uuid,text,boolean,boolean,integer,uuid) TO p4_stage_grant_writer;
COMMIT;
