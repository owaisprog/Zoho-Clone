-- P5 CRM lead lifecycle: disposable CI only, no external migration.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' OR current_user<>'demo_ci'
 OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
 OR to_regclass('platform_stage.app_entitlements') IS NULL
 OR to_regnamespace('p5_ci') IS NOT NULL THEN RAISE EXCEPTION 'P5_DISPOSABLE_ONLY'; END IF;
END $$;
CREATE ROLE p5_ci_definer NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
CREATE ROLE p5_ci_runtime LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
CREATE SCHEMA p5_ci AUTHORIZATION p4_stage_owner;
REVOKE ALL ON SCHEMA p5_ci FROM PUBLIC;
GRANT USAGE ON SCHEMA p5_ci TO p5_ci_definer,p5_ci_runtime,p4_stage_lookup;
GRANT USAGE ON SCHEMA platform_stage TO p5_ci_definer;
CREATE TABLE p5_ci.leads(
 organization_id uuid NOT NULL,id uuid NOT NULL,owner_id uuid NOT NULL,team_id uuid,
 company_name text NOT NULL CHECK(company_name ~ '^Demo [A-Za-z][A-Za-z0-9 &.-]{2,48}$'),
 contact_email text NOT NULL CHECK(contact_email ~ '^[a-z][a-z0-9._-]{1,40}@example[.]com$'),
 source text NOT NULL CHECK(source IN ('WEBSITE','REFERRAL','EVENT')),
 status text NOT NULL DEFAULT 'NEW' CHECK(status IN ('NEW','CONTACTED','QUALIFIED','LOST')),
 revision integer NOT NULL DEFAULT 0 CHECK(revision BETWEEN 0 AND 1000000),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(organization_id,id),
 UNIQUE(organization_id,owner_id,contact_email),
 FOREIGN KEY(organization_id,owner_id) REFERENCES platform_stage.memberships(organization_id,user_id),
 FOREIGN KEY(organization_id,team_id) REFERENCES platform_stage.teams(organization_id,id),
 CHECK(substring(id::text from 15 for 1)='4' AND substring(id::text from 20 for 1) IN ('8','9','a','b'))
);
CREATE TABLE p5_ci.lead_events(
 organization_id uuid NOT NULL,request_id uuid NOT NULL,lead_id uuid NOT NULL,actor_id uuid NOT NULL,
 action text NOT NULL CHECK(action='CREATED'),revision integer NOT NULL CHECK(revision=0),
 request_digest text NOT NULL CHECK(request_digest ~ '^[a-f0-9]{64}$'),
 occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(organization_id,request_id),
 FOREIGN KEY(organization_id,lead_id) REFERENCES p5_ci.leads(organization_id,id),
 FOREIGN KEY(organization_id,actor_id) REFERENCES platform_stage.memberships(organization_id,user_id)
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['leads','lead_events'] LOOP
  EXECUTE format('ALTER TABLE p5_ci.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE p5_ci.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE p5_ci.%I OWNER TO p4_stage_owner',t);
  EXECUTE format('REVOKE ALL ON p5_ci.%I FROM PUBLIC,p5_ci_runtime',t);
  EXECUTE format('GRANT SELECT,INSERT ON p5_ci.%I TO p5_ci_definer',t);
  EXECUTE format('CREATE POLICY p5_read ON p5_ci.%I FOR SELECT TO p5_ci_definer USING(true)',t);
  EXECUTE format('CREATE POLICY p5_insert ON p5_ci.%I FOR INSERT TO p5_ci_definer WITH CHECK(true)',t);
 END LOOP;
END $$;
CREATE TRIGGER p5_event_immutable BEFORE UPDATE OR DELETE ON p5_ci.lead_events
 FOR EACH ROW EXECUTE FUNCTION platform_stage.grant_audit_immutable();
-- Reuse current P4 identity, membership, entitlements and active role grants.
CREATE FUNCTION p5_ci.actor(p_issuer text,p_subject text,p_org uuid)
 RETURNS TABLE(actor_id uuid,rep boolean,manager boolean)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT m.actor_id,
 EXISTS(SELECT 1 FROM platform_stage.sales_grants g WHERE g.organization_id=p_org AND g.user_id=m.actor_id AND g.role_code='SALES_REP' AND g.active),
 EXISTS(SELECT 1 FROM platform_stage.sales_grants g WHERE g.organization_id=p_org AND g.user_id=m.actor_id AND g.role_code='SALES_MANAGER' AND g.active)
 FROM platform_stage.membership_check(p_issuer,p_subject,p_org) m
 WHERE current_database()='zoho_clone_synthetic_ci' AND session_user='p5_ci_runtime'
 AND EXISTS(SELECT 1 FROM platform_stage.app_entitlements e WHERE e.organization_id=p_org AND e.app_code='platform' AND e.active)
 AND EXISTS(SELECT 1 FROM platform_stage.app_entitlements e WHERE e.organization_id=p_org AND e.app_code='crm' AND e.active)
 $$;
GRANT CREATE ON SCHEMA p5_ci TO p4_stage_lookup,p5_ci_definer;
ALTER FUNCTION p5_ci.actor(text,text,uuid) OWNER TO p4_stage_lookup;
REVOKE ALL ON FUNCTION p5_ci.actor(text,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p5_ci.actor(text,text,uuid) TO p5_ci_definer;
GRANT EXECUTE ON FUNCTION platform_stage.team_membership_check(text,text,uuid,uuid) TO p5_ci_definer;
CREATE FUNCTION p5_ci.project(l p5_ci.leads) RETURNS jsonb LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('id',l.id,'companyName',l.company_name,'contactEmail',l.contact_email,'source',l.source,'status',l.status,'revision',l.revision)
 $$;
REVOKE ALL ON FUNCTION p5_ci.project(p5_ci.leads) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p5_ci.project(p5_ci.leads) TO p5_ci_definer;
CREATE FUNCTION p5_ci.read_leads(p_issuer text,p_subject text,p_org uuid,p_after uuid,p_id uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 DECLARE who record; result jsonb;
 BEGIN
 IF current_setting('transaction_read_only')<>'on' OR (p_after IS NOT NULL AND p_id IS NOT NULL) THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 SELECT * INTO who FROM p5_ci.actor(p_issuer,p_subject,p_org);
 IF NOT FOUND OR NOT (who.rep OR who.manager) THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 SELECT coalesce(jsonb_agg(p5_ci.project(l.lead_row) ORDER BY l.id),'[]'::jsonb) INTO result FROM
 (SELECT x AS lead_row,x.id FROM p5_ci.leads x WHERE x.organization_id=p_org AND (p_after IS NULL OR x.id>p_after) AND (p_id IS NULL OR x.id=p_id)
 AND ((who.rep AND x.owner_id=who.actor_id) OR (x.team_id IS NOT NULL AND platform_stage.team_membership_check(p_issuer,p_subject,p_org,x.team_id)))
 ORDER BY x.id LIMIT 21) l;
 IF p_id IS NOT NULL THEN RETURN result->0; END IF;
 RETURN result;
 END $$;
CREATE FUNCTION p5_ci.create_lead(p_issuer text,p_subject text,p_org uuid,p_id uuid,p_request uuid,p_company text,p_email text,p_source text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
 DECLARE who record; previous p5_ci.lead_events%ROWTYPE; l p5_ci.leads%ROWTYPE; fingerprint text;
 BEGIN
 IF current_setting('transaction_isolation')<>'serializable' THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 SELECT * INTO who FROM p5_ci.actor(p_issuer,p_subject,p_org);
 IF NOT FOUND OR NOT who.rep THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 IF p_id IS NULL OR p_request IS NULL OR substring(p_id::text from 15 for 1)<>'4' OR substring(p_id::text from 20 for 1) NOT IN ('8','9','a','b')
 OR substring(p_request::text from 15 for 1)<>'4' OR substring(p_request::text from 20 for 1) NOT IN ('8','9','a','b')
 OR p_company IS NULL OR p_company !~ '^Demo [A-Za-z][A-Za-z0-9 &.-]{2,48}$' OR p_email IS NULL OR p_email !~ '^[a-z][a-z0-9._-]{1,40}@example[.]com$'
 OR p_source IS NULL OR p_source NOT IN ('WEBSITE','REFERRAL','EVENT') THEN RAISE EXCEPTION 'P5_INVALID' USING ERRCODE='22023'; END IF;
 fingerprint:=encode(sha256(convert_to(jsonb_build_array(p_id,p_company,p_email,p_source)::text,'UTF8')),'hex');
 SELECT * INTO previous FROM p5_ci.lead_events WHERE organization_id=p_org AND request_id=p_request;
 IF FOUND THEN
  IF previous.actor_id<>who.actor_id OR previous.lead_id<>p_id OR previous.action<>'CREATED' OR previous.request_digest<>fingerprint THEN RAISE EXCEPTION 'P5_CONFLICT' USING ERRCODE='23505'; END IF;
  SELECT * INTO l FROM p5_ci.leads WHERE organization_id=p_org AND id=p_id AND owner_id=who.actor_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
  RETURN jsonb_build_object('outcome','replay','lead',p5_ci.project(l));
 END IF;
 INSERT INTO p5_ci.leads(organization_id,id,owner_id,company_name,contact_email,source) VALUES(p_org,p_id,who.actor_id,p_company,p_email,p_source) RETURNING * INTO l;
 INSERT INTO p5_ci.lead_events(organization_id,request_id,lead_id,actor_id,action,revision,request_digest) VALUES(p_org,p_request,p_id,who.actor_id,'CREATED',0,fingerprint);
 RETURN jsonb_build_object('outcome','created','lead',p5_ci.project(l));
 END $$;
ALTER FUNCTION p5_ci.read_leads(text,text,uuid,uuid,uuid) OWNER TO p5_ci_definer;
ALTER FUNCTION p5_ci.create_lead(text,text,uuid,uuid,uuid,text,text,text) OWNER TO p5_ci_definer;
REVOKE CREATE ON SCHEMA p5_ci FROM p4_stage_lookup,p5_ci_definer;
REVOKE ALL ON FUNCTION p5_ci.read_leads(text,text,uuid,uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION p5_ci.create_lead(text,text,uuid,uuid,uuid,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p5_ci.read_leads(text,text,uuid,uuid,uuid) TO p5_ci_runtime;
GRANT EXECUTE ON FUNCTION p5_ci.create_lead(text,text,uuid,uuid,uuid,text,text,text) TO p5_ci_runtime;
COMMIT;
