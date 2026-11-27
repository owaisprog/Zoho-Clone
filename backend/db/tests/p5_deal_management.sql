-- P5 deal management, disposable database only.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' OR current_user<>'demo_ci'
 OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
 OR to_regclass('p5_ci.conversions') IS NULL THEN RAISE EXCEPTION 'P5_DISPOSABLE_ONLY'; END IF;
END $$;
ALTER TABLE p5_ci.deals DROP CONSTRAINT deals_stage_check,DROP CONSTRAINT deals_revision_check,
 ADD COLUMN team_id uuid, ADD COLUMN value_cents integer NOT NULL DEFAULT 0 CHECK(value_cents BETWEEN 0 AND 1000000000),
 ADD CHECK(stage IN ('OPEN','DISCOVERY','PROPOSAL','NEGOTIATION','WON','LOST')),
 ADD CHECK(revision BETWEEN 0 AND 1000000),
 ADD FOREIGN KEY(organization_id,team_id) REFERENCES platform_stage.teams(organization_id,id);
ALTER TABLE p5_ci.contacts ADD UNIQUE(organization_id,id,account_id);
ALTER TABLE p5_ci.deals ADD FOREIGN KEY(organization_id,contact_id,account_id) REFERENCES p5_ci.contacts(organization_id,id,account_id);
CREATE TABLE p5_ci.deal_events(
 organization_id uuid NOT NULL,request_id uuid NOT NULL,deal_id uuid NOT NULL,actor_id uuid NOT NULL,
 action text NOT NULL CHECK(action IN ('CREATED','EDITED','STAGE_CHANGED')),revision integer NOT NULL,
 previous_stage text,next_stage text,digest text NOT NULL CHECK(digest ~ '^[a-f0-9]{64}$'),
 occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(organization_id,request_id),UNIQUE(organization_id,deal_id,revision),
 FOREIGN KEY(organization_id,deal_id) REFERENCES p5_ci.deals(organization_id,id),
 FOREIGN KEY(organization_id,actor_id) REFERENCES platform_stage.memberships(organization_id,user_id),
 CHECK((action='CREATED' AND revision=0 AND previous_stage IS NULL AND next_stage IS NULL) OR
 (action='EDITED' AND revision BETWEEN 1 AND 1000000 AND previous_stage IS NULL AND next_stage IS NULL) OR
 (action='STAGE_CHANGED' AND revision BETWEEN 1 AND 1000000 AND previous_stage IS NOT NULL AND next_stage IS NOT NULL AND previous_stage<>next_stage))
);
ALTER TABLE p5_ci.deal_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE p5_ci.deal_events FORCE ROW LEVEL SECURITY;
ALTER TABLE p5_ci.deal_events OWNER TO p4_stage_owner;
REVOKE ALL ON p5_ci.deal_events FROM PUBLIC,p5_ci_runtime;
GRANT SELECT,INSERT ON p5_ci.deal_events TO p5_ci_definer;
CREATE POLICY p5_deal_event_read ON p5_ci.deal_events FOR SELECT TO p5_ci_definer USING(true);
CREATE POLICY p5_deal_event_insert ON p5_ci.deal_events FOR INSERT TO p5_ci_definer WITH CHECK(true);
CREATE TRIGGER p5_deal_event_immutable BEFORE UPDATE OR DELETE ON p5_ci.deal_events FOR EACH ROW EXECUTE FUNCTION platform_stage.grant_audit_immutable();
GRANT UPDATE(title,value_cents,stage,revision) ON p5_ci.deals TO p5_ci_definer;
CREATE POLICY p5_deal_update ON p5_ci.deals FOR UPDATE TO p5_ci_definer USING(true) WITH CHECK(true);
CREATE FUNCTION p5_ci.deal_projection(d p5_ci.deals) RETURNS jsonb LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('id',d.id,'title',d.title,'stage',d.stage,'revision',d.revision,'accountId',d.account_id,'contactId',d.contact_id,'valueCents',d.value_cents)
 $$;
CREATE FUNCTION p5_ci.deal_links_visible(p_issuer text,p_subject text,p_org uuid,p_account uuid,p_contact uuid)
 RETURNS boolean LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT p5_ci.account_visible(p_issuer,p_subject,p_org,p_account) AND EXISTS(
 SELECT 1 FROM p5_ci.contacts c CROSS JOIN p5_ci.actor(p_issuer,p_subject,p_org) w
 WHERE c.organization_id=p_org AND c.id=p_contact AND c.account_id=p_account AND (w.rep OR w.manager)
 AND ((w.rep AND c.owner_id=w.actor_id) OR (c.team_id IS NOT NULL AND platform_stage.team_membership_check(p_issuer,p_subject,p_org,c.team_id))))
 $$;
CREATE FUNCTION p5_ci.deal_visible(p_issuer text,p_subject text,p_org uuid,d p5_ci.deals)
 RETURNS boolean LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT d.organization_id=p_org AND EXISTS(SELECT 1 FROM p5_ci.actor(p_issuer,p_subject,p_org) w WHERE (w.rep OR w.manager)
 AND ((w.rep AND d.owner_id=w.actor_id) OR (d.team_id IS NOT NULL AND platform_stage.team_membership_check(p_issuer,p_subject,p_org,d.team_id))))
 AND p5_ci.deal_links_visible(p_issuer,p_subject,p_org,d.account_id,d.contact_id)
 $$;
CREATE FUNCTION p5_ci.query_deals(p_issuer text,p_subject text,p_org uuid,p_after uuid,p_id uuid,p_search text,p_stage text)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 DECLARE who record; result jsonb;
 BEGIN
 IF current_setting('transaction_read_only')<>'on' THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 IF p_search IS NULL OR p_search !~ '^[A-Za-z0-9 &.-]{0,80}$' OR (p_stage IS NOT NULL AND p_stage NOT IN ('OPEN','DISCOVERY','PROPOSAL','NEGOTIATION','WON','LOST')) OR (p_id IS NOT NULL AND p_after IS NOT NULL) THEN RAISE EXCEPTION 'P5_INVALID' USING ERRCODE='22023'; END IF;
 SELECT * INTO who FROM p5_ci.actor(p_issuer,p_subject,p_org);
 IF NOT FOUND OR NOT(who.rep OR who.manager) THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 SELECT coalesce(jsonb_agg(p5_ci.deal_projection(d.row_value) ORDER BY d.id),'[]'::jsonb) INTO result FROM
 (SELECT x AS row_value,x.id FROM p5_ci.deals x WHERE x.organization_id=p_org AND (p_after IS NULL OR x.id>p_after) AND (p_id IS NULL OR x.id=p_id)
 AND (p_search='' OR strpos(lower(x.title),lower(p_search))>0) AND (p_stage IS NULL OR x.stage=p_stage)
 AND p5_ci.deal_visible(p_issuer,p_subject,p_org,x) ORDER BY x.id LIMIT 21) d;
 IF p_id IS NOT NULL THEN RETURN result->0; END IF; RETURN result;
 END $$;
CREATE OR REPLACE FUNCTION p5_ci.read_deals(p_issuer text,p_subject text,p_org uuid,p_after uuid)
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT p5_ci.query_deals(p_issuer,p_subject,p_org,p_after,NULL,'',NULL)
 $$;
CREATE FUNCTION p5_ci.write_deal(p_issuer text,p_subject text,p_org uuid,p_id uuid,p_request uuid,p_expected integer,
 p_operation text,p_title text,p_value integer,p_account uuid,p_contact uuid,p_next text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
 DECLARE who record; d p5_ci.deals%ROWTYPE; ev p5_ci.deal_events%ROWTYPE; fingerprint text; action_code text; prior text; ident uuid;
 BEGIN
 IF current_setting('transaction_isolation')<>'serializable' THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 SELECT * INTO who FROM p5_ci.actor(p_issuer,p_subject,p_org);
 IF NOT FOUND OR NOT(who.rep OR who.manager) OR (p_operation='create' AND NOT who.rep) THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 FOREACH ident IN ARRAY ARRAY[p_id,p_request] LOOP
 IF ident IS NULL OR substring(ident::text from 15 for 1)<>'4' OR substring(ident::text from 20 for 1) NOT IN ('8','9','a','b') THEN RAISE EXCEPTION 'P5_INVALID' USING ERRCODE='22023'; END IF;
 END LOOP;
 IF p_operation IS NULL OR p_operation NOT IN ('create','edit','transition') OR (p_operation='create' AND p_expected IS NOT NULL)
 OR (p_operation<>'create' AND (p_expected IS NULL OR p_expected<0 OR p_expected>=1000000)) THEN RAISE EXCEPTION 'P5_INVALID' USING ERRCODE='22023'; END IF;
 IF p_operation IN ('create','edit') THEN
 IF p_title IS NULL OR p_title !~ '^Demo [A-Za-z][A-Za-z0-9 &.-]{2,74}$' OR p_value IS NULL OR p_value<0 OR p_value>1000000000 OR p_next IS NOT NULL
 OR (p_operation='create' AND (p_account IS NULL OR p_contact IS NULL)) OR (p_operation='edit' AND (p_account IS NOT NULL OR p_contact IS NOT NULL)) THEN RAISE EXCEPTION 'P5_INVALID' USING ERRCODE='22023'; END IF;
 IF p_operation='create' AND NOT p5_ci.deal_links_visible(p_issuer,p_subject,p_org,p_account,p_contact) THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='P5004'; END IF;
 ELSE
 IF p_title IS NOT NULL OR p_value IS NOT NULL OR p_account IS NOT NULL OR p_contact IS NOT NULL OR p_next IS NULL OR p_next NOT IN ('DISCOVERY','PROPOSAL','NEGOTIATION','WON','LOST') THEN RAISE EXCEPTION 'P5_INVALID' USING ERRCODE='22023'; END IF;
 IF NOT EXISTS(SELECT 1 FROM p5_ci.stage_edit_grants g WHERE g.organization_id=p_org AND g.user_id=who.actor_id AND g.active) THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 END IF;
 action_code:=CASE p_operation WHEN 'create' THEN 'CREATED' WHEN 'edit' THEN 'EDITED' ELSE 'STAGE_CHANGED' END;
 fingerprint:=encode(sha256(convert_to(jsonb_build_array(p_id,p_expected,p_operation,p_title,p_value,p_account,p_contact,p_next)::text,'UTF8')),'hex');
 SELECT * INTO ev FROM p5_ci.deal_events WHERE organization_id=p_org AND request_id=p_request;
 IF FOUND THEN
 IF ev.actor_id<>who.actor_id OR ev.deal_id<>p_id OR ev.action<>action_code OR ev.digest<>fingerprint THEN RAISE EXCEPTION 'P5_CONFLICT' USING ERRCODE='23505'; END IF;
 SELECT * INTO d FROM p5_ci.deals x WHERE x.organization_id=p_org AND x.id=p_id AND p5_ci.deal_visible(p_issuer,p_subject,p_org,x);
 IF NOT FOUND THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='P5004'; END IF;
 RETURN jsonb_build_object('outcome','replay','record',p5_ci.deal_projection(d));
 END IF;
 IF p_operation='create' THEN
 INSERT INTO p5_ci.deals(organization_id,id,owner_id,account_id,contact_id,title,value_cents) VALUES(p_org,p_id,who.actor_id,p_account,p_contact,p_title,p_value) RETURNING * INTO d;
 ELSE
 SELECT * INTO d FROM p5_ci.deals x WHERE x.organization_id=p_org AND x.id=p_id AND p5_ci.deal_visible(p_issuer,p_subject,p_org,x) FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='P5004'; END IF;
 IF d.revision<>p_expected OR d.stage IN ('WON','LOST') THEN RAISE EXCEPTION 'P5_CONFLICT' USING ERRCODE='23505'; END IF;
 IF p_operation='edit' THEN
 IF (d.title,d.value_cents)=(p_title,p_value) THEN RAISE EXCEPTION 'P5_CONFLICT' USING ERRCODE='23505'; END IF;
 UPDATE p5_ci.deals SET title=p_title,value_cents=p_value,revision=revision+1 WHERE organization_id=p_org AND id=p_id RETURNING * INTO d;
 ELSE
 prior:=d.stage;
 IF NOT (p_next='LOST' OR (prior='OPEN' AND p_next='DISCOVERY') OR (prior='DISCOVERY' AND p_next='PROPOSAL') OR (prior='PROPOSAL' AND p_next='NEGOTIATION') OR (prior='NEGOTIATION' AND p_next='WON')) THEN RAISE EXCEPTION 'P5_CONFLICT' USING ERRCODE='23505'; END IF;
 UPDATE p5_ci.deals SET stage=p_next,revision=revision+1 WHERE organization_id=p_org AND id=p_id RETURNING * INTO d;
 END IF; END IF;
 INSERT INTO p5_ci.deal_events(organization_id,request_id,deal_id,actor_id,action,revision,digest,previous_stage,next_stage) VALUES(p_org,p_request,p_id,who.actor_id,action_code,d.revision,fingerprint,prior,p_next);
 RETURN jsonb_build_object('outcome',CASE WHEN p_operation='create' THEN 'created' ELSE 'applied' END,'record',p5_ci.deal_projection(d));
 END $$;
CREATE FUNCTION p5_ci.deal_history(p_issuer text,p_subject text,p_org uuid,p_id uuid,p_after integer)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 DECLARE result jsonb; who record;
 BEGIN
 IF current_setting('transaction_read_only')<>'on' OR p_after IS NULL OR p_after< -1 OR p_after>1000000 THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 SELECT * INTO who FROM p5_ci.actor(p_issuer,p_subject,p_org);
 IF NOT FOUND OR NOT(who.rep OR who.manager) THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM p5_ci.deals d WHERE d.organization_id=p_org AND d.id=p_id AND p5_ci.deal_visible(p_issuer,p_subject,p_org,d)) THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='P5004'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('action',e.action,'revision',e.revision,'previousStage',e.previous_stage,'nextStage',e.next_stage) ORDER BY e.revision),'[]'::jsonb) INTO result
 FROM (SELECT * FROM p5_ci.deal_events WHERE organization_id=p_org AND deal_id=p_id AND revision>p_after ORDER BY revision LIMIT 21) e;
 RETURN result;
 END $$;
CREATE OR REPLACE FUNCTION p5_ci.convert_lead(p_issuer text,p_subject text,p_org uuid,p_id uuid,p_request uuid,p_expected integer,p_account uuid,p_contact uuid,p_deal uuid,p_name text,p_industry text,p_title text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
 DECLARE who record; l p5_ci.leads%ROWTYPE; receipt p5_ci.conversions%ROWTYPE; fingerprint text; ident uuid;
 BEGIN
 IF current_setting('transaction_isolation')<>'serializable' THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 SELECT * INTO who FROM p5_ci.actor(p_issuer,p_subject,p_org);
 IF NOT FOUND OR NOT who.rep THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM p5_ci.stage_edit_grants g WHERE g.organization_id=p_org AND g.user_id=who.actor_id AND g.active) THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 FOREACH ident IN ARRAY ARRAY[p_id,p_request,p_account,p_contact,p_deal] LOOP
  IF ident IS NULL OR substring(ident::text from 15 for 1)<>'4' OR substring(ident::text from 20 for 1) NOT IN ('8','9','a','b') THEN RAISE EXCEPTION 'P5_INVALID' USING ERRCODE='22023'; END IF;
 END LOOP;
 IF p_expected IS NULL OR p_expected<0 OR p_expected>=1000000 OR p_name IS NULL OR p_name !~ '^Demo [A-Za-z][A-Za-z0-9 .-]{2,74}$'
 OR p_industry IS NULL OR p_industry NOT IN ('SERVICES','RETAIL','TECHNOLOGY','OTHER') OR p_title IS NULL OR p_title !~ '^Demo [A-Za-z][A-Za-z0-9 &.-]{2,74}$' THEN RAISE EXCEPTION 'P5_INVALID' USING ERRCODE='22023'; END IF;
 SELECT * INTO l FROM p5_ci.leads x WHERE x.organization_id=p_org AND x.id=p_id AND x.owner_id=who.actor_id AND x.team_id IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='P5004'; END IF;
 fingerprint:=encode(sha256(convert_to(jsonb_build_array(p_id,p_expected,p_account,p_contact,p_deal,p_name,p_industry,p_title)::text,'UTF8')),'hex');
 SELECT * INTO receipt FROM p5_ci.conversions WHERE organization_id=p_org AND lead_id=p_id;
 IF FOUND THEN
  IF receipt.actor_id<>who.actor_id OR receipt.request_id<>p_request OR receipt.digest<>fingerprint OR l.status<>'CONVERTED' THEN RAISE EXCEPTION 'P5_CONFLICT' USING ERRCODE='23505'; END IF;
  IF NOT p5_ci.account_visible(p_issuer,p_subject,p_org,receipt.account_id) OR NOT EXISTS(SELECT 1 FROM p5_ci.contacts c WHERE c.organization_id=p_org AND c.id=receipt.contact_id AND c.owner_id=who.actor_id AND c.account_id=receipt.account_id)
  OR NOT EXISTS(SELECT 1 FROM p5_ci.deals d WHERE d.organization_id=p_org AND d.id=receipt.deal_id AND d.owner_id=who.actor_id AND d.account_id=receipt.account_id AND d.contact_id=receipt.contact_id) THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
  RETURN jsonb_build_object('outcome','replay','receipt',p5_ci.conversion_projection(receipt));
 END IF;
 IF l.status<>'QUALIFIED' OR l.revision<>p_expected THEN RAISE EXCEPTION 'P5_CONFLICT' USING ERRCODE='23505'; END IF;
 -- Always create new records, never overwrite or merge existing candidates.
 INSERT INTO p5_ci.accounts(organization_id,id,owner_id,name,industry) VALUES(p_org,p_account,who.actor_id,l.company_name,p_industry);
 INSERT INTO p5_ci.account_events(organization_id,request_id,account_id,actor_id,action,revision,digest) VALUES(p_org,p_request,p_account,who.actor_id,'CREATED',0,fingerprint);
 INSERT INTO p5_ci.contacts(organization_id,id,owner_id,display_name,email,account_id) VALUES(p_org,p_contact,who.actor_id,p_name,l.contact_email,p_account);
 INSERT INTO p5_ci.contact_events(organization_id,request_id,contact_id,actor_id,action,revision,digest) VALUES(p_org,p_request,p_contact,who.actor_id,'CREATED',0,fingerprint);
 INSERT INTO p5_ci.deals(organization_id,id,owner_id,account_id,contact_id,title) VALUES(p_org,p_deal,who.actor_id,p_account,p_contact,p_title);
 INSERT INTO p5_ci.deal_events(organization_id,request_id,deal_id,actor_id,action,revision,digest) VALUES(p_org,p_request,p_deal,who.actor_id,'CREATED',0,fingerprint);
 UPDATE p5_ci.leads SET status='CONVERTED',revision=revision+1 WHERE organization_id=p_org AND id=p_id RETURNING * INTO l;
 INSERT INTO p5_ci.lead_events(organization_id,request_id,lead_id,actor_id,action,revision,request_digest,previous_status,next_status)
 VALUES(p_org,p_request,p_id,who.actor_id,'CONVERTED',l.revision,fingerprint,'QUALIFIED','CONVERTED');
 INSERT INTO p5_ci.conversions(organization_id,lead_id,request_id,actor_id,account_id,contact_id,deal_id,revision,digest)
 VALUES(p_org,p_id,p_request,who.actor_id,p_account,p_contact,p_deal,l.revision,fingerprint) RETURNING * INTO receipt;
 RETURN jsonb_build_object('outcome','converted','receipt',p5_ci.conversion_projection(receipt));
 END $$;

GRANT CREATE ON SCHEMA p5_ci TO p5_ci_definer;
ALTER FUNCTION p5_ci.query_deals(text,text,uuid,uuid,uuid,text,text) OWNER TO p5_ci_definer;
ALTER FUNCTION p5_ci.write_deal(text,text,uuid,uuid,uuid,integer,text,text,integer,uuid,uuid,text) OWNER TO p5_ci_definer;
ALTER FUNCTION p5_ci.deal_history(text,text,uuid,uuid,integer) OWNER TO p5_ci_definer;
REVOKE CREATE ON SCHEMA p5_ci FROM p5_ci_definer;
REVOKE ALL ON FUNCTION p5_ci.deal_projection(p5_ci.deals),p5_ci.deal_links_visible(text,text,uuid,uuid,uuid),p5_ci.deal_visible(text,text,uuid,p5_ci.deals),p5_ci.query_deals(text,text,uuid,uuid,uuid,text,text),p5_ci.write_deal(text,text,uuid,uuid,uuid,integer,text,text,integer,uuid,uuid,text),p5_ci.deal_history(text,text,uuid,uuid,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p5_ci.deal_projection(p5_ci.deals),p5_ci.deal_links_visible(text,text,uuid,uuid,uuid),p5_ci.deal_visible(text,text,uuid,p5_ci.deals) TO p5_ci_definer;
GRANT EXECUTE ON FUNCTION p5_ci.query_deals(text,text,uuid,uuid,uuid,text,text),p5_ci.write_deal(text,text,uuid,uuid,uuid,integer,text,text,integer,uuid,uuid,text),p5_ci.deal_history(text,text,uuid,uuid,integer) TO p5_ci_runtime;
COMMIT;
