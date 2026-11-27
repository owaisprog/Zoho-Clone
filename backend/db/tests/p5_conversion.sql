-- Disposable P5 conversion only. No external migration.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' OR current_user<>'demo_ci'
 OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
 OR to_regclass('p5_ci.contacts') IS NULL THEN RAISE EXCEPTION 'P5_DISPOSABLE_ONLY'; END IF;
END $$;
ALTER TABLE p5_ci.leads DROP CONSTRAINT leads_status_check,
 ADD CHECK(status IN ('NEW','CONTACTED','QUALIFIED','LOST','CONVERTED'));
ALTER TABLE p5_ci.lead_events DROP CONSTRAINT lead_event_shape,
 ADD CONSTRAINT lead_event_shape CHECK(
 ((action='CREATED' AND revision=0 AND previous_status IS NULL AND next_status IS NULL) OR
 (action='EDITED' AND revision BETWEEN 1 AND 1000000 AND previous_status IS NULL AND next_status IS NULL) OR
 (action='STAGE_CHANGED' AND revision BETWEEN 1 AND 1000000 AND previous_status IS NOT NULL AND next_status IS NOT NULL
 AND ((previous_status='NEW' AND next_status='CONTACTED') OR (previous_status='CONTACTED' AND next_status IN ('QUALIFIED','LOST'))))
 OR (action='CONVERTED' AND revision BETWEEN 1 AND 1000000 AND previous_status='QUALIFIED' AND next_status='CONVERTED' AND previous_status IS NOT NULL AND next_status IS NOT NULL))
 AND previous_owner_id IS NULL AND next_owner_id IS NULL
 OR (action='ASSIGNED' AND revision BETWEEN 1 AND 1000000 AND previous_status IS NULL AND next_status IS NULL
 AND previous_owner_id IS NOT NULL AND next_owner_id IS NOT NULL AND previous_owner_id<>next_owner_id));
CREATE TABLE p5_ci.deals(
 organization_id uuid NOT NULL,id uuid NOT NULL,owner_id uuid NOT NULL,account_id uuid NOT NULL,contact_id uuid NOT NULL,
 title text NOT NULL CHECK(title ~ '^Demo [A-Za-z][A-Za-z0-9 &.-]{2,74}$'),
 stage text NOT NULL DEFAULT 'OPEN' CHECK(stage='OPEN'),
 revision integer NOT NULL DEFAULT 0 CHECK(revision=0),
 PRIMARY KEY(organization_id,id),
 FOREIGN KEY(organization_id,owner_id) REFERENCES platform_stage.memberships(organization_id,user_id),
 FOREIGN KEY(organization_id,account_id) REFERENCES p5_ci.accounts(organization_id,id),
 FOREIGN KEY(organization_id,contact_id) REFERENCES p5_ci.contacts(organization_id,id)
);
CREATE TABLE p5_ci.conversions(
 organization_id uuid NOT NULL,lead_id uuid NOT NULL,request_id uuid NOT NULL,actor_id uuid NOT NULL,
 account_id uuid NOT NULL,contact_id uuid NOT NULL,deal_id uuid NOT NULL,
 revision integer NOT NULL CHECK(revision BETWEEN 1 AND 1000000),digest text NOT NULL CHECK(digest ~ '^[a-f0-9]{64}$'),
 occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(organization_id,lead_id),UNIQUE(organization_id,request_id),
 FOREIGN KEY(organization_id,lead_id) REFERENCES p5_ci.leads(organization_id,id),
 FOREIGN KEY(organization_id,actor_id) REFERENCES platform_stage.memberships(organization_id,user_id),
 FOREIGN KEY(organization_id,account_id) REFERENCES p5_ci.accounts(organization_id,id),
 FOREIGN KEY(organization_id,contact_id) REFERENCES p5_ci.contacts(organization_id,id),
 FOREIGN KEY(organization_id,deal_id) REFERENCES p5_ci.deals(organization_id,id)
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['deals','conversions'] LOOP
  EXECUTE format('ALTER TABLE p5_ci.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE p5_ci.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE p5_ci.%I OWNER TO p4_stage_owner',t);
  EXECUTE format('REVOKE ALL ON p5_ci.%I FROM PUBLIC,p5_ci_runtime',t);
  EXECUTE format('GRANT SELECT,INSERT ON p5_ci.%I TO p5_ci_definer',t);
  EXECUTE format('CREATE POLICY p5_conversion_read ON p5_ci.%I FOR SELECT TO p5_ci_definer USING(true)',t);
  EXECUTE format('CREATE POLICY p5_conversion_insert ON p5_ci.%I FOR INSERT TO p5_ci_definer WITH CHECK(true)',t);
 END LOOP;
END $$;
CREATE TRIGGER p5_conversion_immutable BEFORE UPDATE OR DELETE ON p5_ci.conversions FOR EACH ROW EXECUTE FUNCTION platform_stage.grant_audit_immutable();
CREATE FUNCTION p5_ci.protect_converted() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
 BEGIN IF OLD.status='CONVERTED' THEN RAISE EXCEPTION 'P5_TERMINAL' USING ERRCODE='23505'; END IF; RETURN NEW; END $$;
CREATE TRIGGER p5_converted_terminal BEFORE UPDATE ON p5_ci.leads FOR EACH ROW EXECUTE FUNCTION p5_ci.protect_converted();
CREATE FUNCTION p5_ci.conversion_projection(c p5_ci.conversions) RETURNS jsonb LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('leadId',c.lead_id,'accountId',c.account_id,'contactId',c.contact_id,'dealId',c.deal_id,'revision',c.revision)
 $$;
CREATE FUNCTION p5_ci.convert_lead(p_issuer text,p_subject text,p_org uuid,p_id uuid,p_request uuid,p_expected integer,p_account uuid,p_contact uuid,p_deal uuid,p_name text,p_industry text,p_title text)
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
 UPDATE p5_ci.leads SET status='CONVERTED',revision=revision+1 WHERE organization_id=p_org AND id=p_id RETURNING * INTO l;
 INSERT INTO p5_ci.lead_events(organization_id,request_id,lead_id,actor_id,action,revision,request_digest,previous_status,next_status)
 VALUES(p_org,p_request,p_id,who.actor_id,'CONVERTED',l.revision,fingerprint,'QUALIFIED','CONVERTED');
 INSERT INTO p5_ci.conversions(organization_id,lead_id,request_id,actor_id,account_id,contact_id,deal_id,revision,digest)
 VALUES(p_org,p_id,p_request,who.actor_id,p_account,p_contact,p_deal,l.revision,fingerprint) RETURNING * INTO receipt;
 RETURN jsonb_build_object('outcome','converted','receipt',p5_ci.conversion_projection(receipt));
 END $$;
CREATE FUNCTION p5_ci.read_deals(p_issuer text,p_subject text,p_org uuid,p_after uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 DECLARE who record; result jsonb;
 BEGIN
 IF current_setting('transaction_read_only')<>'on' THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 SELECT * INTO who FROM p5_ci.actor(p_issuer,p_subject,p_org);
 IF NOT FOUND OR NOT who.rep THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',d.id,'title',d.title,'stage',d.stage,'revision',d.revision,'accountId',d.account_id,'contactId',d.contact_id) ORDER BY d.id),'[]'::jsonb) INTO result
 FROM (SELECT x.* FROM p5_ci.deals x WHERE x.organization_id=p_org AND x.owner_id=who.actor_id AND (p_after IS NULL OR x.id>p_after)
 AND p5_ci.account_visible(p_issuer,p_subject,p_org,x.account_id)
 AND EXISTS(SELECT 1 FROM p5_ci.contacts c WHERE c.organization_id=p_org AND c.id=x.contact_id AND c.owner_id=who.actor_id AND c.account_id=x.account_id)
 ORDER BY x.id LIMIT 21) d;
 RETURN result;
 END $$;
CREATE OR REPLACE FUNCTION p5_ci.search_leads(p_issuer text,p_subject text,p_org uuid,p_after uuid,p_search text,p_source text,p_status text)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 DECLARE who record; result jsonb;
 BEGIN
 IF current_setting('transaction_read_only')<>'on' THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 IF p_search IS NULL OR p_search !~ '^[A-Za-z0-9 &.@_-]{0,50}$' OR (p_source IS NOT NULL AND p_source NOT IN ('WEBSITE','REFERRAL','EVENT'))
 OR (p_status IS NOT NULL AND p_status NOT IN ('NEW','CONTACTED','QUALIFIED','LOST','CONVERTED')) THEN RAISE EXCEPTION 'P5_INVALID' USING ERRCODE='22023'; END IF;
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

GRANT CREATE ON SCHEMA p5_ci TO p5_ci_definer;
ALTER FUNCTION p5_ci.convert_lead(text,text,uuid,uuid,uuid,integer,uuid,uuid,uuid,text,text,text) OWNER TO p5_ci_definer;
ALTER FUNCTION p5_ci.read_deals(text,text,uuid,uuid) OWNER TO p5_ci_definer;
REVOKE CREATE ON SCHEMA p5_ci FROM p5_ci_definer;
REVOKE ALL ON FUNCTION p5_ci.conversion_projection(p5_ci.conversions),p5_ci.convert_lead(text,text,uuid,uuid,uuid,integer,uuid,uuid,uuid,text,text,text),p5_ci.read_deals(text,text,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p5_ci.conversion_projection(p5_ci.conversions) TO p5_ci_definer;
GRANT EXECUTE ON FUNCTION p5_ci.convert_lead(text,text,uuid,uuid,uuid,integer,uuid,uuid,uuid,text,text,text),p5_ci.read_deals(text,text,uuid,uuid) TO p5_ci_runtime;
COMMIT;
