-- Tenant-configurable sales pipelines; disposable CI only.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' OR current_user<>'demo_ci'
 OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
 OR to_regclass('p5_ci.deal_events') IS NULL OR EXISTS(SELECT 1 FROM p5_ci.deals) THEN RAISE EXCEPTION 'P5_DISPOSABLE_ONLY'; END IF;
END $$;
CREATE FUNCTION p5_ci.valid_pipeline_stages(v jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
 DECLARE item jsonb; keys text[]:=ARRAY[]::text[]; k text; n integer;
 BEGIN
 IF v IS NULL OR jsonb_typeof(v)<>'array' THEN RETURN false; END IF;
 n:=jsonb_array_length(v); IF n<3 OR n>10 THEN RETURN false; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(v) LOOP
 IF jsonb_typeof(item)<>'object' OR (SELECT count(*) FROM jsonb_object_keys(item))<>2 OR NOT(item ? 'key' AND item ? 'label')
 OR jsonb_typeof(item->'key')<>'string' OR jsonb_typeof(item->'label')<>'string' THEN RETURN false; END IF;
 k:=item->>'key'; IF k !~ '^[A-Z][A-Z0-9_]{0,23}$' OR (item->>'label') !~ '^[A-Za-z][A-Za-z0-9 -]{1,39}$' OR k=ANY(keys) THEN RETURN false; END IF;
 keys:=array_append(keys,k);
 END LOOP;
 RETURN keys[1]='OPEN' AND keys[n-1]='WON' AND keys[n]='LOST';
 END $$;
CREATE TABLE p5_ci.pipelines(
 organization_id uuid NOT NULL,id uuid NOT NULL,name text NOT NULL CHECK(name ~ '^Demo [A-Za-z][A-Za-z0-9 &.-]{2,74}$'),
 stages jsonb NOT NULL CHECK(p5_ci.valid_pipeline_stages(stages)),
 is_default boolean NOT NULL DEFAULT false,revision integer NOT NULL DEFAULT 0 CHECK(revision BETWEEN 0 AND 1000000),
 PRIMARY KEY(organization_id,id), FOREIGN KEY(organization_id) REFERENCES platform_stage.organizations(id)
);
CREATE UNIQUE INDEX p5_default_pipeline ON p5_ci.pipelines(organization_id) WHERE is_default;
CREATE TABLE p5_ci.pipeline_admin_grants(
 organization_id uuid NOT NULL,user_id uuid NOT NULL,active boolean NOT NULL DEFAULT false,
 PRIMARY KEY(organization_id,user_id),FOREIGN KEY(organization_id,user_id) REFERENCES platform_stage.memberships(organization_id,user_id)
);
CREATE TABLE p5_ci.pipeline_events(
 organization_id uuid NOT NULL,request_id uuid NOT NULL,pipeline_id uuid NOT NULL,actor_id uuid NOT NULL,
 revision integer NOT NULL CHECK(revision BETWEEN 0 AND 1000000),digest text NOT NULL CHECK(digest ~ '^[a-f0-9]{64}$'),
 occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(organization_id,request_id),UNIQUE(organization_id,pipeline_id,revision),
 FOREIGN KEY(organization_id,pipeline_id) REFERENCES p5_ci.pipelines(organization_id,id),
 FOREIGN KEY(organization_id,actor_id) REFERENCES platform_stage.memberships(organization_id,user_id)
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['pipelines','pipeline_admin_grants','pipeline_events'] LOOP
 EXECUTE format('ALTER TABLE p5_ci.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE p5_ci.%I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE p5_ci.%I OWNER TO p4_stage_owner',t);
 EXECUTE format('REVOKE ALL ON p5_ci.%I FROM PUBLIC,p5_ci_runtime',t);
 EXECUTE format('GRANT SELECT ON p5_ci.%I TO p5_ci_definer',t);
 EXECUTE format('CREATE POLICY p5_pipeline_read ON p5_ci.%I FOR SELECT TO p5_ci_definer USING(true)',t);
 END LOOP;
END $$;
GRANT INSERT ON p5_ci.pipelines,p5_ci.pipeline_events TO p5_ci_definer;
GRANT UPDATE(name,stages,revision) ON p5_ci.pipelines TO p5_ci_definer;
CREATE POLICY p5_pipeline_insert ON p5_ci.pipelines FOR INSERT TO p5_ci_definer WITH CHECK(true);
CREATE POLICY p5_pipeline_event_insert ON p5_ci.pipeline_events FOR INSERT TO p5_ci_definer WITH CHECK(true);
CREATE POLICY p5_pipeline_update ON p5_ci.pipelines FOR UPDATE TO p5_ci_definer USING(true) WITH CHECK(true);
CREATE TRIGGER p5_pipeline_event_immutable BEFORE UPDATE OR DELETE ON p5_ci.pipeline_events FOR EACH ROW EXECUTE FUNCTION platform_stage.grant_audit_immutable();
ALTER TABLE p5_ci.deals DROP CONSTRAINT deals_stage_check, ADD COLUMN pipeline_id uuid NOT NULL,
 ADD FOREIGN KEY(organization_id,pipeline_id) REFERENCES p5_ci.pipelines(organization_id,id),
 ADD CHECK(stage ~ '^[A-Z][A-Z0-9_]{0,23}$');
CREATE FUNCTION p5_ci.pipeline_on_insert() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
 DECLARE p p5_ci.pipelines%ROWTYPE;
 BEGIN
 SELECT * INTO p FROM p5_ci.pipelines x WHERE x.organization_id=NEW.organization_id AND ((NEW.pipeline_id IS NULL AND x.is_default) OR x.id=NEW.pipeline_id) FOR SHARE;
 IF NOT FOUND OR NEW.stage<>'OPEN' THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='P5004'; END IF;
 NEW.pipeline_id:=p.id; RETURN NEW;
 END $$;
CREATE TRIGGER p5_deal_pipeline_insert BEFORE INSERT ON p5_ci.deals FOR EACH ROW EXECUTE FUNCTION p5_ci.pipeline_on_insert();
CREATE FUNCTION p5_ci.next_deal_stages(p_org uuid,p_id uuid,p_stage text) RETURNS text[] LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT CASE WHEN p_stage IN ('WON','LOST') THEN ARRAY[]::text[] ELSE ARRAY(SELECT DISTINCT x FROM unnest(ARRAY[p.stages->(s.ordinality::integer)->>'key','LOST']) x WHERE x IS NOT NULL ORDER BY x) END
 FROM p5_ci.pipelines p CROSS JOIN LATERAL jsonb_array_elements(p.stages) WITH ORDINALITY s(value,ordinality)
 WHERE p.organization_id=p_org AND p.id=p_id AND s.value->>'key'=p_stage
 $$;
CREATE OR REPLACE FUNCTION p5_ci.deal_projection(d p5_ci.deals) RETURNS jsonb LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('id',d.id,'title',d.title,'stage',d.stage,'revision',d.revision,'accountId',d.account_id,'contactId',d.contact_id,'valueCents',d.value_cents,'pipelineId',d.pipeline_id,'nextStages',p5_ci.next_deal_stages(d.organization_id,d.pipeline_id,d.stage))
 $$;
CREATE FUNCTION p5_ci.pipeline_projection(p p5_ci.pipelines) RETURNS jsonb LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('id',p.id,'name',p.name,'stages',p.stages,'isDefault',p.is_default,'revision',p.revision)
 $$;
CREATE FUNCTION p5_ci.list_pipelines(p_issuer text,p_subject text,p_org uuid,p_after uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 DECLARE who record; result jsonb;
 BEGIN
 IF current_setting('transaction_read_only')<>'on' THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 SELECT * INTO who FROM p5_ci.actor(p_issuer,p_subject,p_org);
 IF NOT FOUND OR NOT(who.rep OR who.manager) THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 SELECT coalesce(jsonb_agg(p5_ci.pipeline_projection(s.row_value) ORDER BY s.id),'[]'::jsonb) INTO result FROM
 (SELECT p AS row_value,p.id FROM p5_ci.pipelines p WHERE p.organization_id=p_org AND (p_after IS NULL OR p.id>p_after) ORDER BY p.id LIMIT 21) s;
 RETURN result;
 END $$;
CREATE FUNCTION p5_ci.write_pipeline(p_issuer text,p_subject text,p_org uuid,p_id uuid,p_request uuid,p_expected integer,p_name text,p_stages jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
 DECLARE who record; p p5_ci.pipelines%ROWTYPE; ev p5_ci.pipeline_events%ROWTYPE; fingerprint text; ident uuid;
 BEGIN
 IF current_setting('transaction_isolation')<>'serializable' THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 SELECT * INTO who FROM p5_ci.actor(p_issuer,p_subject,p_org);
 IF NOT FOUND OR NOT who.manager OR NOT EXISTS(SELECT 1 FROM p5_ci.pipeline_admin_grants g WHERE g.organization_id=p_org AND g.user_id=who.actor_id AND g.active) THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 FOREACH ident IN ARRAY ARRAY[p_id,p_request] LOOP
 IF ident IS NULL OR substring(ident::text from 15 for 1)<>'4' OR substring(ident::text from 20 for 1) NOT IN ('8','9','a','b') THEN RAISE EXCEPTION 'P5_INVALID' USING ERRCODE='22023'; END IF;
 END LOOP;
 IF p_name IS NULL OR p_name !~ '^Demo [A-Za-z][A-Za-z0-9 &.-]{2,74}$' OR NOT p5_ci.valid_pipeline_stages(p_stages) OR (p_expected IS NOT NULL AND (p_expected<0 OR p_expected>=1000000)) THEN RAISE EXCEPTION 'P5_INVALID' USING ERRCODE='22023'; END IF;
 fingerprint:=encode(sha256(convert_to(jsonb_build_array(p_id,p_expected,p_name,p_stages)::text,'UTF8')),'hex');
 SELECT * INTO ev FROM p5_ci.pipeline_events WHERE organization_id=p_org AND request_id=p_request;
 IF FOUND THEN
 IF ev.actor_id<>who.actor_id OR ev.pipeline_id<>p_id OR ev.digest<>fingerprint THEN RAISE EXCEPTION 'P5_CONFLICT' USING ERRCODE='23505'; END IF;
 SELECT * INTO p FROM p5_ci.pipelines x WHERE x.organization_id=p_org AND x.id=p_id;
 RETURN jsonb_build_object('outcome','replay','record',p5_ci.pipeline_projection(p));
 END IF;
 IF p_expected IS NULL THEN
 INSERT INTO p5_ci.pipelines(organization_id,id,name,stages) VALUES(p_org,p_id,p_name,p_stages) RETURNING * INTO p;
 ELSE
 SELECT * INTO p FROM p5_ci.pipelines x WHERE x.organization_id=p_org AND x.id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='P5004'; END IF;
 IF p.revision<>p_expected OR (p.name,p.stages)=(p_name,p_stages) OR (p.stages<>p_stages AND EXISTS(SELECT 1 FROM p5_ci.deals d WHERE d.organization_id=p_org AND d.pipeline_id=p_id)) THEN RAISE EXCEPTION 'P5_CONFLICT' USING ERRCODE='23505'; END IF;
 UPDATE p5_ci.pipelines SET name=p_name,stages=p_stages,revision=revision+1 WHERE organization_id=p_org AND id=p_id RETURNING * INTO p;
 END IF;
 INSERT INTO p5_ci.pipeline_events(organization_id,request_id,pipeline_id,actor_id,revision,digest) VALUES(p_org,p_request,p_id,who.actor_id,p.revision,fingerprint);
 RETURN jsonb_build_object('outcome',CASE WHEN p_expected IS NULL THEN 'created' ELSE 'applied' END,'record',p5_ci.pipeline_projection(p));
 END $$;
CREATE OR REPLACE FUNCTION p5_ci.query_deals(p_issuer text,p_subject text,p_org uuid,p_after uuid,p_id uuid,p_search text,p_stage text)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 DECLARE who record; result jsonb;
 BEGIN
 IF current_setting('transaction_read_only')<>'on' THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 IF p_search IS NULL OR p_search !~ '^[A-Za-z0-9 &.-]{0,80}$' OR (p_stage IS NOT NULL AND p_stage !~ '^[A-Z][A-Z0-9_]{0,23}) OR (p_id IS NOT NULL AND p_after IS NOT NULL) THEN RAISE EXCEPTION 'P5_INVALID' USING ERRCODE='22023'; END IF;
 SELECT * INTO who FROM p5_ci.actor(p_issuer,p_subject,p_org);
 IF NOT FOUND OR NOT(who.rep OR who.manager) THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 SELECT coalesce(jsonb_agg(p5_ci.deal_projection(d.row_value) ORDER BY d.id),'[]'::jsonb) INTO result FROM
 (SELECT x AS row_value,x.id FROM p5_ci.deals x WHERE x.organization_id=p_org AND (p_after IS NULL OR x.id>p_after) AND (p_id IS NULL OR x.id=p_id)
 AND (p_search='' OR strpos(lower(x.title),lower(p_search))>0) AND (p_stage IS NULL OR x.stage=p_stage)
 AND p5_ci.deal_visible(p_issuer,p_subject,p_org,x) ORDER BY x.id LIMIT 21) d;
 IF p_id IS NOT NULL THEN RETURN result->0; END IF; RETURN result;
 END $$;
) OR (p_id IS NOT NULL AND p_after IS NOT NULL) THEN RAISE EXCEPTION 'P5_INVALID' USING ERRCODE='22023'; END IF;
 SELECT * INTO who FROM p5_ci.actor(p_issuer,p_subject,p_org);
 IF NOT FOUND OR NOT(who.rep OR who.manager) THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 SELECT coalesce(jsonb_agg(p5_ci.deal_projection(d.row_value) ORDER BY d.id),'[]'::jsonb) INTO result FROM
 (SELECT x AS row_value,x.id FROM p5_ci.deals x WHERE x.organization_id=p_org AND (p_after IS NULL OR x.id>p_after) AND (p_id IS NULL OR x.id=p_id)
 AND (p_search='' OR strpos(lower(x.title),lower(p_search))>0) AND (p_stage IS NULL OR x.stage=p_stage)
 AND p5_ci.deal_visible(p_issuer,p_subject,p_org,x) ORDER BY x.id LIMIT 21) d;
 IF p_id IS NOT NULL THEN RETURN result->0; END IF; RETURN result;
 END $$;

DROP FUNCTION p5_ci.write_deal(text,text,uuid,uuid,uuid,integer,text,text,integer,uuid,uuid,text);
CREATE FUNCTION p5_ci.write_deal(p_issuer text,p_subject text,p_org uuid,p_id uuid,p_request uuid,p_expected integer,
 p_operation text,p_title text,p_value integer,p_account uuid,p_contact uuid,p_next text,p_pipeline uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
 DECLARE who record; d p5_ci.deals%ROWTYPE; ev p5_ci.deal_events%ROWTYPE; fingerprint text; action_code text; prior text; ident uuid;
 BEGIN
 IF current_setting('transaction_isolation')<>'serializable' THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 SELECT * INTO who FROM p5_ci.actor(p_issuer,p_subject,p_org);
 IF NOT FOUND OR NOT(who.rep OR who.manager) OR (p_operation='create' AND NOT who.rep) THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 FOREACH ident IN ARRAY ARRAY[p_id,p_request] LOOP
 IF ident IS NULL OR substring(ident::text from 15 for 1)<>'4' OR substring(ident::text from 20 for 1) NOT IN ('8','9','a','b') THEN RAISE EXCEPTION 'P5_INVALID' USING ERRCODE='22023'; END IF;
 END LOOP;
 IF (p_operation<>'create' AND p_pipeline IS NOT NULL) OR p_operation IS NULL OR p_operation NOT IN ('create','edit','transition') OR (p_operation='create' AND p_expected IS NOT NULL)
 OR (p_operation<>'create' AND (p_expected IS NULL OR p_expected<0 OR p_expected>=1000000)) THEN RAISE EXCEPTION 'P5_INVALID' USING ERRCODE='22023'; END IF;
 IF p_operation IN ('create','edit') THEN
 IF p_title IS NULL OR p_title !~ '^Demo [A-Za-z][A-Za-z0-9 &.-]{2,74}$' OR p_value IS NULL OR p_value<0 OR p_value>1000000000 OR p_next IS NOT NULL
 OR (p_operation='create' AND (p_account IS NULL OR p_contact IS NULL)) OR (p_operation='edit' AND (p_account IS NOT NULL OR p_contact IS NOT NULL)) THEN RAISE EXCEPTION 'P5_INVALID' USING ERRCODE='22023'; END IF;
 IF p_operation='create' AND NOT p5_ci.deal_links_visible(p_issuer,p_subject,p_org,p_account,p_contact) THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='P5004'; END IF;
 ELSE
 IF p_title IS NOT NULL OR p_value IS NOT NULL OR p_account IS NOT NULL OR p_contact IS NOT NULL OR p_next IS NULL OR p_next !~ '^[A-Z][A-Z0-9_]{0,23} THEN RAISE EXCEPTION 'P5_INVALID' USING ERRCODE='22023'; END IF;
 IF NOT EXISTS(SELECT 1 FROM p5_ci.stage_edit_grants g WHERE g.organization_id=p_org AND g.user_id=who.actor_id AND g.active) THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 END IF;
 action_code:=CASE p_operation WHEN 'create' THEN 'CREATED' WHEN 'edit' THEN 'EDITED' ELSE 'STAGE_CHANGED' END;
 fingerprint:=encode(sha256(convert_to(jsonb_build_array(p_id,p_expected,p_operation,p_title,p_value,p_account,p_contact,p_next,p_pipeline)::text,'UTF8')),'hex');
 SELECT * INTO ev FROM p5_ci.deal_events WHERE organization_id=p_org AND request_id=p_request;
 IF FOUND THEN
 IF ev.actor_id<>who.actor_id OR ev.deal_id<>p_id OR ev.action<>action_code OR ev.digest<>fingerprint THEN RAISE EXCEPTION 'P5_CONFLICT' USING ERRCODE='23505'; END IF;
 SELECT * INTO d FROM p5_ci.deals x WHERE x.organization_id=p_org AND x.id=p_id AND p5_ci.deal_visible(p_issuer,p_subject,p_org,x);
 IF NOT FOUND THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='P5004'; END IF;
 RETURN jsonb_build_object('outcome','replay','record',p5_ci.deal_projection(d));
 END IF;
 IF p_operation='create' THEN
 INSERT INTO p5_ci.deals(organization_id,id,owner_id,account_id,contact_id,title,value_cents,pipeline_id) VALUES(p_org,p_id,who.actor_id,p_account,p_contact,p_title,p_value,p_pipeline) RETURNING * INTO d;
 ELSE
 SELECT * INTO d FROM p5_ci.deals x WHERE x.organization_id=p_org AND x.id=p_id AND p5_ci.deal_visible(p_issuer,p_subject,p_org,x) FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='P5004'; END IF;
 IF d.revision<>p_expected OR d.stage IN ('WON','LOST') THEN RAISE EXCEPTION 'P5_CONFLICT' USING ERRCODE='23505'; END IF;
 IF p_operation='edit' THEN
 IF (d.title,d.value_cents)=(p_title,p_value) THEN RAISE EXCEPTION 'P5_CONFLICT' USING ERRCODE='23505'; END IF;
 UPDATE p5_ci.deals SET title=p_title,value_cents=p_value,revision=revision+1 WHERE organization_id=p_org AND id=p_id RETURNING * INTO d;
 ELSE
 prior:=d.stage;
 IF NOT (p_next=ANY(p5_ci.next_deal_stages(p_org,d.pipeline_id,prior))) THEN RAISE EXCEPTION 'P5_CONFLICT' USING ERRCODE='23505'; END IF;
 UPDATE p5_ci.deals SET stage=p_next,revision=revision+1 WHERE organization_id=p_org AND id=p_id RETURNING * INTO d;
 END IF; END IF;
 INSERT INTO p5_ci.deal_events(organization_id,request_id,deal_id,actor_id,action,revision,digest,previous_stage,next_stage) VALUES(p_org,p_request,p_id,who.actor_id,action_code,d.revision,fingerprint,prior,p_next);
 RETURN jsonb_build_object('outcome',CASE WHEN p_operation='create' THEN 'created' ELSE 'applied' END,'record',p5_ci.deal_projection(d));
 END $$;
 THEN RAISE EXCEPTION 'P5_INVALID' USING ERRCODE='22023'; END IF;
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

GRANT CREATE ON SCHEMA p5_ci TO p5_ci_definer;
ALTER FUNCTION p5_ci.list_pipelines(text,text,uuid,uuid) OWNER TO p5_ci_definer;
ALTER FUNCTION p5_ci.write_pipeline(text,text,uuid,uuid,uuid,integer,text,jsonb) OWNER TO p5_ci_definer;
ALTER FUNCTION p5_ci.write_deal(text,text,uuid,uuid,uuid,integer,text,text,integer,uuid,uuid,text,uuid) OWNER TO p5_ci_definer;
REVOKE CREATE ON SCHEMA p5_ci FROM p5_ci_definer;
REVOKE ALL ON FUNCTION p5_ci.valid_pipeline_stages(jsonb),p5_ci.pipeline_on_insert(),p5_ci.next_deal_stages(uuid,uuid,text),p5_ci.pipeline_projection(p5_ci.pipelines),p5_ci.list_pipelines(text,text,uuid,uuid),p5_ci.write_pipeline(text,text,uuid,uuid,uuid,integer,text,jsonb),p5_ci.write_deal(text,text,uuid,uuid,uuid,integer,text,text,integer,uuid,uuid,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p5_ci.valid_pipeline_stages(jsonb),p5_ci.pipeline_on_insert(),p5_ci.next_deal_stages(uuid,uuid,text),p5_ci.pipeline_projection(p5_ci.pipelines) TO p5_ci_definer;
GRANT EXECUTE ON FUNCTION p5_ci.list_pipelines(text,text,uuid,uuid),p5_ci.write_pipeline(text,text,uuid,uuid,uuid,integer,text,jsonb),p5_ci.write_deal(text,text,uuid,uuid,uuid,integer,text,text,integer,uuid,uuid,text,uuid) TO p5_ci_runtime;
COMMIT;
