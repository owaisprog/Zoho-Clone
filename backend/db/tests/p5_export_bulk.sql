-- P5.25 disposable CI: explicit grants, bounded exports, atomic bulk lead actions.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' OR current_user<>'demo_ci'
 OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
 OR to_regclass('p5_ci.custom_field_values') IS NULL THEN RAISE EXCEPTION 'P5_DISPOSABLE_ONLY'; END IF;
END $$;
CREATE TABLE p5_ci.bulk_grants(
 organization_id uuid NOT NULL,user_id uuid NOT NULL,can_export boolean NOT NULL DEFAULT false,can_bulk boolean NOT NULL DEFAULT false,
 PRIMARY KEY(organization_id,user_id),FOREIGN KEY(organization_id,user_id) REFERENCES platform_stage.memberships(organization_id,user_id)
);
CREATE TABLE p5_ci.export_jobs(
 organization_id uuid NOT NULL,id uuid NOT NULL,actor_id uuid NOT NULL,digest text NOT NULL CHECK(digest ~ '^[a-f0-9]{64}$'),
 lead_ids uuid[] NOT NULL CHECK(cardinality(lead_ids)<=10),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(organization_id,id),FOREIGN KEY(organization_id,actor_id) REFERENCES platform_stage.memberships(organization_id,user_id)
);
CREATE TABLE p5_ci.bulk_jobs(
 organization_id uuid NOT NULL,id uuid NOT NULL,actor_id uuid NOT NULL,digest text NOT NULL CHECK(digest ~ '^[a-f0-9]{64}$'),
 lead_ids uuid[] NOT NULL CHECK(cardinality(lead_ids) BETWEEN 1 AND 10),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(organization_id,id),FOREIGN KEY(organization_id,actor_id) REFERENCES platform_stage.memberships(organization_id,user_id)
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['bulk_grants','export_jobs','bulk_jobs'] LOOP
 EXECUTE format('ALTER TABLE p5_ci.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE p5_ci.%I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE p5_ci.%I OWNER TO p4_stage_owner',t);
 EXECUTE format('REVOKE ALL ON p5_ci.%I FROM PUBLIC,p5_ci_runtime',t);
 EXECUTE format('GRANT SELECT ON p5_ci.%I TO p5_ci_definer',t);
 EXECUTE format('CREATE POLICY p5_bulk_read ON p5_ci.%I FOR SELECT TO p5_ci_definer USING(true)',t);
 IF t<>'bulk_grants' THEN
 EXECUTE format('GRANT INSERT ON p5_ci.%I TO p5_ci_definer',t);
 EXECUTE format('CREATE POLICY p5_bulk_insert ON p5_ci.%I FOR INSERT TO p5_ci_definer WITH CHECK(true)',t);
 EXECUTE format('CREATE TRIGGER p5_bulk_immutable BEFORE UPDATE OR DELETE ON p5_ci.%I FOR EACH ROW EXECUTE FUNCTION platform_stage.grant_audit_immutable()',t);
 END IF;
 END LOOP;
END $$;
CREATE FUNCTION p5_ci.bulk_actor(p_issuer text,p_subject text,p_org uuid,p_export boolean) RETURNS uuid LANGUAGE plpgsql STABLE SET search_path=pg_catalog AS $$
 DECLARE who record;
 BEGIN
 SELECT * INTO who FROM p5_ci.actor(p_issuer,p_subject,p_org);
 IF NOT FOUND OR NOT(who.rep OR who.manager) OR NOT EXISTS(
 SELECT 1 FROM p5_ci.bulk_grants g WHERE g.organization_id=p_org AND g.user_id=who.actor_id AND CASE WHEN p_export THEN g.can_export ELSE g.can_bulk END)
 THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 RETURN who.actor_id;
 END $$;
CREATE FUNCTION p5_ci.export_visible(p_issuer text,p_subject text,p_org uuid,p_ids uuid[]) RETURNS SETOF p5_ci.leads LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT l.* FROM p5_ci.leads l CROSS JOIN p5_ci.actor(p_issuer,p_subject,p_org) who
 WHERE l.organization_id=p_org AND l.id=ANY(p_ids) AND (who.rep OR who.manager)
 AND ((who.rep AND l.owner_id=who.actor_id) OR (l.team_id IS NOT NULL AND platform_stage.team_membership_check(p_issuer,p_subject,p_org,l.team_id)))
 ORDER BY l.id
$$;
CREATE FUNCTION p5_ci.export_projection(p_issuer text,p_subject text,p_org uuid,p_job uuid,p_ids uuid[]) RETURNS jsonb LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('id',p_job,'rows',coalesce(jsonb_agg(p5_ci.project(l) ORDER BY l.id),'[]'::jsonb))
 FROM p5_ci.export_visible(p_issuer,p_subject,p_org,p_ids) l
$$;
CREATE FUNCTION p5_ci.read_export(p_issuer text,p_subject text,p_org uuid,p_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 DECLARE actor uuid;j p5_ci.export_jobs%ROWTYPE;
 BEGIN
 IF current_setting('transaction_read_only')<>'on' THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 actor:=p5_ci.bulk_actor(p_issuer,p_subject,p_org,true);
 SELECT * INTO j FROM p5_ci.export_jobs WHERE organization_id=p_org AND id=p_id AND actor_id=actor;
 IF NOT FOUND THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='P5004'; END IF;
 RETURN p5_ci.export_projection(p_issuer,p_subject,p_org,p_id,j.lead_ids);
 END $$;
CREATE FUNCTION p5_ci.write_export(p_issuer text,p_subject text,p_org uuid,p_id uuid,p_ids uuid[]) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
 DECLARE actor uuid;j p5_ci.export_jobs%ROWTYPE;fingerprint text;approved uuid[];
 BEGIN
 IF current_setting('transaction_isolation')<>'serializable' THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 actor:=p5_ci.bulk_actor(p_issuer,p_subject,p_org,true);
 IF p_id IS NULL OR substring(p_id::text from 15 for 1)<>'4' OR substring(p_id::text from 20 for 1) NOT IN ('8','9','a','b') OR p_ids IS NULL OR cardinality(p_ids) NOT BETWEEN 1 AND 10 OR array_position(p_ids,NULL) IS NOT NULL OR (SELECT count(DISTINCT x) FROM unnest(p_ids) x)<>cardinality(p_ids) THEN RAISE EXCEPTION 'P5_INVALID' USING ERRCODE='22023'; END IF;
 fingerprint:=encode(sha256(convert_to(to_jsonb(p_ids)::text,'UTF8')),'hex');
 SELECT * INTO j FROM p5_ci.export_jobs WHERE organization_id=p_org AND id=p_id;
 IF FOUND THEN
 IF j.actor_id<>actor THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='P5004'; END IF;
 IF j.digest<>fingerprint THEN RAISE EXCEPTION 'P5_CONFLICT' USING ERRCODE='23505'; END IF;
 RETURN p5_ci.export_projection(p_issuer,p_subject,p_org,p_id,j.lead_ids);
 END IF;
 IF (SELECT count(*) FROM p5_ci.export_jobs WHERE organization_id=p_org)>=20 THEN RAISE EXCEPTION 'P5_QUOTA' USING ERRCODE='42501'; END IF;
 SELECT coalesce(array_agg(l.id ORDER BY l.id),ARRAY[]::uuid[]) INTO approved FROM p5_ci.export_visible(p_issuer,p_subject,p_org,p_ids) l;
 INSERT INTO p5_ci.export_jobs(organization_id,id,actor_id,digest,lead_ids) VALUES(p_org,p_id,actor,fingerprint,approved);
 RETURN p5_ci.export_projection(p_issuer,p_subject,p_org,p_id,approved);
 END $$;
CREATE FUNCTION p5_ci.write_bulk(p_issuer text,p_subject text,p_org uuid,p_id uuid,p_action text,p_target text,p_items jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
 DECLARE actor uuid;j p5_ci.bulk_jobs%ROWTYPE;fingerprint text;item jsonb;lid uuid;rid uuid;rev integer;l p5_ci.leads%ROWTYPE;ids uuid[]:=ARRAY[]::uuid[];requests uuid[]:=ARRAY[]::uuid[];
 BEGIN
 IF current_setting('transaction_isolation')<>'serializable' THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 actor:=p5_ci.bulk_actor(p_issuer,p_subject,p_org,false);
 IF p_id IS NULL OR substring(p_id::text from 15 for 1)<>'4' OR substring(p_id::text from 20 for 1) NOT IN ('8','9','a','b') OR p_action IS NULL OR p_action NOT IN ('ASSIGN','STATUS') OR p_target IS NULL
 OR (p_action='STATUS' AND p_target NOT IN ('CONTACTED','QUALIFIED','LOST')) OR (p_action='ASSIGN' AND p_target !~ '^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$')
 OR p_items IS NULL OR jsonb_typeof(p_items)<>'array' OR octet_length(p_items::text)>5000 THEN RAISE EXCEPTION 'P5_INVALID' USING ERRCODE='22023'; END IF;
 IF jsonb_array_length(p_items) NOT BETWEEN 1 AND 10 THEN RAISE EXCEPTION 'P5_INVALID' USING ERRCODE='22023'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
 IF jsonb_typeof(item)<>'object' THEN RAISE EXCEPTION 'P5_INVALID' USING ERRCODE='22023'; END IF;
 IF (SELECT count(*) FROM jsonb_object_keys(item))<>3 OR NOT(item ? 'id' AND item ? 'requestId' AND item ? 'revision')
 OR jsonb_typeof(item->'id')<>'string' OR (item->>'id') !~ '^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'
 OR jsonb_typeof(item->'requestId')<>'string' OR (item->>'requestId') !~ '^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'
 OR jsonb_typeof(item->'revision')<>'number' OR (item->>'revision') !~ '^[0-9]{1,6}$' THEN RAISE EXCEPTION 'P5_INVALID' USING ERRCODE='22023'; END IF;
 lid:=(item->>'id')::uuid;rid:=(item->>'requestId')::uuid;
 IF lid=ANY(ids) OR rid=ANY(requests) THEN RAISE EXCEPTION 'P5_INVALID' USING ERRCODE='22023'; END IF;
 ids:=array_append(ids,lid);requests:=array_append(requests,rid);
 -- Every record must be visible, including for idempotent replays.
 l:=p5_ci.rules_visible_lead(p_issuer,p_subject,p_org,lid);
 END LOOP;
 fingerprint:=encode(sha256(convert_to(jsonb_build_array(p_action,p_target,p_items)::text,'UTF8')),'hex');
 SELECT * INTO j FROM p5_ci.bulk_jobs WHERE organization_id=p_org AND id=p_id;
 IF FOUND THEN
 IF j.actor_id<>actor THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='P5004'; END IF;
 IF j.digest<>fingerprint THEN RAISE EXCEPTION 'P5_CONFLICT' USING ERRCODE='23505'; END IF;
 RETURN jsonb_build_object('id',p_id,'count',cardinality(j.lead_ids));
 END IF;
 IF (SELECT count(*) FROM p5_ci.bulk_jobs WHERE organization_id=p_org)>=20 THEN RAISE EXCEPTION 'P5_QUOTA' USING ERRCODE='42501'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p_items) ORDER BY value->>'id' LOOP
 lid:=(item->>'id')::uuid;rid:=(item->>'requestId')::uuid;rev:=(item->>'revision')::integer;
 l:=p5_ci.rules_visible_lead(p_issuer,p_subject,p_org,lid);
 IF l.revision<>rev OR l.status IN ('LOST','CONVERTED') OR EXISTS(SELECT 1 FROM p5_ci.lead_events e WHERE e.organization_id=p_org AND e.request_id=rid) THEN RAISE EXCEPTION 'P5_CONFLICT' USING ERRCODE='23505'; END IF;
 IF p_action='ASSIGN' THEN PERFORM p5_ci.assign_lead(p_issuer,p_subject,p_org,lid,rid,rev,p_target::uuid);
 ELSIF p_target='CONTACTED' THEN PERFORM p5_ci.change_lead(p_issuer,p_subject,p_org,lid,rid,rev,'transition',NULL,NULL,NULL,p_target);
 ELSE PERFORM p5_ci.qualify_reason(p_issuer,p_subject,p_org,lid,rid,rev,p_target,CASE WHEN p_target='QUALIFIED' THEN 'FIT' ELSE 'NOT_FIT' END);
 END IF;
 END LOOP;
 INSERT INTO p5_ci.bulk_jobs(organization_id,id,actor_id,digest,lead_ids) VALUES(p_org,p_id,actor,fingerprint,ids);
 RETURN jsonb_build_object('id',p_id,'count',cardinality(ids));
 END $$;
GRANT CREATE ON SCHEMA p5_ci TO p5_ci_definer;
ALTER FUNCTION p5_ci.read_export(text,text,uuid,uuid) OWNER TO p5_ci_definer;
REVOKE ALL ON FUNCTION p5_ci.read_export(text,text,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p5_ci.read_export(text,text,uuid,uuid) TO p5_ci_runtime;
ALTER FUNCTION p5_ci.write_export(text,text,uuid,uuid,uuid[]) OWNER TO p5_ci_definer;
REVOKE ALL ON FUNCTION p5_ci.write_export(text,text,uuid,uuid,uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p5_ci.write_export(text,text,uuid,uuid,uuid[]) TO p5_ci_runtime;
ALTER FUNCTION p5_ci.write_bulk(text,text,uuid,uuid,text,text,jsonb) OWNER TO p5_ci_definer;
REVOKE ALL ON FUNCTION p5_ci.write_bulk(text,text,uuid,uuid,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p5_ci.write_bulk(text,text,uuid,uuid,text,text,jsonb) TO p5_ci_runtime;
REVOKE CREATE ON SCHEMA p5_ci FROM p5_ci_definer;
REVOKE ALL ON FUNCTION p5_ci.bulk_actor(text,text,uuid,boolean),p5_ci.export_visible(text,text,uuid,uuid[]),p5_ci.export_projection(text,text,uuid,uuid,uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p5_ci.bulk_actor(text,text,uuid,boolean),p5_ci.export_visible(text,text,uuid,uuid[]),p5_ci.export_projection(text,text,uuid,uuid,uuid[]) TO p5_ci_definer;
COMMIT;
