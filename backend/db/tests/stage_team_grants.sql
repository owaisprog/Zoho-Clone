-- Disposable CI only; no external migration or customer grants.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' OR current_user<>'demo_ci'
 OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
 OR to_regclass('platform_stage.grant_audit') IS NULL THEN RAISE EXCEPTION 'DISPOSABLE_ONLY'; END IF;
END $$;
CREATE TABLE platform_stage.teams(
 organization_id uuid NOT NULL REFERENCES platform_stage.organizations(id) ON DELETE RESTRICT,
 id uuid NOT NULL CHECK(substring(id::text from 15 for 1)='4' AND substring(id::text from 20 for 1) IN ('8','9','a','b')),
 active boolean NOT NULL DEFAULT true,PRIMARY KEY(organization_id,id)
);
CREATE TABLE platform_stage.team_grants(
 organization_id uuid NOT NULL,user_id uuid NOT NULL,team_id uuid NOT NULL,
 active boolean NOT NULL DEFAULT false,managed boolean NOT NULL DEFAULT false,
 revision integer NOT NULL DEFAULT 0 CHECK(revision>=0 AND revision<=1000000000),
 PRIMARY KEY(organization_id,user_id,team_id),
 FOREIGN KEY(organization_id,user_id) REFERENCES platform_stage.memberships(organization_id,user_id) ON DELETE RESTRICT,
 FOREIGN KEY(organization_id,team_id) REFERENCES platform_stage.teams(organization_id,id) ON DELETE RESTRICT
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['teams','team_grants'] LOOP
  EXECUTE format('ALTER TABLE platform_stage.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE platform_stage.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE platform_stage.%I OWNER TO p4_stage_owner',t);
  EXECUTE format('REVOKE ALL ON platform_stage.%I FROM PUBLIC,p4_stage_runtime,p4_stage_grant_writer',t);
 END LOOP;
END $$;
GRANT SELECT ON platform_stage.teams,platform_stage.team_grants TO p4_stage_grant_definer,p4_stage_lookup;
GRANT UPDATE(active,revision) ON platform_stage.team_grants TO p4_stage_grant_definer;
CREATE POLICY team_read ON platform_stage.teams FOR SELECT TO p4_stage_grant_definer,p4_stage_lookup USING(active);
CREATE POLICY team_grant_read ON platform_stage.team_grants FOR SELECT TO p4_stage_grant_definer USING(NOT managed);
CREATE POLICY team_grant_update ON platform_stage.team_grants FOR UPDATE TO p4_stage_grant_definer USING(NOT managed) WITH CHECK(NOT managed);
CREATE POLICY team_member_read ON platform_stage.team_grants FOR SELECT TO p4_stage_lookup USING(active);
CREATE FUNCTION platform_stage.list_team_grants(p_issuer text,p_subject text,p_org uuid,p_target uuid,p_after uuid)
 RETURNS TABLE(team_id uuid,active boolean,revision integer)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 BEGIN
 IF platform_stage.grant_actor(p_issuer,p_subject,p_org,p_target) IS NULL THEN RAISE EXCEPTION 'P4_GRANT_DENIED' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT g.team_id,g.active,g.revision FROM platform_stage.team_grants g
 JOIN platform_stage.teams t ON t.organization_id=g.organization_id AND t.id=g.team_id AND t.active
 WHERE g.organization_id=p_org AND g.user_id=p_target AND NOT g.managed
 AND (p_after IS NULL OR g.team_id>p_after) ORDER BY g.team_id LIMIT 21;
 END $$;
CREATE FUNCTION platform_stage.toggle_team_grant(p_issuer text,p_subject text,p_org uuid,p_target uuid,p_team uuid,
 p_before boolean,p_after boolean,p_revision integer,p_request uuid)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
 DECLARE actor uuid; prior platform_stage.grant_audit%ROWTYPE; g platform_stage.team_grants%ROWTYPE;
 BEGIN
 actor:=platform_stage.grant_actor(p_issuer,p_subject,p_org,p_target);
 IF actor IS NULL OR p_team IS NULL OR p_before IS NULL OR p_after IS NULL OR p_before=p_after
 OR p_revision IS NULL OR p_revision<0 OR p_revision>=1000000000
 OR p_request IS NULL OR substring(p_request::text from 15 for 1)<>'4' OR substring(p_request::text from 20 for 1) NOT IN ('8','9','a','b')
 OR NOT EXISTS(SELECT 1 FROM platform_stage.teams WHERE organization_id=p_org AND id=p_team AND active)
 THEN RETURN 'denied'; END IF;
 SELECT * INTO g FROM platform_stage.team_grants WHERE organization_id=p_org AND user_id=p_target AND team_id=p_team AND NOT managed FOR UPDATE;
 IF NOT FOUND THEN RETURN 'denied'; END IF;
 SELECT * INTO prior FROM platform_stage.grant_audit WHERE organization_id=p_org AND request_id=p_request;
 IF FOUND THEN
  IF prior.actor_id=actor AND prior.target_id=p_target AND prior.kind='team_grant' AND prior.target_ref=p_team::text
   AND prior.before_active=p_before AND prior.after_active=p_after AND prior.previous_revision=p_revision THEN RETURN 'replay'; END IF;
  RETURN 'conflict';
 END IF;
 IF g.active<>p_before OR g.revision<>p_revision THEN RETURN 'conflict'; END IF;
 UPDATE platform_stage.team_grants SET active=p_after,revision=revision+1 WHERE organization_id=p_org AND user_id=p_target AND team_id=p_team;
 INSERT INTO platform_stage.grant_audit(organization_id,request_id,actor_id,target_id,kind,target_ref,before_active,after_active,previous_revision)
 VALUES(p_org,p_request,actor,p_target,'team_grant',p_team::text,p_before,p_after,p_revision);
 RETURN 'applied';
 END $$;
-- A fresh read of effective team membership; never implies CRM authorization.
CREATE FUNCTION platform_stage.team_membership_check(p_issuer text,p_subject text,p_org uuid,p_team uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM platform_stage.identity_subjects s
 JOIN platform_stage.users u ON u.id=s.user_id AND u.active
 JOIN platform_stage.memberships m ON m.user_id=u.id AND m.organization_id=p_org AND m.active
 JOIN platform_stage.organizations o ON o.id=m.organization_id AND o.active
 JOIN platform_stage.team_grants g ON g.organization_id=m.organization_id AND g.user_id=m.user_id AND g.team_id=p_team AND g.active
 JOIN platform_stage.teams t ON t.organization_id=g.organization_id AND t.id=g.team_id AND t.active
 WHERE s.issuer=p_issuer AND s.subject=p_subject AND s.active AND s.verified)
$$;
GRANT CREATE ON SCHEMA platform_stage TO p4_stage_grant_definer,p4_stage_lookup;
ALTER FUNCTION platform_stage.list_team_grants(text,text,uuid,uuid,uuid) OWNER TO p4_stage_grant_definer;
ALTER FUNCTION platform_stage.toggle_team_grant(text,text,uuid,uuid,uuid,boolean,boolean,integer,uuid) OWNER TO p4_stage_grant_definer;
ALTER FUNCTION platform_stage.team_membership_check(text,text,uuid,uuid) OWNER TO p4_stage_lookup;
REVOKE CREATE ON SCHEMA platform_stage FROM p4_stage_grant_definer,p4_stage_lookup;
REVOKE ALL ON FUNCTION platform_stage.list_team_grants(text,text,uuid,uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION platform_stage.toggle_team_grant(text,text,uuid,uuid,uuid,boolean,boolean,integer,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION platform_stage.team_membership_check(text,text,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION platform_stage.list_team_grants(text,text,uuid,uuid,uuid) TO p4_stage_grant_writer;
GRANT EXECUTE ON FUNCTION platform_stage.toggle_team_grant(text,text,uuid,uuid,uuid,boolean,boolean,integer,uuid) TO p4_stage_grant_writer;
GRANT EXECUTE ON FUNCTION platform_stage.team_membership_check(text,text,uuid,uuid) TO p4_stage_runtime;
COMMIT;
