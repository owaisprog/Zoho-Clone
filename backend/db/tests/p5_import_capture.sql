-- P5.03/P5.04: disposable synthetic CI, synchronous bounded import and token capture.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' OR current_user<>'demo_ci'
 OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
 OR to_regclass('p5_ci.merge_audit') IS NULL THEN RAISE EXCEPTION 'P5_DISPOSABLE_ONLY'; END IF;
END $$;
CREATE TABLE p5_ci.import_jobs(
 organization_id uuid NOT NULL,id uuid NOT NULL,actor_id uuid NOT NULL,digest text NOT NULL CHECK(digest ~ '^[a-f0-9]{64}$'),
 row_count integer NOT NULL CHECK(row_count BETWEEN 1 AND 20),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(organization_id,id),FOREIGN KEY(organization_id,actor_id) REFERENCES platform_stage.memberships(organization_id,user_id)
);
CREATE TABLE p5_ci.import_rows(
 organization_id uuid NOT NULL,job_id uuid NOT NULL,row_number integer NOT NULL CHECK(row_number BETWEEN 1 AND 20),
 outcome text NOT NULL CHECK(outcome IN ('CREATED','INVALID','DUPLICATE')),lead_id uuid,
 PRIMARY KEY(organization_id,job_id,row_number),FOREIGN KEY(organization_id,job_id) REFERENCES p5_ci.import_jobs(organization_id,id),
 FOREIGN KEY(organization_id,lead_id) REFERENCES p5_ci.leads(organization_id,id),CHECK((outcome='CREATED')=(lead_id IS NOT NULL))
);
CREATE TABLE p5_ci.webforms(
 organization_id uuid NOT NULL,id uuid NOT NULL,actor_id uuid NOT NULL,issuer text NOT NULL,subject text NOT NULL,
 token_digest text NOT NULL UNIQUE CHECK(token_digest ~ '^[a-f0-9]{64}$'),active boolean NOT NULL DEFAULT true,
 PRIMARY KEY(organization_id,id),FOREIGN KEY(organization_id,actor_id) REFERENCES platform_stage.memberships(organization_id,user_id)
);
CREATE TABLE p5_ci.capture_submissions(
 organization_id uuid NOT NULL,form_id uuid NOT NULL,request_id uuid NOT NULL,digest text NOT NULL CHECK(digest ~ '^[a-f0-9]{64}$'),
 lead_id uuid NOT NULL,consent boolean NOT NULL CHECK(consent),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(organization_id,form_id,request_id),FOREIGN KEY(organization_id,form_id) REFERENCES p5_ci.webforms(organization_id,id),
 FOREIGN KEY(organization_id,lead_id) REFERENCES p5_ci.leads(organization_id,id)
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['import_jobs','import_rows','webforms','capture_submissions'] LOOP
 EXECUTE format('ALTER TABLE p5_ci.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE p5_ci.%I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE p5_ci.%I OWNER TO p4_stage_owner',t);
 EXECUTE format('REVOKE ALL ON p5_ci.%I FROM PUBLIC,p5_ci_runtime',t);
 EXECUTE format('GRANT SELECT ON p5_ci.%I TO p5_ci_definer',t);
 EXECUTE format('CREATE POLICY import_read ON p5_ci.%I FOR SELECT TO p5_ci_definer USING(true)',t);
 IF t<>'webforms' THEN
 EXECUTE format('GRANT INSERT ON p5_ci.%I TO p5_ci_definer',t);
 EXECUTE format('CREATE POLICY import_insert ON p5_ci.%I FOR INSERT TO p5_ci_definer WITH CHECK(true)',t);
 EXECUTE format('CREATE TRIGGER intake_immutable BEFORE UPDATE OR DELETE ON p5_ci.%I FOR EACH ROW EXECUTE FUNCTION platform_stage.grant_audit_immutable()',t);
 END IF;
 END LOOP;
END $$;
CREATE FUNCTION p5_ci.import_projection(p_org uuid,p_job uuid) RETURNS jsonb LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('id',p_job,'rows',coalesce(jsonb_agg(jsonb_build_object('row',r.row_number,'outcome',r.outcome,'leadId',r.lead_id) ORDER BY r.row_number),'[]'::jsonb))
 FROM p5_ci.import_rows r WHERE r.organization_id=p_org AND r.job_id=p_job
$$;
CREATE FUNCTION p5_ci.read_import(p_issuer text,p_subject text,p_org uuid,p_job uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 DECLARE who record;
 BEGIN
 IF current_setting('transaction_read_only')<>'on' THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 SELECT * INTO who FROM p5_ci.actor(p_issuer,p_subject,p_org);
 IF NOT FOUND OR NOT who.rep THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM p5_ci.import_jobs j WHERE j.organization_id=p_org AND j.id=p_job AND j.actor_id=who.actor_id) THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='P5004'; END IF;
 RETURN p5_ci.import_projection(p_org,p_job);
 END $$;
CREATE FUNCTION p5_ci.write_import(p_issuer text,p_subject text,p_org uuid,p_job uuid,p_rows jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
 DECLARE who record; prev p5_ci.import_jobs%ROWTYPE; fingerprint text; item jsonb; i integer:=0; company text; email text; source text; lead uuid; outcome text;
 BEGIN
 IF current_setting('transaction_isolation')<>'serializable' THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 SELECT * INTO who FROM p5_ci.actor(p_issuer,p_subject,p_org);
 IF NOT FOUND OR NOT who.rep THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 IF p_job IS NULL OR substring(p_job::text from 15 for 1)<>'4' OR substring(p_job::text from 20 for 1) NOT IN ('8','9','a','b')
 OR p_rows IS NULL OR jsonb_typeof(p_rows)<>'array' OR octet_length(p_rows::text)>12000 THEN RAISE EXCEPTION 'P5_INVALID' USING ERRCODE='22023'; END IF;
 IF jsonb_array_length(p_rows) NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'P5_INVALID' USING ERRCODE='22023'; END IF;
 fingerprint:=encode(sha256(convert_to(p_rows::text,'UTF8')),'hex');
 SELECT * INTO prev FROM p5_ci.import_jobs j WHERE j.organization_id=p_org AND j.id=p_job;
 IF FOUND THEN
 IF prev.actor_id<>who.actor_id THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='P5004'; END IF;
 IF prev.digest<>fingerprint THEN RAISE EXCEPTION 'P5_CONFLICT' USING ERRCODE='23505'; END IF;
 RETURN p5_ci.import_projection(p_org,p_job);
 END IF;
 INSERT INTO p5_ci.import_jobs(organization_id,id,actor_id,digest,row_count) VALUES(p_org,p_job,who.actor_id,fingerprint,jsonb_array_length(p_rows));
 FOR item IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
 i:=i+1;lead:=NULL;outcome:='INVALID';
 IF jsonb_typeof(item)='array' THEN
 IF jsonb_array_length(item)=3 AND jsonb_typeof(item->0)='string' AND jsonb_typeof(item->1)='string' AND jsonb_typeof(item->2)='string' THEN
 company:=item->>0;email:=item->>1;source:=item->>2;
 IF company ~ '^Demo [A-Za-z][A-Za-z0-9 &.-]{2,48}$' AND email ~ '^[a-z][a-z0-9._-]{1,40}@example[.]com$' AND source IN ('WEBSITE','REFERRAL','EVENT') THEN
 IF EXISTS(SELECT 1 FROM p5_ci.leads l WHERE l.organization_id=p_org AND l.owner_id=who.actor_id AND l.contact_email=email) THEN outcome:='DUPLICATE';
 ELSE
 lead:=gen_random_uuid();
 BEGIN
 PERFORM p5_ci.create_lead(p_issuer,p_subject,p_org,lead,gen_random_uuid(),company,email,source);
 outcome:='CREATED';
 EXCEPTION WHEN unique_violation THEN lead:=NULL;outcome:='DUPLICATE';
 END;
 END IF; END IF; END IF; END IF;
 INSERT INTO p5_ci.import_rows(organization_id,job_id,row_number,outcome,lead_id) VALUES(p_org,p_job,i,outcome,lead);
 END LOOP;
 RETURN p5_ci.import_projection(p_org,p_job);
 END $$;
CREATE FUNCTION p5_ci.capture_lead(p_token text,p_request uuid,p_company text,p_email text,p_consent boolean,p_trap text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
 DECLARE f p5_ci.webforms%ROWTYPE; who record; prev p5_ci.capture_submissions%ROWTYPE; fingerprint text; lead uuid;
 BEGIN
 IF current_setting('transaction_isolation')<>'serializable' THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 IF p_token IS NULL OR p_token !~ '^[a-f0-9]{64}$' OR p_request IS NULL OR substring(p_request::text from 15 for 1)<>'4' OR substring(p_request::text from 20 for 1) NOT IN ('8','9','a','b')
 OR p_company IS NULL OR p_company !~ '^Demo [A-Za-z][A-Za-z0-9 &.-]{2,48}$' OR p_email IS NULL OR p_email !~ '^[a-z][a-z0-9._-]{1,40}@example[.]com$'
 OR p_consent IS DISTINCT FROM true OR p_trap IS DISTINCT FROM '' THEN RAISE EXCEPTION 'P5_INVALID' USING ERRCODE='22023'; END IF;
 SELECT * INTO f FROM p5_ci.webforms WHERE token_digest=encode(sha256(convert_to(p_token,'UTF8')),'hex') AND active;
 IF NOT FOUND THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 SELECT * INTO who FROM p5_ci.actor(f.issuer,f.subject,f.organization_id);
 IF NOT FOUND OR NOT who.rep OR who.actor_id<>f.actor_id THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 fingerprint:=encode(sha256(convert_to(jsonb_build_array(p_company,p_email,p_consent)::text,'UTF8')),'hex');
 SELECT * INTO prev FROM p5_ci.capture_submissions s WHERE s.organization_id=f.organization_id AND s.form_id=f.id AND s.request_id=p_request;
 IF FOUND THEN
 IF prev.digest<>fingerprint THEN RAISE EXCEPTION 'P5_CONFLICT' USING ERRCODE='23505'; END IF;
 RETURN jsonb_build_object('outcome','ACCEPTED');
 END IF;
 IF (SELECT count(*) FROM p5_ci.capture_submissions s WHERE s.organization_id=f.organization_id AND s.form_id=f.id)>=20 THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 lead:=gen_random_uuid();
 PERFORM p5_ci.create_lead(f.issuer,f.subject,f.organization_id,lead,gen_random_uuid(),p_company,p_email,'WEBSITE');
 INSERT INTO p5_ci.capture_submissions(organization_id,form_id,request_id,digest,lead_id,consent) VALUES(f.organization_id,f.id,p_request,fingerprint,lead,true);
 RETURN jsonb_build_object('outcome','ACCEPTED');
 END $$;
GRANT CREATE ON SCHEMA p5_ci TO p5_ci_definer;
ALTER FUNCTION p5_ci.read_import(text,text,uuid,uuid) OWNER TO p5_ci_definer;
ALTER FUNCTION p5_ci.write_import(text,text,uuid,uuid,jsonb) OWNER TO p5_ci_definer;
ALTER FUNCTION p5_ci.capture_lead(text,uuid,text,text,boolean,text) OWNER TO p5_ci_definer;
REVOKE CREATE ON SCHEMA p5_ci FROM p5_ci_definer;
REVOKE ALL ON FUNCTION p5_ci.import_projection(uuid,uuid),p5_ci.read_import(text,text,uuid,uuid),p5_ci.write_import(text,text,uuid,uuid,jsonb),p5_ci.capture_lead(text,uuid,text,text,boolean,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p5_ci.import_projection(uuid,uuid) TO p5_ci_definer;
GRANT EXECUTE ON FUNCTION p5_ci.read_import(text,text,uuid,uuid),p5_ci.write_import(text,text,uuid,uuid,jsonb),p5_ci.capture_lead(text,uuid,text,text,boolean,text) TO p5_ci_runtime;
COMMIT;
