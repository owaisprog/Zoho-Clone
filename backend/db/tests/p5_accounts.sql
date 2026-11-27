-- Synthetic CI only. Account records share the P5 lead tenant and permission foundation.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' OR current_user<>'demo_ci'
 OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
 OR to_regclass('p5_ci.leads') IS NULL THEN RAISE EXCEPTION 'P5_DISPOSABLE_ONLY'; END IF;
END $$;
CREATE TABLE p5_ci.accounts(
 organization_id uuid NOT NULL,id uuid NOT NULL,owner_id uuid NOT NULL,team_id uuid,
 name text NOT NULL CHECK(name ~ '^Demo [A-Za-z][A-Za-z0-9 &.-]{2,74}$'),
 industry text NOT NULL CHECK(industry IN ('SERVICES','RETAIL','TECHNOLOGY','OTHER')),
 revision integer NOT NULL DEFAULT 0 CHECK(revision BETWEEN 0 AND 1000000),
 PRIMARY KEY(organization_id,id),
 FOREIGN KEY(organization_id,owner_id) REFERENCES platform_stage.memberships(organization_id,user_id),
 FOREIGN KEY(organization_id,team_id) REFERENCES platform_stage.teams(organization_id,id)
);
CREATE TABLE p5_ci.account_events(
 organization_id uuid NOT NULL,request_id uuid NOT NULL,account_id uuid NOT NULL,actor_id uuid NOT NULL,
 action text NOT NULL CHECK(action IN ('CREATED','EDITED')),revision integer NOT NULL,
 digest text NOT NULL CHECK(digest ~ '^[a-f0-9]{64}$'),occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(organization_id,request_id),UNIQUE(organization_id,account_id,revision),
 FOREIGN KEY(organization_id,account_id) REFERENCES p5_ci.accounts(organization_id,id),
 FOREIGN KEY(organization_id,actor_id) REFERENCES platform_stage.memberships(organization_id,user_id),
 CHECK((action='CREATED' AND revision=0) OR (action='EDITED' AND revision BETWEEN 1 AND 1000000))
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['accounts','account_events'] LOOP
  EXECUTE format('ALTER TABLE p5_ci.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE p5_ci.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE p5_ci.%I OWNER TO p4_stage_owner',t);
  EXECUTE format('REVOKE ALL ON p5_ci.%I FROM PUBLIC,p5_ci_runtime',t);
  EXECUTE format('GRANT SELECT,INSERT ON p5_ci.%I TO p5_ci_definer',t);
  EXECUTE format('CREATE POLICY p5_account_read ON p5_ci.%I FOR SELECT TO p5_ci_definer USING(true)',t);
  EXECUTE format('CREATE POLICY p5_account_insert ON p5_ci.%I FOR INSERT TO p5_ci_definer WITH CHECK(true)',t);
 END LOOP;
END $$;
GRANT UPDATE(name,industry,revision) ON p5_ci.accounts TO p5_ci_definer;
CREATE POLICY p5_account_update ON p5_ci.accounts FOR UPDATE TO p5_ci_definer USING(true) WITH CHECK(true);
CREATE TRIGGER p5_account_event_immutable BEFORE UPDATE OR DELETE ON p5_ci.account_events FOR EACH ROW EXECUTE FUNCTION platform_stage.grant_audit_immutable();
CREATE FUNCTION p5_ci.account_projection(a p5_ci.accounts) RETURNS jsonb LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('id',a.id,'name',a.name,'industry',a.industry,'revision',a.revision)
 $$;
CREATE FUNCTION p5_ci.read_accounts(p_issuer text,p_subject text,p_org uuid,p_after uuid,p_id uuid,p_search text,p_exact boolean)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 DECLARE who record; result jsonb;
 BEGIN
 IF current_setting('transaction_read_only')<>'on' THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 IF p_search IS NULL OR p_search !~ '^[A-Za-z0-9 &.-]{0,80}$' OR p_exact IS NULL OR (p_id IS NOT NULL AND p_after IS NOT NULL) THEN RAISE EXCEPTION 'P5_INVALID' USING ERRCODE='22023'; END IF;
 SELECT * INTO who FROM p5_ci.actor(p_issuer,p_subject,p_org);
 IF NOT FOUND OR NOT(who.rep OR who.manager) THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 SELECT coalesce(jsonb_agg(p5_ci.account_projection(s.row_value) ORDER BY s.id),'[]'::jsonb) INTO result FROM
 (SELECT a AS row_value,a.id FROM p5_ci.accounts a WHERE a.organization_id=p_org AND (p_after IS NULL OR a.id>p_after) AND (p_id IS NULL OR a.id=p_id)
 AND (CASE WHEN p_exact THEN lower(a.name)=lower(p_search) ELSE strpos(lower(a.name),lower(p_search))>0 OR p_search='' END)
 AND ((who.rep AND a.owner_id=who.actor_id) OR (a.team_id IS NOT NULL AND platform_stage.team_membership_check(p_issuer,p_subject,p_org,a.team_id)))
 ORDER BY a.id LIMIT 21) s;
 IF p_id IS NOT NULL THEN RETURN result->0; END IF; RETURN result;
 END $$;
CREATE FUNCTION p5_ci.write_account(p_issuer text,p_subject text,p_org uuid,p_id uuid,p_request uuid,p_expected integer,p_name text,p_industry text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
 DECLARE who record; a p5_ci.accounts%ROWTYPE; ev p5_ci.account_events%ROWTYPE; fingerprint text; action text;
 BEGIN
 IF current_setting('transaction_isolation')<>'serializable' THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 SELECT * INTO who FROM p5_ci.actor(p_issuer,p_subject,p_org);
 IF NOT FOUND OR NOT(who.rep OR who.manager) OR (p_expected IS NULL AND NOT who.rep) THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 IF p_id IS NULL OR p_request IS NULL OR substring(p_id::text from 15 for 1)<>'4' OR substring(p_id::text from 20 for 1) NOT IN ('8','9','a','b')
 OR substring(p_request::text from 15 for 1)<>'4' OR substring(p_request::text from 20 for 1) NOT IN ('8','9','a','b')
 OR (p_expected IS NOT NULL AND (p_expected<0 OR p_expected>=1000000))
 OR p_name IS NULL OR p_name !~ '^Demo [A-Za-z][A-Za-z0-9 &.-]{2,74}$' OR p_industry IS NULL OR p_industry NOT IN ('SERVICES','RETAIL','TECHNOLOGY','OTHER') THEN RAISE EXCEPTION 'P5_INVALID' USING ERRCODE='22023'; END IF;
 action:=CASE WHEN p_expected IS NULL THEN 'CREATED' ELSE 'EDITED' END;
 fingerprint:=encode(sha256(convert_to(jsonb_build_array(p_id,p_expected,p_name,p_industry)::text,'UTF8')),'hex');
 SELECT * INTO ev FROM p5_ci.account_events WHERE organization_id=p_org AND request_id=p_request;
 IF FOUND THEN
  IF ev.actor_id<>who.actor_id OR ev.account_id<>p_id OR ev.action<>action OR ev.digest<>fingerprint THEN RAISE EXCEPTION 'P5_CONFLICT' USING ERRCODE='23505'; END IF;
  SELECT * INTO a FROM p5_ci.accounts x WHERE x.organization_id=p_org AND x.id=p_id AND ((who.rep AND x.owner_id=who.actor_id) OR (x.team_id IS NOT NULL AND platform_stage.team_membership_check(p_issuer,p_subject,p_org,x.team_id)));
  IF NOT FOUND THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='P5004'; END IF;
  RETURN jsonb_build_object('outcome','replay','record',p5_ci.account_projection(a));
 END IF;
 IF p_expected IS NULL THEN
  INSERT INTO p5_ci.accounts(organization_id,id,owner_id,name,industry) VALUES(p_org,p_id,who.actor_id,p_name,p_industry) RETURNING * INTO a;
 ELSE
  SELECT * INTO a FROM p5_ci.accounts x WHERE x.organization_id=p_org AND x.id=p_id AND ((who.rep AND x.owner_id=who.actor_id) OR (x.team_id IS NOT NULL AND platform_stage.team_membership_check(p_issuer,p_subject,p_org,x.team_id))) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='P5004'; END IF;
  IF a.revision<>p_expected OR (a.name,a.industry)=(p_name,p_industry) THEN RAISE EXCEPTION 'P5_CONFLICT' USING ERRCODE='23505'; END IF;
  UPDATE p5_ci.accounts SET name=p_name,industry=p_industry,revision=revision+1 WHERE organization_id=p_org AND id=p_id RETURNING * INTO a;
 END IF;
 INSERT INTO p5_ci.account_events(organization_id,request_id,account_id,actor_id,action,revision,digest) VALUES(p_org,p_request,p_id,who.actor_id,action,a.revision,fingerprint);
 RETURN jsonb_build_object('outcome',CASE WHEN p_expected IS NULL THEN 'created' ELSE 'applied' END,'record',p5_ci.account_projection(a));
 END $$;
GRANT CREATE ON SCHEMA p5_ci TO p5_ci_definer;
ALTER FUNCTION p5_ci.read_accounts(text,text,uuid,uuid,uuid,text,boolean) OWNER TO p5_ci_definer;
ALTER FUNCTION p5_ci.write_account(text,text,uuid,uuid,uuid,integer,text,text) OWNER TO p5_ci_definer;
REVOKE CREATE ON SCHEMA p5_ci FROM p5_ci_definer;
REVOKE ALL ON FUNCTION p5_ci.account_projection(p5_ci.accounts),p5_ci.read_accounts(text,text,uuid,uuid,uuid,text,boolean),p5_ci.write_account(text,text,uuid,uuid,uuid,integer,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p5_ci.account_projection(p5_ci.accounts) TO p5_ci_definer;
GRANT EXECUTE ON FUNCTION p5_ci.read_accounts(text,text,uuid,uuid,uuid,text,boolean),p5_ci.write_account(text,text,uuid,uuid,uuid,integer,text,text) TO p5_ci_runtime;
COMMIT;
