-- P5 batch 3: disposable CI only; no external migration.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' OR current_user<>'demo_ci'
 OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
 OR to_regclass('p5_ci.stage_edit_grants') IS NULL THEN RAISE EXCEPTION 'P5_DISPOSABLE_ONLY'; END IF;
END $$;
ALTER TABLE p5_ci.lead_events DROP CONSTRAINT lead_event_shape,
 ADD COLUMN previous_owner_id uuid,ADD COLUMN next_owner_id uuid,
 ADD CONSTRAINT lead_event_shape CHECK(
 ((action='CREATED' AND revision=0 AND previous_status IS NULL AND next_status IS NULL) OR
 (action='EDITED' AND revision BETWEEN 1 AND 1000000 AND previous_status IS NULL AND next_status IS NULL) OR
 (action='STAGE_CHANGED' AND revision BETWEEN 1 AND 1000000 AND previous_status IS NOT NULL AND next_status IS NOT NULL
 AND ((previous_status='NEW' AND next_status='CONTACTED') OR (previous_status='CONTACTED' AND next_status IN ('QUALIFIED','LOST')))))
 AND previous_owner_id IS NULL AND next_owner_id IS NULL
 OR (action='ASSIGNED' AND revision BETWEEN 1 AND 1000000 AND previous_status IS NULL AND next_status IS NULL
 AND previous_owner_id IS NOT NULL AND next_owner_id IS NOT NULL AND previous_owner_id<>next_owner_id)),
 ADD FOREIGN KEY(organization_id,previous_owner_id) REFERENCES platform_stage.memberships(organization_id,user_id),
 ADD FOREIGN KEY(organization_id,next_owner_id) REFERENCES platform_stage.memberships(organization_id,user_id);
GRANT UPDATE(owner_id) ON p5_ci.leads TO p5_ci_definer;
-- No team change or role assignment. The eligible list is current, narrow and
-- uses existing active membership, team grant and sales rep policy.
CREATE FUNCTION p5_ci.eligible_assignees(p_org uuid,p_team uuid,p_actor uuid,p_after uuid,p_target uuid)
 RETURNS TABLE(user_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT m.user_id FROM platform_stage.memberships m
 JOIN platform_stage.users u ON u.id=m.user_id AND u.active
 JOIN platform_stage.organizations o ON o.id=m.organization_id AND o.active
 JOIN platform_stage.teams t ON t.organization_id=m.organization_id AND t.id=p_team AND t.active
 JOIN platform_stage.team_grants g ON g.organization_id=m.organization_id AND g.user_id=m.user_id AND g.team_id=t.id AND g.active
 JOIN platform_stage.sales_grants s ON s.organization_id=m.organization_id AND s.user_id=m.user_id AND s.role_code='SALES_REP' AND s.active
 WHERE current_database()='zoho_clone_synthetic_ci' AND session_user='p5_ci_runtime'
 AND m.organization_id=p_org AND m.active AND m.role='MEMBER' AND m.user_id<>p_actor
 AND (p_after IS NULL OR m.user_id>p_after) AND (p_target IS NULL OR m.user_id=p_target)
 ORDER BY m.user_id LIMIT 21
 $$;
GRANT CREATE ON SCHEMA p5_ci TO p4_stage_lookup,p5_ci_definer;
ALTER FUNCTION p5_ci.eligible_assignees(uuid,uuid,uuid,uuid,uuid) OWNER TO p4_stage_lookup;
REVOKE ALL ON FUNCTION p5_ci.eligible_assignees(uuid,uuid,uuid,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p5_ci.eligible_assignees(uuid,uuid,uuid,uuid,uuid) TO p5_ci_definer;
CREATE FUNCTION p5_ci.assignment_options(p_issuer text,p_subject text,p_org uuid,p_id uuid,p_after uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 DECLARE who record; l p5_ci.leads%ROWTYPE; result jsonb;
 BEGIN
 IF current_setting('transaction_read_only')<>'on' THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 SELECT * INTO who FROM p5_ci.actor(p_issuer,p_subject,p_org);
 IF NOT FOUND OR NOT who.manager THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 SELECT * INTO l FROM p5_ci.leads x WHERE x.organization_id=p_org AND x.id=p_id AND x.team_id IS NOT NULL AND platform_stage.team_membership_check(p_issuer,p_subject,p_org,x.team_id);
 IF NOT FOUND THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='P5004'; END IF;
 SELECT coalesce(jsonb_agg(e.user_id ORDER BY e.user_id),'[]'::jsonb) INTO result FROM p5_ci.eligible_assignees(p_org,l.team_id,who.actor_id,p_after,NULL) e;
 RETURN jsonb_build_object('currentOwnerId',l.owner_id,'revision',l.revision,'eligible',result);
 END $$;
CREATE FUNCTION p5_ci.assign_lead(p_issuer text,p_subject text,p_org uuid,p_id uuid,p_request uuid,p_revision integer,p_owner uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
 DECLARE who record; l p5_ci.leads%ROWTYPE; previous p5_ci.lead_events%ROWTYPE; fingerprint text; old_owner uuid;
 BEGIN
 IF current_setting('transaction_isolation')<>'serializable' THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 SELECT * INTO who FROM p5_ci.actor(p_issuer,p_subject,p_org);
 IF NOT FOUND OR NOT who.manager THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 IF p_id IS NULL OR p_owner IS NULL OR p_request IS NULL OR substring(p_request::text from 15 for 1)<>'4' OR substring(p_request::text from 20 for 1) NOT IN ('8','9','a','b')
 OR p_revision IS NULL OR p_revision<0 OR p_revision>=1000000 THEN RAISE EXCEPTION 'P5_INVALID' USING ERRCODE='22023'; END IF;
 SELECT * INTO l FROM p5_ci.leads x WHERE x.organization_id=p_org AND x.id=p_id AND x.team_id IS NOT NULL AND platform_stage.team_membership_check(p_issuer,p_subject,p_org,x.team_id) FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='P5004'; END IF;
 IF NOT EXISTS(SELECT 1 FROM p5_ci.eligible_assignees(p_org,l.team_id,who.actor_id,NULL,p_owner)) THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 fingerprint:=encode(sha256(convert_to(jsonb_build_array(p_id,p_revision,'assign',p_owner)::text,'UTF8')),'hex');
 SELECT * INTO previous FROM p5_ci.lead_events WHERE organization_id=p_org AND request_id=p_request;
 IF FOUND THEN
  IF previous.actor_id<>who.actor_id OR previous.lead_id<>p_id OR previous.action<>'ASSIGNED' OR previous.request_digest<>fingerprint THEN RAISE EXCEPTION 'P5_CONFLICT' USING ERRCODE='23505'; END IF;
  RETURN jsonb_build_object('outcome','replay','lead',p5_ci.project(l));
 END IF;
 IF l.revision<>p_revision OR l.owner_id=p_owner THEN RAISE EXCEPTION 'P5_CONFLICT' USING ERRCODE='23505'; END IF;
 old_owner:=l.owner_id;
 UPDATE p5_ci.leads SET owner_id=p_owner,revision=revision+1 WHERE organization_id=p_org AND id=p_id RETURNING * INTO l;
 INSERT INTO p5_ci.lead_events(organization_id,request_id,lead_id,actor_id,action,revision,request_digest,previous_owner_id,next_owner_id)
 VALUES(p_org,p_request,p_id,who.actor_id,'ASSIGNED',l.revision,fingerprint,old_owner,p_owner);
 RETURN jsonb_build_object('outcome','applied','lead',p5_ci.project(l));
 END $$;
CREATE FUNCTION p5_ci.duplicate_candidates(p_issuer text,p_subject text,p_org uuid,p_company text,p_email text,p_after uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 DECLARE who record; result jsonb;
 BEGIN
 IF current_setting('transaction_read_only')<>'on' THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 IF p_company IS NULL OR p_company !~ '^Demo [A-Za-z][A-Za-z0-9 &.-]{2,48}$' OR p_email IS NULL OR p_email !~ '^[a-z][a-z0-9._-]{1,40}@example[.]com$' THEN RAISE EXCEPTION 'P5_INVALID' USING ERRCODE='22023'; END IF;
 SELECT * INTO who FROM p5_ci.actor(p_issuer,p_subject,p_org);
 IF NOT FOUND OR NOT(who.rep OR who.manager) THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 SELECT coalesce(jsonb_agg(p5_ci.project(l.lead_row) ORDER BY l.id),'[]'::jsonb) INTO result FROM
 (SELECT x AS lead_row,x.id FROM p5_ci.leads x WHERE x.organization_id=p_org AND (p_after IS NULL OR x.id>p_after)
 AND (lower(x.company_name)=lower(p_company) OR x.contact_email=p_email)
 AND ((who.rep AND x.owner_id=who.actor_id) OR (x.team_id IS NOT NULL AND platform_stage.team_membership_check(p_issuer,p_subject,p_org,x.team_id)))
 ORDER BY x.id LIMIT 21) l;
 RETURN result;
 END $$;
ALTER FUNCTION p5_ci.assignment_options(text,text,uuid,uuid,uuid) OWNER TO p5_ci_definer;
ALTER FUNCTION p5_ci.assign_lead(text,text,uuid,uuid,uuid,integer,uuid) OWNER TO p5_ci_definer;
ALTER FUNCTION p5_ci.duplicate_candidates(text,text,uuid,text,text,uuid) OWNER TO p5_ci_definer;
REVOKE CREATE ON SCHEMA p5_ci FROM p5_ci_definer,p4_stage_lookup;
REVOKE ALL ON FUNCTION p5_ci.assignment_options(text,text,uuid,uuid,uuid),p5_ci.assign_lead(text,text,uuid,uuid,uuid,integer,uuid),p5_ci.duplicate_candidates(text,text,uuid,text,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p5_ci.assignment_options(text,text,uuid,uuid,uuid),p5_ci.assign_lead(text,text,uuid,uuid,uuid,integer,uuid),p5_ci.duplicate_candidates(text,text,uuid,text,text,uuid) TO p5_ci_runtime;
COMMIT;
