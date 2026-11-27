-- P5.05-.08, disposable CI only. Original acquisition source is immutable.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' OR current_user<>'demo_ci'
 OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
 OR to_regclass('p5_ci.capture_submissions') IS NULL THEN RAISE EXCEPTION 'P5_DISPOSABLE_ONLY'; END IF;
END $$;
CREATE TABLE p5_ci.lead_source_history(
 organization_id uuid NOT NULL,lead_id uuid NOT NULL,revision integer NOT NULL,source text NOT NULL CHECK(source IN ('WEBSITE','REFERRAL','EVENT')),
 PRIMARY KEY(organization_id,lead_id,revision),
 FOREIGN KEY(organization_id,lead_id) REFERENCES p5_ci.leads(organization_id,id)
);
CREATE TABLE p5_ci.scoring_rules(
 organization_id uuid PRIMARY KEY REFERENCES platform_stage.organizations(id),
 website integer NOT NULL CHECK(website BETWEEN 0 AND 30),referral integer NOT NULL CHECK(referral BETWEEN 0 AND 30),event integer NOT NULL CHECK(event BETWEEN 0 AND 30),
 contacted integer NOT NULL CHECK(contacted BETWEEN 0 AND 30),qualified integer NOT NULL CHECK(qualified BETWEEN 0 AND 70),
 revision integer NOT NULL CHECK(revision BETWEEN 0 AND 1000000)
);
CREATE TABLE p5_ci.lead_assignment_rules(
 organization_id uuid NOT NULL,team_id uuid NOT NULL,source text NOT NULL CHECK(source IN ('WEBSITE','REFERRAL','EVENT')),
 primary_id uuid NOT NULL,fallback_id uuid NOT NULL,revision integer NOT NULL CHECK(revision BETWEEN 0 AND 1000000),
 PRIMARY KEY(organization_id,team_id,source),CHECK(primary_id<>fallback_id),
 FOREIGN KEY(organization_id,team_id) REFERENCES platform_stage.teams(organization_id,id),
 FOREIGN KEY(organization_id,primary_id) REFERENCES platform_stage.memberships(organization_id,user_id),
 FOREIGN KEY(organization_id,fallback_id) REFERENCES platform_stage.memberships(organization_id,user_id)
);
CREATE TABLE p5_ci.qualification_reasons(
 organization_id uuid NOT NULL,request_id uuid NOT NULL,lead_id uuid NOT NULL,reason text NOT NULL CHECK(reason IN ('FIT','NOT_FIT','NO_INTEREST')),
 PRIMARY KEY(organization_id,request_id),
 FOREIGN KEY(organization_id,request_id) REFERENCES p5_ci.lead_events(organization_id,request_id),
 FOREIGN KEY(organization_id,lead_id) REFERENCES p5_ci.leads(organization_id,id)
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['lead_source_history','scoring_rules','lead_assignment_rules','qualification_reasons'] LOOP
 EXECUTE format('ALTER TABLE p5_ci.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE p5_ci.%I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE p5_ci.%I OWNER TO p4_stage_owner',t);
 EXECUTE format('REVOKE ALL ON p5_ci.%I FROM PUBLIC,p5_ci_runtime',t);
 EXECUTE format('GRANT SELECT,INSERT ON p5_ci.%I TO p5_ci_definer',t);
 EXECUTE format('CREATE POLICY rule_read ON p5_ci.%I FOR SELECT TO p5_ci_definer USING(true)',t);
 EXECUTE format('CREATE POLICY rule_insert ON p5_ci.%I FOR INSERT TO p5_ci_definer WITH CHECK(true)',t);
 IF t IN ('scoring_rules','lead_assignment_rules') THEN
 EXECUTE format('CREATE POLICY rule_update ON p5_ci.%I FOR UPDATE TO p5_ci_definer USING(true) WITH CHECK(true)',t);
 ELSE
 EXECUTE format('CREATE TRIGGER rule_immutable BEFORE UPDATE OR DELETE ON p5_ci.%I FOR EACH ROW EXECUTE FUNCTION platform_stage.grant_audit_immutable()',t);
 END IF;
 END LOOP;
END $$;
GRANT UPDATE(website,referral,event,contacted,qualified,revision) ON p5_ci.scoring_rules TO p5_ci_definer;
GRANT UPDATE(primary_id,fallback_id,revision) ON p5_ci.lead_assignment_rules TO p5_ci_definer;
CREATE FUNCTION p5_ci.record_source() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
 BEGIN
 IF TG_OP='INSERT' THEN
 INSERT INTO p5_ci.lead_source_history VALUES(NEW.organization_id,NEW.id,NEW.revision,NEW.source);
 ELSIF NEW.source IS DISTINCT FROM OLD.source THEN
 INSERT INTO p5_ci.lead_source_history VALUES(NEW.organization_id,NEW.id,NEW.revision,NEW.source);
 END IF;
 RETURN NEW;
 END $$;
REVOKE ALL ON FUNCTION p5_ci.record_source() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p5_ci.record_source() TO p5_ci_definer,p4_stage_owner;
CREATE TRIGGER p5_record_source AFTER INSERT OR UPDATE OF source ON p5_ci.leads FOR EACH ROW EXECUTE FUNCTION p5_ci.record_source();
CREATE FUNCTION p5_ci.rules_visible_lead(p_issuer text,p_subject text,p_org uuid,p_id uuid) RETURNS p5_ci.leads LANGUAGE plpgsql STABLE SET search_path=pg_catalog AS $$
 DECLARE who record;l p5_ci.leads%ROWTYPE;
 BEGIN
 SELECT * INTO who FROM p5_ci.actor(p_issuer,p_subject,p_org);
 IF NOT FOUND OR NOT(who.rep OR who.manager) THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 SELECT * INTO l FROM p5_ci.leads x WHERE x.organization_id=p_org AND x.id=p_id AND ((who.rep AND x.owner_id=who.actor_id) OR (x.team_id IS NOT NULL AND platform_stage.team_membership_check(p_issuer,p_subject,p_org,x.team_id)));
 IF NOT FOUND THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='P5004'; END IF;
 RETURN l;
 END $$;
CREATE FUNCTION p5_ci.rule_config(p_org uuid) RETURNS jsonb LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT coalesce((SELECT jsonb_build_object('website',website,'referral',referral,'event',event,'contacted',contacted,'qualified',qualified,'revision',revision) FROM p5_ci.scoring_rules WHERE organization_id=p_org),
 '{"website":10,"referral":20,"event":15,"contacted":10,"qualified":60,"revision":-1}'::jsonb)
$$;
CREATE FUNCTION p5_ci.read_lead_rules(p_issuer text,p_subject text,p_org uuid,p_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 DECLARE l p5_ci.leads%ROWTYPE;cfg jsonb;original text;sp integer;qp integer;r text;
 BEGIN
 IF current_setting('transaction_read_only')<>'on' THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 l:=p5_ci.rules_visible_lead(p_issuer,p_subject,p_org,p_id);
 cfg:=p5_ci.rule_config(p_org);
 SELECT h.source INTO original FROM p5_ci.lead_source_history h WHERE h.organization_id=p_org AND h.lead_id=p_id ORDER BY h.revision LIMIT 1;
 IF original IS NULL THEN RAISE EXCEPTION 'P5_MISSING_SOURCE'; END IF;
 sp:=(cfg->>lower(original))::integer;
 qp:=CASE WHEN l.status IN ('QUALIFIED','CONVERTED') THEN (cfg->>'qualified')::integer WHEN l.status='CONTACTED' THEN (cfg->>'contacted')::integer ELSE 0 END;
 SELECT q.reason INTO r FROM p5_ci.qualification_reasons q JOIN p5_ci.lead_events e ON e.organization_id=q.organization_id AND e.request_id=q.request_id WHERE q.organization_id=p_org AND q.lead_id=p_id ORDER BY e.revision DESC LIMIT 1;
 RETURN jsonb_build_object('id',l.id,'originalSource',original,'latestSource',l.source,'status',l.status,'revision',l.revision,'sourcePoints',sp,'statusPoints',qp,'score',sp+qp,'reason',r,'config',cfg);
 END $$;
CREATE FUNCTION p5_ci.write_score_rule(p_issuer text,p_subject text,p_org uuid,p_expected integer,p_website integer,p_referral integer,p_event integer,p_contacted integer,p_qualified integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
 DECLARE who record;cfg jsonb;
 BEGIN
 IF current_setting('transaction_isolation')<>'serializable' THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 SELECT * INTO who FROM p5_ci.actor(p_issuer,p_subject,p_org);
 IF NOT FOUND OR NOT who.manager THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 IF p_expected IS NULL OR p_expected NOT BETWEEN -1 AND 999999 OR p_website IS NULL OR p_website NOT BETWEEN 0 AND 30 OR p_referral IS NULL OR p_referral NOT BETWEEN 0 AND 30 OR p_event IS NULL OR p_event NOT BETWEEN 0 AND 30 OR p_contacted IS NULL OR p_contacted NOT BETWEEN 0 AND 30 OR p_qualified IS NULL OR p_qualified NOT BETWEEN 0 AND 70 THEN RAISE EXCEPTION 'P5_INVALID' USING ERRCODE='22023'; END IF;
 cfg:=p5_ci.rule_config(p_org);
 IF (cfg->>'revision')::integer=p_expected+1 AND cfg= jsonb_build_object('website',p_website,'referral',p_referral,'event',p_event,'contacted',p_contacted,'qualified',p_qualified,'revision',p_expected+1) THEN RETURN cfg; END IF;
 IF (cfg->>'revision')::integer<>p_expected THEN RAISE EXCEPTION 'P5_CONFLICT' USING ERRCODE='23505'; END IF;
 INSERT INTO p5_ci.scoring_rules VALUES(p_org,p_website,p_referral,p_event,p_contacted,p_qualified,p_expected+1)
 ON CONFLICT(organization_id) DO UPDATE SET website=EXCLUDED.website,referral=EXCLUDED.referral,event=EXCLUDED.event,contacted=EXCLUDED.contacted,qualified=EXCLUDED.qualified,revision=EXCLUDED.revision;
 RETURN p5_ci.rule_config(p_org);
 END $$;
CREATE FUNCTION p5_ci.qualify_reason(p_issuer text,p_subject text,p_org uuid,p_id uuid,p_request uuid,p_revision integer,p_status text,p_reason text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
 DECLARE result jsonb;prev text;who record;l p5_ci.leads%ROWTYPE;
 BEGIN
 IF current_setting('transaction_isolation')<>'serializable' THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 l:=p5_ci.rules_visible_lead(p_issuer,p_subject,p_org,p_id);
 SELECT * INTO who FROM p5_ci.actor(p_issuer,p_subject,p_org);
 IF NOT(who.manager OR (who.rep AND l.owner_id=who.actor_id)) THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 IF p_status IS NULL OR p_reason IS NULL OR NOT ((p_status='QUALIFIED' AND p_reason='FIT') OR (p_status='LOST' AND p_reason IN ('NOT_FIT','NO_INTEREST'))) THEN RAISE EXCEPTION 'P5_INVALID' USING ERRCODE='22023'; END IF;
 SELECT reason INTO prev FROM p5_ci.qualification_reasons WHERE organization_id=p_org AND request_id=p_request;
 IF FOUND AND prev<>p_reason THEN RAISE EXCEPTION 'P5_CONFLICT' USING ERRCODE='23505'; END IF;
 result:=p5_ci.change_lead(p_issuer,p_subject,p_org,p_id,p_request,p_revision,'transition',NULL,NULL,NULL,p_status);
 IF result->>'outcome'='applied' THEN
 INSERT INTO p5_ci.qualification_reasons VALUES(p_org,p_request,p_id,p_reason);
 ELSIF prev IS NULL THEN RAISE EXCEPTION 'P5_CONFLICT' USING ERRCODE='23505'; END IF;
 RETURN result;
 END $$;
CREATE FUNCTION p5_ci.read_assignment_rule(p_issuer text,p_subject text,p_org uuid,p_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 DECLARE who record;l p5_ci.leads%ROWTYPE;r p5_ci.lead_assignment_rules%ROWTYPE;target uuid;eligible jsonb;
 BEGIN
 IF current_setting('transaction_read_only')<>'on' THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 SELECT * INTO who FROM p5_ci.actor(p_issuer,p_subject,p_org);
 IF NOT FOUND OR NOT who.manager THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 l:=p5_ci.rules_visible_lead(p_issuer,p_subject,p_org,p_id);
 IF l.team_id IS NULL THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='P5004'; END IF;
 SELECT * INTO r FROM p5_ci.lead_assignment_rules WHERE organization_id=p_org AND team_id=l.team_id AND source=l.source;
 IF FOUND THEN
 SELECT e.user_id INTO target FROM p5_ci.eligible_assignees(p_org,l.team_id,who.actor_id,NULL,r.primary_id) e WHERE e.user_id<>l.owner_id;
 IF target IS NULL THEN SELECT e.user_id INTO target FROM p5_ci.eligible_assignees(p_org,l.team_id,who.actor_id,NULL,r.fallback_id) e WHERE e.user_id<>l.owner_id; END IF;
 END IF;
 SELECT coalesce(jsonb_agg(e.user_id ORDER BY e.user_id),'[]'::jsonb) INTO eligible FROM p5_ci.eligible_assignees(p_org,l.team_id,who.actor_id,NULL,NULL) e;
 RETURN jsonb_build_object('leadId',l.id,'leadRevision',l.revision,'source',l.source,'primaryId',r.primary_id,'fallbackId',r.fallback_id,'ruleRevision',coalesce(r.revision,-1),'suggestedId',CASE WHEN l.status IN ('LOST','CONVERTED') THEN NULL ELSE target END,'eligible',eligible);
 END $$;
CREATE FUNCTION p5_ci.write_assignment_rule(p_issuer text,p_subject text,p_org uuid,p_id uuid,p_expected integer,p_primary uuid,p_fallback uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
 DECLARE who record;l p5_ci.leads%ROWTYPE;r p5_ci.lead_assignment_rules%ROWTYPE;rev integer;
 BEGIN
 IF current_setting('transaction_isolation')<>'serializable' THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 SELECT * INTO who FROM p5_ci.actor(p_issuer,p_subject,p_org);
 IF NOT FOUND OR NOT who.manager THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 l:=p5_ci.rules_visible_lead(p_issuer,p_subject,p_org,p_id);
 IF l.team_id IS NULL THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='P5004'; END IF;
 IF p_expected IS NULL OR p_expected NOT BETWEEN -1 AND 999999 OR p_primary IS NULL OR p_fallback IS NULL OR p_primary=p_fallback THEN RAISE EXCEPTION 'P5_INVALID' USING ERRCODE='22023'; END IF;
 IF NOT EXISTS(SELECT 1 FROM p5_ci.eligible_assignees(p_org,l.team_id,who.actor_id,NULL,p_primary)) OR NOT EXISTS(SELECT 1 FROM p5_ci.eligible_assignees(p_org,l.team_id,who.actor_id,NULL,p_fallback)) THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM p5_ci.lead_assignment_rules WHERE organization_id=p_org AND team_id=l.team_id AND source=l.source;
 rev:=coalesce(r.revision,-1);
 IF rev=p_expected+1 AND r.primary_id=p_primary AND r.fallback_id=p_fallback THEN RETURN jsonb_build_object('revision',rev); END IF;
 IF rev<>p_expected THEN RAISE EXCEPTION 'P5_CONFLICT' USING ERRCODE='23505'; END IF;
 INSERT INTO p5_ci.lead_assignment_rules VALUES(p_org,l.team_id,l.source,p_primary,p_fallback,p_expected+1)
 ON CONFLICT(organization_id,team_id,source) DO UPDATE SET primary_id=EXCLUDED.primary_id,fallback_id=EXCLUDED.fallback_id,revision=EXCLUDED.revision;
 RETURN jsonb_build_object('revision',p_expected+1);
 END $$;
GRANT CREATE ON SCHEMA p5_ci TO p5_ci_definer;
ALTER FUNCTION p5_ci.read_lead_rules(text,text,uuid,uuid) OWNER TO p5_ci_definer;
ALTER FUNCTION p5_ci.write_score_rule(text,text,uuid,integer,integer,integer,integer,integer,integer) OWNER TO p5_ci_definer;
ALTER FUNCTION p5_ci.qualify_reason(text,text,uuid,uuid,uuid,integer,text,text) OWNER TO p5_ci_definer;
ALTER FUNCTION p5_ci.read_assignment_rule(text,text,uuid,uuid) OWNER TO p5_ci_definer;
ALTER FUNCTION p5_ci.write_assignment_rule(text,text,uuid,uuid,integer,uuid,uuid) OWNER TO p5_ci_definer;
REVOKE CREATE ON SCHEMA p5_ci FROM p5_ci_definer;
REVOKE ALL ON FUNCTION p5_ci.rules_visible_lead(text,text,uuid,uuid),p5_ci.rule_config(uuid),p5_ci.read_lead_rules(text,text,uuid,uuid),p5_ci.write_score_rule(text,text,uuid,integer,integer,integer,integer,integer,integer),p5_ci.qualify_reason(text,text,uuid,uuid,uuid,integer,text,text),p5_ci.read_assignment_rule(text,text,uuid,uuid),p5_ci.write_assignment_rule(text,text,uuid,uuid,integer,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p5_ci.rules_visible_lead(text,text,uuid,uuid),p5_ci.rule_config(uuid) TO p5_ci_definer;
GRANT EXECUTE ON FUNCTION p5_ci.read_lead_rules(text,text,uuid,uuid),p5_ci.write_score_rule(text,text,uuid,integer,integer,integer,integer,integer,integer),p5_ci.qualify_reason(text,text,uuid,uuid,uuid,integer,text,text),p5_ci.read_assignment_rule(text,text,uuid,uuid),p5_ci.write_assignment_rule(text,text,uuid,uuid,integer,uuid,uuid) TO p5_ci_runtime;
COMMIT;
