-- Disposable P5 settings/hierarchy/custom fields. No external migration.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' OR current_user<>'demo_ci'
 OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
 OR to_regclass('p5_ci.qualification_reasons') IS NULL THEN RAISE EXCEPTION 'P5_DISPOSABLE_ONLY'; END IF;
END $$;
CREATE TABLE p5_ci.crm_settings(
 organization_id uuid PRIMARY KEY REFERENCES platform_stage.organizations(id),
 locale text NOT NULL CHECK(locale IN ('en-US','en-GB')), revision integer NOT NULL CHECK(revision BETWEEN 0 AND 1000000)
);
CREATE TABLE p5_ci.account_relationships(
 organization_id uuid NOT NULL,child_id uuid NOT NULL,parent_id uuid,revision integer NOT NULL CHECK(revision BETWEEN 0 AND 1000000),
 PRIMARY KEY(organization_id,child_id),CHECK(child_id<>parent_id),
 FOREIGN KEY(organization_id,child_id) REFERENCES p5_ci.accounts(organization_id,id),
 FOREIGN KEY(organization_id,parent_id) REFERENCES p5_ci.accounts(organization_id,id)
);
CREATE TABLE p5_ci.customization_grants(
 organization_id uuid PRIMARY KEY REFERENCES platform_stage.organizations(id),active boolean NOT NULL DEFAULT false
);
CREATE TABLE p5_ci.custom_field_definitions(
 organization_id uuid NOT NULL,id uuid NOT NULL,label text NOT NULL CHECK(label ~ '^Demo [A-Za-z][A-Za-z0-9 ]{2,34}$'),
 kind text NOT NULL CHECK(kind IN ('BOOLEAN','INTEGER')),position integer NOT NULL CHECK(position BETWEEN 1 AND 10),
 PRIMARY KEY(organization_id,id),UNIQUE(organization_id,label),UNIQUE(organization_id,position),
 FOREIGN KEY(organization_id) REFERENCES platform_stage.organizations(id)
);
CREATE TABLE p5_ci.custom_field_values(
 organization_id uuid NOT NULL,account_id uuid NOT NULL,field_id uuid NOT NULL,value jsonb NOT NULL,revision integer NOT NULL CHECK(revision BETWEEN 0 AND 1000000),
 PRIMARY KEY(organization_id,account_id,field_id),
 FOREIGN KEY(organization_id,account_id) REFERENCES p5_ci.accounts(organization_id,id),
 FOREIGN KEY(organization_id,field_id) REFERENCES p5_ci.custom_field_definitions(organization_id,id)
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['crm_settings','account_relationships','customization_grants','custom_field_definitions','custom_field_values'] LOOP
 EXECUTE format('ALTER TABLE p5_ci.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE p5_ci.%I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE p5_ci.%I OWNER TO p4_stage_owner',t);
 EXECUTE format('REVOKE ALL ON p5_ci.%I FROM PUBLIC,p5_ci_runtime',t);
 EXECUTE format('GRANT SELECT ON p5_ci.%I TO p5_ci_definer',t);
 EXECUTE format('CREATE POLICY config_read ON p5_ci.%I FOR SELECT TO p5_ci_definer USING(true)',t);
 IF t<>'customization_grants' THEN
 EXECUTE format('GRANT INSERT ON p5_ci.%I TO p5_ci_definer',t);
 EXECUTE format('CREATE POLICY config_insert ON p5_ci.%I FOR INSERT TO p5_ci_definer WITH CHECK(true)',t);
 END IF;
 IF t IN ('crm_settings','account_relationships','custom_field_values') THEN
 EXECUTE format('CREATE POLICY config_update ON p5_ci.%I FOR UPDATE TO p5_ci_definer USING(true) WITH CHECK(true)',t);
 END IF;
 END LOOP;
END $$;
GRANT UPDATE(locale,revision) ON p5_ci.crm_settings TO p5_ci_definer;
GRANT UPDATE(parent_id,revision) ON p5_ci.account_relationships TO p5_ci_definer;
GRANT UPDATE(value,revision) ON p5_ci.custom_field_values TO p5_ci_definer;
CREATE TRIGGER p5_custom_field_immutable BEFORE UPDATE OR DELETE ON p5_ci.custom_field_definitions FOR EACH ROW EXECUTE FUNCTION platform_stage.grant_audit_immutable();
CREATE FUNCTION p5_ci.crm_actor(p_issuer text,p_subject text,p_org uuid,p_admin boolean,p_custom boolean) RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path=pg_catalog AS $$
 DECLARE who record;admin_ok boolean;
 BEGIN
 SELECT * INTO who FROM p5_ci.actor(p_issuer,p_subject,p_org);
 IF NOT FOUND OR NOT(who.rep OR who.manager) THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 admin_ok:=who.manager AND EXISTS(SELECT 1 FROM p5_ci.pipeline_admin_grants g WHERE g.organization_id=p_org AND g.user_id=who.actor_id AND g.active);
 IF p_admin AND NOT admin_ok THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 IF p_custom AND NOT EXISTS(SELECT 1 FROM p5_ci.customization_grants g WHERE g.organization_id=p_org AND g.active) THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('manager',who.manager,'admin',admin_ok,'custom',EXISTS(SELECT 1 FROM p5_ci.customization_grants g WHERE g.organization_id=p_org AND g.active));
 END $$;
CREATE FUNCTION p5_ci.settings_projection(p_org uuid,p_actor jsonb) RETURNS jsonb LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('locale',coalesce(s.locale,'en-US'),'revision',coalesce(s.revision,-1),'defaultPipelineId',(SELECT id FROM p5_ci.pipelines WHERE organization_id=p_org AND is_default),'permissions',p_actor)
 FROM (SELECT 1) base LEFT JOIN p5_ci.crm_settings s ON s.organization_id=p_org
$$;
CREATE FUNCTION p5_ci.read_crm_settings(p_issuer text,p_subject text,p_org uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 BEGIN
 IF current_setting('transaction_read_only')<>'on' THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 RETURN p5_ci.settings_projection(p_org,p5_ci.crm_actor(p_issuer,p_subject,p_org,false,false));
 END $$;
CREATE FUNCTION p5_ci.write_crm_settings(p_issuer text,p_subject text,p_org uuid,p_locale text,p_expected integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
 DECLARE actor jsonb;cfg jsonb;
 BEGIN
 IF current_setting('transaction_isolation')<>'serializable' THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 actor:=p5_ci.crm_actor(p_issuer,p_subject,p_org,true,false);
 IF p_locale IS NULL OR p_locale NOT IN ('en-US','en-GB') OR p_expected IS NULL OR p_expected NOT BETWEEN -1 AND 999999 THEN RAISE EXCEPTION 'P5_INVALID' USING ERRCODE='22023'; END IF;
 cfg:=p5_ci.settings_projection(p_org,actor);
 IF (cfg->>'revision')::integer=p_expected+1 AND cfg->>'locale'=p_locale THEN RETURN cfg; END IF;
 IF (cfg->>'revision')::integer<>p_expected THEN RAISE EXCEPTION 'P5_CONFLICT' USING ERRCODE='23505'; END IF;
 INSERT INTO p5_ci.crm_settings VALUES(p_org,p_locale,p_expected+1) ON CONFLICT(organization_id) DO UPDATE SET locale=EXCLUDED.locale,revision=EXCLUDED.revision;
 RETURN p5_ci.settings_projection(p_org,actor);
 END $$;
CREATE FUNCTION p5_ci.require_account(p_issuer text,p_subject text,p_org uuid,p_id uuid) RETURNS void LANGUAGE plpgsql STABLE SET search_path=pg_catalog AS $$
 BEGIN
 IF p_id IS NULL OR NOT p5_ci.account_visible(p_issuer,p_subject,p_org,p_id) THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='P5004'; END IF;
 END $$;
CREATE FUNCTION p5_ci.read_relations(p_issuer text,p_subject text,p_org uuid,p_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 DECLARE r p5_ci.account_relationships%ROWTYPE;children jsonb;candidates jsonb;
 BEGIN
 IF current_setting('transaction_read_only')<>'on' THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 PERFORM p5_ci.crm_actor(p_issuer,p_subject,p_org,false,false);
 PERFORM p5_ci.require_account(p_issuer,p_subject,p_org,p_id);
 SELECT * INTO r FROM p5_ci.account_relationships WHERE organization_id=p_org AND child_id=p_id;
 SELECT coalesce(jsonb_agg(p5_ci.account_projection(a) ORDER BY a.id),'[]'::jsonb) INTO children FROM
 (SELECT x.* FROM p5_ci.accounts x JOIN p5_ci.account_relationships e ON e.organization_id=x.organization_id AND e.child_id=x.id WHERE x.organization_id=p_org AND e.parent_id=p_id AND p5_ci.account_visible(p_issuer,p_subject,p_org,x.id) ORDER BY x.id LIMIT 20) a;
 SELECT coalesce(jsonb_agg(p5_ci.account_projection(a) ORDER BY a.id),'[]'::jsonb) INTO candidates FROM
 (SELECT x.* FROM p5_ci.accounts x WHERE x.organization_id=p_org AND x.id<>p_id AND p5_ci.account_visible(p_issuer,p_subject,p_org,x.id) ORDER BY x.id LIMIT 20) a;
 RETURN jsonb_build_object('id',p_id,'parentId',CASE WHEN r.parent_id IS NOT NULL AND p5_ci.account_visible(p_issuer,p_subject,p_org,r.parent_id) THEN r.parent_id ELSE NULL END,'revision',coalesce(r.revision,-1),'children',children,'candidates',candidates);
 END $$;
CREATE FUNCTION p5_ci.write_relation(p_issuer text,p_subject text,p_org uuid,p_id uuid,p_parent uuid,p_expected integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
 DECLARE actor jsonb;r p5_ci.account_relationships%ROWTYPE;rev integer;
 BEGIN
 IF current_setting('transaction_isolation')<>'serializable' THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 actor:=p5_ci.crm_actor(p_issuer,p_subject,p_org,false,false);
 IF NOT (actor->>'manager')::boolean THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 PERFORM p5_ci.require_account(p_issuer,p_subject,p_org,p_id);
 IF p_parent IS NOT NULL THEN PERFORM p5_ci.require_account(p_issuer,p_subject,p_org,p_parent); END IF;
 IF p_expected IS NULL OR p_expected NOT BETWEEN -1 AND 999999 OR p_id=p_parent THEN RAISE EXCEPTION 'P5_INVALID' USING ERRCODE='22023'; END IF;
 SELECT * INTO r FROM p5_ci.account_relationships WHERE organization_id=p_org AND child_id=p_id;
 rev:=coalesce(r.revision,-1);
 IF r.parent_id IS NOT NULL THEN PERFORM p5_ci.require_account(p_issuer,p_subject,p_org,r.parent_id); END IF;
 IF rev=p_expected+1 AND r.parent_id IS NOT DISTINCT FROM p_parent THEN RETURN jsonb_build_object('revision',rev); END IF;
 IF rev<>p_expected THEN RAISE EXCEPTION 'P5_CONFLICT' USING ERRCODE='23505'; END IF;
 IF p_parent IS NOT NULL AND EXISTS(WITH RECURSIVE ancestors(id) AS (SELECT p_parent UNION SELECT e.parent_id FROM p5_ci.account_relationships e JOIN ancestors a ON e.child_id=a.id WHERE e.organization_id=p_org AND e.parent_id IS NOT NULL) SELECT 1 FROM ancestors WHERE id=p_id) THEN RAISE EXCEPTION 'P5_CONFLICT' USING ERRCODE='23505'; END IF;
 INSERT INTO p5_ci.account_relationships VALUES(p_org,p_id,p_parent,p_expected+1) ON CONFLICT(organization_id,child_id) DO UPDATE SET parent_id=EXCLUDED.parent_id,revision=EXCLUDED.revision;
 RETURN jsonb_build_object('revision',p_expected+1);
 END $$;
CREATE FUNCTION p5_ci.read_custom_fields(p_issuer text,p_subject text,p_org uuid,p_account uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 DECLARE fields jsonb;
 BEGIN
 IF current_setting('transaction_read_only')<>'on' THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 PERFORM p5_ci.crm_actor(p_issuer,p_subject,p_org,false,true);PERFORM p5_ci.require_account(p_issuer,p_subject,p_org,p_account);
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',d.id,'label',d.label,'kind',d.kind,'position',d.position,'value',v.value,'revision',coalesce(v.revision,-1)) ORDER BY d.position),'[]'::jsonb) INTO fields
 FROM p5_ci.custom_field_definitions d LEFT JOIN p5_ci.custom_field_values v ON v.organization_id=d.organization_id AND v.field_id=d.id AND v.account_id=p_account WHERE d.organization_id=p_org;
 RETURN jsonb_build_object('accountId',p_account,'fields',fields);
 END $$;
CREATE FUNCTION p5_ci.create_custom_field(p_issuer text,p_subject text,p_org uuid,p_id uuid,p_label text,p_kind text,p_position integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
 DECLARE d p5_ci.custom_field_definitions%ROWTYPE;
 BEGIN
 IF current_setting('transaction_isolation')<>'serializable' THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 PERFORM p5_ci.crm_actor(p_issuer,p_subject,p_org,true,true);
 IF p_id IS NULL OR p_label IS NULL OR p_label !~ '^Demo [A-Za-z][A-Za-z0-9 ]{2,34}$' OR p_kind IS NULL OR p_kind NOT IN ('BOOLEAN','INTEGER') OR p_position IS NULL OR p_position NOT BETWEEN 1 AND 10 THEN RAISE EXCEPTION 'P5_INVALID' USING ERRCODE='22023'; END IF;
 SELECT * INTO d FROM p5_ci.custom_field_definitions WHERE organization_id=p_org AND id=p_id;
 IF FOUND THEN
 IF (d.label,d.kind,d.position) IS DISTINCT FROM (p_label,p_kind,p_position) THEN RAISE EXCEPTION 'P5_CONFLICT' USING ERRCODE='23505'; END IF;
 ELSE INSERT INTO p5_ci.custom_field_definitions VALUES(p_org,p_id,p_label,p_kind,p_position); END IF;
 RETURN jsonb_build_object('id',p_id);
 END $$;
CREATE FUNCTION p5_ci.write_custom_value(p_issuer text,p_subject text,p_org uuid,p_account uuid,p_field uuid,p_value jsonb,p_expected integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
 DECLARE k text;v p5_ci.custom_field_values%ROWTYPE;rev integer;
 BEGIN
 IF current_setting('transaction_isolation')<>'serializable' THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 PERFORM p5_ci.crm_actor(p_issuer,p_subject,p_org,false,true);PERFORM p5_ci.require_account(p_issuer,p_subject,p_org,p_account);
 SELECT kind INTO k FROM p5_ci.custom_field_definitions WHERE organization_id=p_org AND id=p_field;
 IF NOT FOUND THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='P5004'; END IF;
 IF p_expected IS NULL OR p_expected NOT BETWEEN -1 AND 999999 OR p_value IS NULL OR (k='BOOLEAN' AND jsonb_typeof(p_value)<>'boolean') OR (k='INTEGER' AND (jsonb_typeof(p_value)<>'number' OR p_value::text !~ '^[0-9]{1,5}$')) THEN RAISE EXCEPTION 'P5_INVALID' USING ERRCODE='22023'; END IF;
 SELECT * INTO v FROM p5_ci.custom_field_values WHERE organization_id=p_org AND account_id=p_account AND field_id=p_field;
 rev:=coalesce(v.revision,-1);
 IF rev=p_expected+1 AND v.value=p_value THEN RETURN jsonb_build_object('revision',rev); END IF;
 IF rev<>p_expected THEN RAISE EXCEPTION 'P5_CONFLICT' USING ERRCODE='23505'; END IF;
 INSERT INTO p5_ci.custom_field_values VALUES(p_org,p_account,p_field,p_value,p_expected+1) ON CONFLICT(organization_id,account_id,field_id) DO UPDATE SET value=EXCLUDED.value,revision=EXCLUDED.revision;
 RETURN jsonb_build_object('revision',p_expected+1);
 END $$;
GRANT CREATE ON SCHEMA p5_ci TO p5_ci_definer;
ALTER FUNCTION p5_ci.read_crm_settings(text,text,uuid) OWNER TO p5_ci_definer;
REVOKE ALL ON FUNCTION p5_ci.read_crm_settings(text,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p5_ci.read_crm_settings(text,text,uuid) TO p5_ci_runtime;
ALTER FUNCTION p5_ci.write_crm_settings(text,text,uuid,text,integer) OWNER TO p5_ci_definer;
REVOKE ALL ON FUNCTION p5_ci.write_crm_settings(text,text,uuid,text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p5_ci.write_crm_settings(text,text,uuid,text,integer) TO p5_ci_runtime;
ALTER FUNCTION p5_ci.read_relations(text,text,uuid,uuid) OWNER TO p5_ci_definer;
REVOKE ALL ON FUNCTION p5_ci.read_relations(text,text,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p5_ci.read_relations(text,text,uuid,uuid) TO p5_ci_runtime;
ALTER FUNCTION p5_ci.write_relation(text,text,uuid,uuid,uuid,integer) OWNER TO p5_ci_definer;
REVOKE ALL ON FUNCTION p5_ci.write_relation(text,text,uuid,uuid,uuid,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p5_ci.write_relation(text,text,uuid,uuid,uuid,integer) TO p5_ci_runtime;
ALTER FUNCTION p5_ci.read_custom_fields(text,text,uuid,uuid) OWNER TO p5_ci_definer;
REVOKE ALL ON FUNCTION p5_ci.read_custom_fields(text,text,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p5_ci.read_custom_fields(text,text,uuid,uuid) TO p5_ci_runtime;
ALTER FUNCTION p5_ci.create_custom_field(text,text,uuid,uuid,text,text,integer) OWNER TO p5_ci_definer;
REVOKE ALL ON FUNCTION p5_ci.create_custom_field(text,text,uuid,uuid,text,text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p5_ci.create_custom_field(text,text,uuid,uuid,text,text,integer) TO p5_ci_runtime;
ALTER FUNCTION p5_ci.write_custom_value(text,text,uuid,uuid,uuid,jsonb,integer) OWNER TO p5_ci_definer;
REVOKE ALL ON FUNCTION p5_ci.write_custom_value(text,text,uuid,uuid,uuid,jsonb,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p5_ci.write_custom_value(text,text,uuid,uuid,uuid,jsonb,integer) TO p5_ci_runtime;
REVOKE CREATE ON SCHEMA p5_ci FROM p5_ci_definer;
REVOKE ALL ON FUNCTION p5_ci.crm_actor(text,text,uuid,boolean,boolean),p5_ci.settings_projection(uuid,jsonb),p5_ci.require_account(text,text,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p5_ci.crm_actor(text,text,uuid,boolean,boolean),p5_ci.settings_projection(uuid,jsonb),p5_ci.require_account(text,text,uuid,uuid) TO p5_ci_definer;
COMMIT;
