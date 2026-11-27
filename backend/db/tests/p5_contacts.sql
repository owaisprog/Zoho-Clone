-- Synthetic CI only. Contact associations share the current P5 account scope.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' OR current_user<>'demo_ci'
 OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
 OR to_regclass('p5_ci.accounts') IS NULL THEN RAISE EXCEPTION 'P5_DISPOSABLE_ONLY'; END IF;
END $$;
CREATE TABLE p5_ci.contacts(
 organization_id uuid NOT NULL,id uuid NOT NULL,owner_id uuid NOT NULL,team_id uuid,account_id uuid,
 display_name text NOT NULL CHECK(display_name ~ '^Demo [A-Za-z][A-Za-z0-9 .-]{2,74}$'),
 email text NOT NULL CHECK(email ~ '^[a-z][a-z0-9._-]{1,40}@example[.]com$'),
 revision integer NOT NULL DEFAULT 0 CHECK(revision BETWEEN 0 AND 1000000),
 PRIMARY KEY(organization_id,id),
 FOREIGN KEY(organization_id,owner_id) REFERENCES platform_stage.memberships(organization_id,user_id),
 FOREIGN KEY(organization_id,team_id) REFERENCES platform_stage.teams(organization_id,id),
 FOREIGN KEY(organization_id,account_id) REFERENCES p5_ci.accounts(organization_id,id)
);
CREATE TABLE p5_ci.contact_events(
 organization_id uuid NOT NULL,request_id uuid NOT NULL,contact_id uuid NOT NULL,actor_id uuid NOT NULL,
 action text NOT NULL CHECK(action IN ('CREATED','EDITED')),revision integer NOT NULL,
 digest text NOT NULL CHECK(digest ~ '^[a-f0-9]{64}$'),occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(organization_id,request_id),UNIQUE(organization_id,contact_id,revision),
 FOREIGN KEY(organization_id,contact_id) REFERENCES p5_ci.contacts(organization_id,id),
 FOREIGN KEY(organization_id,actor_id) REFERENCES platform_stage.memberships(organization_id,user_id),
 CHECK((action='CREATED' AND revision=0) OR (action='EDITED' AND revision BETWEEN 1 AND 1000000))
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['contacts','contact_events'] LOOP
  EXECUTE format('ALTER TABLE p5_ci.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE p5_ci.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE p5_ci.%I OWNER TO p4_stage_owner',t);
  EXECUTE format('REVOKE ALL ON p5_ci.%I FROM PUBLIC,p5_ci_runtime',t);
  EXECUTE format('GRANT SELECT,INSERT ON p5_ci.%I TO p5_ci_definer',t);
  EXECUTE format('CREATE POLICY p5_contact_read ON p5_ci.%I FOR SELECT TO p5_ci_definer USING(true)',t);
  EXECUTE format('CREATE POLICY p5_contact_insert ON p5_ci.%I FOR INSERT TO p5_ci_definer WITH CHECK(true)',t);
 END LOOP;
END $$;
GRANT UPDATE(display_name,email,account_id,revision) ON p5_ci.contacts TO p5_ci_definer;
CREATE POLICY p5_contact_update ON p5_ci.contacts FOR UPDATE TO p5_ci_definer USING(true) WITH CHECK(true);
CREATE TRIGGER p5_contact_event_immutable BEFORE UPDATE OR DELETE ON p5_ci.contact_events FOR EACH ROW EXECUTE FUNCTION platform_stage.grant_audit_immutable();
CREATE FUNCTION p5_ci.account_visible(p_issuer text,p_subject text,p_org uuid,p_account uuid)
 RETURNS boolean LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT p_account IS NULL OR EXISTS(
 SELECT 1 FROM p5_ci.accounts a CROSS JOIN p5_ci.actor(p_issuer,p_subject,p_org) w
 WHERE a.organization_id=p_org AND a.id=p_account AND (w.rep OR w.manager)
 AND ((w.rep AND a.owner_id=w.actor_id) OR (a.team_id IS NOT NULL AND platform_stage.team_membership_check(p_issuer,p_subject,p_org,a.team_id))))
 $$;
CREATE FUNCTION p5_ci.contact_projection(c p5_ci.contacts) RETURNS jsonb LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('id',c.id,'displayName',c.display_name,'email',c.email,'accountId',c.account_id,'revision',c.revision)
 $$;
CREATE FUNCTION p5_ci.read_contacts(p_issuer text,p_subject text,p_org uuid,p_after uuid,p_id uuid,p_search text,p_exact boolean)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 DECLARE who record; result jsonb;
 BEGIN
 IF current_setting('transaction_read_only')<>'on' THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 IF p_search IS NULL OR p_search !~ '^[A-Za-z0-9 .@_-]{0,80}$' OR p_exact IS NULL OR (p_id IS NOT NULL AND p_after IS NOT NULL) THEN RAISE EXCEPTION 'P5_INVALID' USING ERRCODE='22023'; END IF;
 SELECT * INTO who FROM p5_ci.actor(p_issuer,p_subject,p_org);
 IF NOT FOUND OR NOT(who.rep OR who.manager) THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 SELECT coalesce(jsonb_agg(p5_ci.contact_projection(s.row_value) ORDER BY s.id),'[]'::jsonb) INTO result FROM
 (SELECT c AS row_value,c.id FROM p5_ci.contacts c WHERE c.organization_id=p_org AND (p_after IS NULL OR c.id>p_after) AND (p_id IS NULL OR c.id=p_id)
 AND (CASE WHEN p_exact THEN lower(c.display_name)=lower(p_search) OR c.email=lower(p_search) ELSE strpos(lower(c.display_name),lower(p_search))>0 OR strpos(c.email,lower(p_search))>0 OR p_search='' END)
 AND ((who.rep AND c.owner_id=who.actor_id) OR (c.team_id IS NOT NULL AND platform_stage.team_membership_check(p_issuer,p_subject,p_org,c.team_id)))
 AND p5_ci.account_visible(p_issuer,p_subject,p_org,c.account_id)
 ORDER BY c.id LIMIT 21) s;
 IF p_id IS NOT NULL THEN RETURN result->0; END IF; RETURN result;
 END $$;
CREATE FUNCTION p5_ci.write_contact(p_issuer text,p_subject text,p_org uuid,p_id uuid,p_request uuid,p_expected integer,p_name text,p_email text,p_account uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
 DECLARE who record; c p5_ci.contacts%ROWTYPE; ev p5_ci.contact_events%ROWTYPE; fingerprint text; operation text;
 BEGIN
 IF current_setting('transaction_isolation')<>'serializable' THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 SELECT * INTO who FROM p5_ci.actor(p_issuer,p_subject,p_org);
 IF NOT FOUND OR NOT(who.rep OR who.manager) OR (p_expected IS NULL AND NOT who.rep) THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 IF p_id IS NULL OR p_request IS NULL OR substring(p_id::text from 15 for 1)<>'4' OR substring(p_id::text from 20 for 1) NOT IN ('8','9','a','b')
 OR substring(p_request::text from 15 for 1)<>'4' OR substring(p_request::text from 20 for 1) NOT IN ('8','9','a','b')
 OR (p_expected IS NOT NULL AND (p_expected<0 OR p_expected>=1000000))
 OR p_name IS NULL OR p_name !~ '^Demo [A-Za-z][A-Za-z0-9 .-]{2,74}$' OR p_email IS NULL OR p_email !~ '^[a-z][a-z0-9._-]{1,40}@example[.]com$' THEN RAISE EXCEPTION 'P5_INVALID' USING ERRCODE='22023'; END IF;
 IF NOT p5_ci.account_visible(p_issuer,p_subject,p_org,p_account) THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='P5004'; END IF;
 operation:=CASE WHEN p_expected IS NULL THEN 'CREATED' ELSE 'EDITED' END;
 fingerprint:=encode(sha256(convert_to(jsonb_build_array(p_id,p_expected,p_name,p_email,p_account)::text,'UTF8')),'hex');
 SELECT * INTO ev FROM p5_ci.contact_events WHERE organization_id=p_org AND request_id=p_request;
 IF FOUND THEN
  IF ev.actor_id<>who.actor_id OR ev.contact_id<>p_id OR ev.action<>operation OR ev.digest<>fingerprint THEN RAISE EXCEPTION 'P5_CONFLICT' USING ERRCODE='23505'; END IF;
  SELECT * INTO c FROM p5_ci.contacts x WHERE x.organization_id=p_org AND x.id=p_id AND ((who.rep AND x.owner_id=who.actor_id) OR (x.team_id IS NOT NULL AND platform_stage.team_membership_check(p_issuer,p_subject,p_org,x.team_id))) AND p5_ci.account_visible(p_issuer,p_subject,p_org,x.account_id);
  IF NOT FOUND THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='P5004'; END IF;
  RETURN jsonb_build_object('outcome','replay','record',p5_ci.contact_projection(c));
 END IF;
 IF p_expected IS NULL THEN
  INSERT INTO p5_ci.contacts(organization_id,id,owner_id,display_name,email,account_id) VALUES(p_org,p_id,who.actor_id,p_name,p_email,p_account) RETURNING * INTO c;
 ELSE
  SELECT * INTO c FROM p5_ci.contacts x WHERE x.organization_id=p_org AND x.id=p_id AND ((who.rep AND x.owner_id=who.actor_id) OR (x.team_id IS NOT NULL AND platform_stage.team_membership_check(p_issuer,p_subject,p_org,x.team_id))) AND p5_ci.account_visible(p_issuer,p_subject,p_org,x.account_id) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='P5004'; END IF;
  IF c.revision<>p_expected OR (c.display_name,c.email,c.account_id) IS NOT DISTINCT FROM (p_name,p_email,p_account) THEN RAISE EXCEPTION 'P5_CONFLICT' USING ERRCODE='23505'; END IF;
  UPDATE p5_ci.contacts SET display_name=p_name,email=p_email,account_id=p_account,revision=revision+1 WHERE organization_id=p_org AND id=p_id RETURNING * INTO c;
 END IF;
 INSERT INTO p5_ci.contact_events(organization_id,request_id,contact_id,actor_id,action,revision,digest) VALUES(p_org,p_request,p_id,who.actor_id,operation,c.revision,fingerprint);
 RETURN jsonb_build_object('outcome',CASE WHEN p_expected IS NULL THEN 'created' ELSE 'applied' END,'record',p5_ci.contact_projection(c));
 END $$;
GRANT CREATE ON SCHEMA p5_ci TO p5_ci_definer;
ALTER FUNCTION p5_ci.read_contacts(text,text,uuid,uuid,uuid,text,boolean) OWNER TO p5_ci_definer;
ALTER FUNCTION p5_ci.write_contact(text,text,uuid,uuid,uuid,integer,text,text,uuid) OWNER TO p5_ci_definer;
REVOKE CREATE ON SCHEMA p5_ci FROM p5_ci_definer;
REVOKE ALL ON FUNCTION p5_ci.account_visible(text,text,uuid,uuid),p5_ci.contact_projection(p5_ci.contacts),p5_ci.read_contacts(text,text,uuid,uuid,uuid,text,boolean),p5_ci.write_contact(text,text,uuid,uuid,uuid,integer,text,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p5_ci.account_visible(text,text,uuid,uuid),p5_ci.contact_projection(p5_ci.contacts) TO p5_ci_definer;
GRANT EXECUTE ON FUNCTION p5_ci.read_contacts(text,text,uuid,uuid,uuid,text,boolean),p5_ci.write_contact(text,text,uuid,uuid,uuid,integer,text,text,uuid) TO p5_ci_runtime;
COMMIT;
