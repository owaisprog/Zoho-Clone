-- Disposable CI only. Extends the verified P5 lead schema, not an external migration.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' OR current_user<>'demo_ci'
 OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
 OR to_regclass('p5_ci.leads') IS NULL THEN RAISE EXCEPTION 'P5_DISPOSABLE_ONLY'; END IF;
END $$;
ALTER TABLE p5_ci.lead_events DROP CONSTRAINT lead_events_action_check,DROP CONSTRAINT lead_events_revision_check,
 ADD COLUMN previous_status text,ADD COLUMN next_status text,
 ADD CONSTRAINT lead_event_shape CHECK(
 (action='CREATED' AND revision=0 AND previous_status IS NULL AND next_status IS NULL) OR
 (action='EDITED' AND revision BETWEEN 1 AND 1000000 AND previous_status IS NULL AND next_status IS NULL) OR
 (action='STAGE_CHANGED' AND revision BETWEEN 1 AND 1000000 AND previous_status IS NOT NULL AND next_status IS NOT NULL
 AND ((previous_status='NEW' AND next_status='CONTACTED') OR (previous_status='CONTACTED' AND next_status IN ('QUALIFIED','LOST'))))),
 ADD UNIQUE(organization_id,lead_id,revision);
CREATE TABLE p5_ci.stage_edit_grants(
 organization_id uuid NOT NULL,user_id uuid NOT NULL,active boolean NOT NULL DEFAULT false,
 PRIMARY KEY(organization_id,user_id),
 FOREIGN KEY(organization_id,user_id) REFERENCES platform_stage.memberships(organization_id,user_id)
);
ALTER TABLE p5_ci.stage_edit_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE p5_ci.stage_edit_grants FORCE ROW LEVEL SECURITY;
ALTER TABLE p5_ci.stage_edit_grants OWNER TO p4_stage_owner;
REVOKE ALL ON p5_ci.stage_edit_grants FROM PUBLIC,p5_ci_runtime;
GRANT SELECT ON p5_ci.stage_edit_grants TO p5_ci_definer;
CREATE POLICY p5_stage_grant_read ON p5_ci.stage_edit_grants FOR SELECT TO p5_ci_definer USING(active);
GRANT UPDATE(company_name,contact_email,source,status,revision) ON p5_ci.leads TO p5_ci_definer;
CREATE POLICY p5_lead_update ON p5_ci.leads FOR UPDATE TO p5_ci_definer USING(true) WITH CHECK(true);
CREATE FUNCTION p5_ci.search_leads(p_issuer text,p_subject text,p_org uuid,p_after uuid,p_search text,p_source text,p_status text)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 DECLARE who record; result jsonb;
 BEGIN
 IF current_setting('transaction_read_only')<>'on' THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 IF p_search IS NULL OR p_search !~ '^[A-Za-z0-9 &.@_-]{0,50}$' OR (p_source IS NOT NULL AND p_source NOT IN ('WEBSITE','REFERRAL','EVENT'))
 OR (p_status IS NOT NULL AND p_status NOT IN ('NEW','CONTACTED','QUALIFIED','LOST')) THEN RAISE EXCEPTION 'P5_INVALID' USING ERRCODE='22023'; END IF;
 SELECT * INTO who FROM p5_ci.actor(p_issuer,p_subject,p_org);
 IF NOT FOUND OR NOT(who.rep OR who.manager) THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 SELECT coalesce(jsonb_agg(p5_ci.project(l.lead_row) ORDER BY l.id),'[]'::jsonb) INTO result FROM
 (SELECT x AS lead_row,x.id FROM p5_ci.leads x WHERE x.organization_id=p_org AND (p_after IS NULL OR x.id>p_after)
 AND (p_source IS NULL OR x.source=p_source) AND (p_status IS NULL OR x.status=p_status)
 AND (p_search='' OR strpos(lower(x.company_name),lower(p_search))>0 OR strpos(x.contact_email,lower(p_search))>0)
 AND ((who.rep AND x.owner_id=who.actor_id) OR (x.team_id IS NOT NULL AND platform_stage.team_membership_check(p_issuer,p_subject,p_org,x.team_id)))
 ORDER BY x.id LIMIT 21) l;
 RETURN result;
 END $$;
CREATE FUNCTION p5_ci.change_lead(p_issuer text,p_subject text,p_org uuid,p_id uuid,p_request uuid,p_revision integer,
 p_operation text,p_company text,p_email text,p_source text,p_status text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
 DECLARE who record; l p5_ci.leads%ROWTYPE; previous p5_ci.lead_events%ROWTYPE; fingerprint text; event_action text; prior_status text;
 BEGIN
 IF current_setting('transaction_isolation')<>'serializable' THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 SELECT * INTO who FROM p5_ci.actor(p_issuer,p_subject,p_org);
 IF NOT FOUND OR NOT(who.rep OR who.manager) THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 IF p_id IS NULL OR p_request IS NULL OR substring(p_request::text from 15 for 1)<>'4' OR substring(p_request::text from 20 for 1) NOT IN ('8','9','a','b')
 OR p_revision IS NULL OR p_revision<0 OR p_revision>=1000000 OR p_operation IS NULL OR p_operation NOT IN ('edit','transition') THEN RAISE EXCEPTION 'P5_INVALID' USING ERRCODE='22023'; END IF;
 SELECT x.* INTO l FROM p5_ci.leads x WHERE x.organization_id=p_org AND x.id=p_id
 AND ((who.rep AND x.owner_id=who.actor_id) OR (x.team_id IS NOT NULL AND platform_stage.team_membership_check(p_issuer,p_subject,p_org,x.team_id))) FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='P5004'; END IF;
 IF p_operation='edit' THEN
  IF p_company IS NULL OR p_company !~ '^Demo [A-Za-z][A-Za-z0-9 &.-]{2,48}$' OR p_email IS NULL OR p_email !~ '^[a-z][a-z0-9._-]{1,40}@example[.]com$' OR p_source IS NULL OR p_source NOT IN ('WEBSITE','REFERRAL','EVENT') OR p_status IS NOT NULL THEN RAISE EXCEPTION 'P5_INVALID' USING ERRCODE='22023'; END IF;
  event_action:='EDITED';
 ELSE
  IF NOT EXISTS(SELECT 1 FROM p5_ci.stage_edit_grants g WHERE g.organization_id=p_org AND g.user_id=who.actor_id AND g.active) THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
  IF p_company IS NOT NULL OR p_email IS NOT NULL OR p_source IS NOT NULL OR p_status IS NULL OR p_status NOT IN ('CONTACTED','QUALIFIED','LOST') THEN RAISE EXCEPTION 'P5_INVALID' USING ERRCODE='22023'; END IF;
  event_action:='STAGE_CHANGED';
 END IF;
 fingerprint:=encode(sha256(convert_to(jsonb_build_array(p_id,p_revision,p_operation,p_company,p_email,p_source,p_status)::text,'UTF8')),'hex');
 SELECT * INTO previous FROM p5_ci.lead_events WHERE organization_id=p_org AND request_id=p_request;
 IF FOUND THEN
  IF previous.actor_id<>who.actor_id OR previous.lead_id<>p_id OR previous.action<>event_action OR previous.request_digest<>fingerprint THEN RAISE EXCEPTION 'P5_CONFLICT' USING ERRCODE='23505'; END IF;
  RETURN jsonb_build_object('outcome','replay','lead',p5_ci.project(l));
 END IF;
 IF l.revision<>p_revision THEN RAISE EXCEPTION 'P5_CONFLICT' USING ERRCODE='23505'; END IF;
 IF p_operation='edit' THEN
  IF (l.company_name,l.contact_email,l.source)=(p_company,p_email,p_source) THEN RAISE EXCEPTION 'P5_CONFLICT' USING ERRCODE='23505'; END IF;
  UPDATE p5_ci.leads SET company_name=p_company,contact_email=p_email,source=p_source,revision=revision+1 WHERE organization_id=p_org AND id=p_id RETURNING * INTO l;
 ELSE
  prior_status:=l.status;
  IF NOT ((l.status='NEW' AND p_status='CONTACTED') OR (l.status='CONTACTED' AND p_status IN ('QUALIFIED','LOST'))) THEN RAISE EXCEPTION 'P5_CONFLICT' USING ERRCODE='23505'; END IF;
  UPDATE p5_ci.leads SET status=p_status,revision=revision+1 WHERE organization_id=p_org AND id=p_id RETURNING * INTO l;
 END IF;
 INSERT INTO p5_ci.lead_events(organization_id,request_id,lead_id,actor_id,action,revision,request_digest,previous_status,next_status)
 VALUES(p_org,p_request,p_id,who.actor_id,event_action,l.revision,fingerprint,prior_status,p_status);
 RETURN jsonb_build_object('outcome','applied','lead',p5_ci.project(l));
 END $$;
CREATE FUNCTION p5_ci.lead_history(p_issuer text,p_subject text,p_org uuid,p_id uuid,p_after integer)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 DECLARE who record; result jsonb;
 BEGIN
 IF current_setting('transaction_read_only')<>'on' OR p_id IS NULL OR p_after IS NULL OR p_after < -1 OR p_after>1000000 THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 SELECT * INTO who FROM p5_ci.actor(p_issuer,p_subject,p_org);
 IF NOT FOUND OR NOT(who.rep OR who.manager) THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM p5_ci.leads x WHERE x.organization_id=p_org AND x.id=p_id AND ((who.rep AND x.owner_id=who.actor_id) OR (x.team_id IS NOT NULL AND platform_stage.team_membership_check(p_issuer,p_subject,p_org,x.team_id)))) THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='P5004'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('action',e.action,'revision',e.revision,'previousStatus',e.previous_status,'nextStatus',e.next_status) ORDER BY e.revision),'[]'::jsonb) INTO result
 FROM (SELECT * FROM p5_ci.lead_events WHERE organization_id=p_org AND lead_id=p_id AND revision>p_after ORDER BY revision LIMIT 21) e;
 RETURN result;
 END $$;
GRANT CREATE ON SCHEMA p5_ci TO p5_ci_definer;
ALTER FUNCTION p5_ci.search_leads(text,text,uuid,uuid,text,text,text) OWNER TO p5_ci_definer;
ALTER FUNCTION p5_ci.change_lead(text,text,uuid,uuid,uuid,integer,text,text,text,text,text) OWNER TO p5_ci_definer;
ALTER FUNCTION p5_ci.lead_history(text,text,uuid,uuid,integer) OWNER TO p5_ci_definer;
REVOKE CREATE ON SCHEMA p5_ci FROM p5_ci_definer;
REVOKE ALL ON FUNCTION p5_ci.search_leads(text,text,uuid,uuid,text,text,text),p5_ci.change_lead(text,text,uuid,uuid,uuid,integer,text,text,text,text,text),p5_ci.lead_history(text,text,uuid,uuid,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p5_ci.search_leads(text,text,uuid,uuid,text,text,text),p5_ci.change_lead(text,text,uuid,uuid,uuid,integer,text,text,text,text,text),p5_ci.lead_history(text,text,uuid,uuid,integer) TO p5_ci_runtime;
COMMIT;
