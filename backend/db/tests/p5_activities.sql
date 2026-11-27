-- Disposable synthetic CI only.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' OR current_user<>'demo_ci'
 OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
 OR to_regclass('p5_ci.deals') IS NULL THEN RAISE EXCEPTION 'P5_DISPOSABLE_ONLY'; END IF;
END $$;
CREATE TABLE p5_ci.activities(
 organization_id uuid NOT NULL,id uuid NOT NULL,deal_id uuid NOT NULL,actor_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('NOTE','TASK','CALL','MEETING')),
 title text NOT NULL CHECK(title ~ '^Demo [A-Za-z][A-Za-z0-9 &.-]{2,74}$'),
 completed boolean NOT NULL DEFAULT false, revision integer NOT NULL DEFAULT 0 CHECK(revision BETWEEN 0 AND 1),
 PRIMARY KEY(organization_id,id),
 FOREIGN KEY(organization_id,deal_id) REFERENCES p5_ci.deals(organization_id,id),
 FOREIGN KEY(organization_id,actor_id) REFERENCES platform_stage.memberships(organization_id,user_id),
 CHECK((NOT completed AND revision=0) OR (kind='TASK' AND completed AND revision=1))
);
CREATE INDEX p5_activity_deal ON p5_ci.activities(organization_id,deal_id,id);
ALTER TABLE p5_ci.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE p5_ci.activities FORCE ROW LEVEL SECURITY;
ALTER TABLE p5_ci.activities OWNER TO p4_stage_owner;
REVOKE ALL ON p5_ci.activities FROM PUBLIC,p5_ci_runtime;
GRANT SELECT,INSERT ON p5_ci.activities TO p5_ci_definer;
GRANT UPDATE(completed,revision) ON p5_ci.activities TO p5_ci_definer;
CREATE POLICY activity_read ON p5_ci.activities FOR SELECT TO p5_ci_definer USING(true);
CREATE POLICY activity_insert ON p5_ci.activities FOR INSERT TO p5_ci_definer WITH CHECK(true);
CREATE POLICY activity_update ON p5_ci.activities FOR UPDATE TO p5_ci_definer USING(true) WITH CHECK(true);
CREATE FUNCTION p5_ci.activity_projection(a p5_ci.activities) RETURNS jsonb LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('id',a.id,'dealId',a.deal_id,'kind',a.kind,'title',a.title,'completed',a.completed,'revision',a.revision)
$$;
CREATE FUNCTION p5_ci.activity_access(p_issuer text,p_subject text,p_org uuid,p_deal uuid) RETURNS boolean LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM p5_ci.deals d WHERE d.organization_id=p_org AND d.id=p_deal AND p5_ci.deal_visible(p_issuer,p_subject,p_org,d))
$$;
CREATE FUNCTION p5_ci.read_activities(p_issuer text,p_subject text,p_org uuid,p_deal uuid,p_after uuid) RETURNS jsonb
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 DECLARE who record; result jsonb;
 BEGIN
 IF current_setting('transaction_read_only')<>'on' THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 SELECT * INTO who FROM p5_ci.actor(p_issuer,p_subject,p_org);
 IF NOT FOUND OR NOT(who.rep OR who.manager) THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 IF NOT p5_ci.activity_access(p_issuer,p_subject,p_org,p_deal) THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='P5004'; END IF;
 SELECT coalesce(jsonb_agg(p5_ci.activity_projection(s.row_value) ORDER BY s.id),'[]'::jsonb) INTO result
 FROM (SELECT a AS row_value,a.id FROM p5_ci.activities a WHERE a.organization_id=p_org AND a.deal_id=p_deal AND (p_after IS NULL OR a.id>p_after) ORDER BY a.id LIMIT 21) s;
 RETURN result;
 END $$;
CREATE FUNCTION p5_ci.write_activity(p_issuer text,p_subject text,p_org uuid,p_deal uuid,p_id uuid,p_kind text,p_title text,p_expected integer) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
 DECLARE who record; a p5_ci.activities%ROWTYPE;
 BEGIN
 IF current_setting('transaction_isolation')<>'serializable' THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 SELECT * INTO who FROM p5_ci.actor(p_issuer,p_subject,p_org);
 IF NOT FOUND OR NOT who.rep THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 IF NOT p5_ci.activity_access(p_issuer,p_subject,p_org,p_deal) THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='P5004'; END IF;
 IF p_id IS NULL OR substring(p_id::text from 15 for 1)<>'4' OR substring(p_id::text from 20 for 1) NOT IN ('8','9','a','b') THEN RAISE EXCEPTION 'P5_INVALID' USING ERRCODE='22023'; END IF;
 IF p_expected IS NULL THEN
 IF p_kind IS NULL OR p_kind NOT IN ('NOTE','TASK','CALL','MEETING') OR p_title IS NULL OR p_title !~ '^Demo [A-Za-z][A-Za-z0-9 &.-]{2,74}$' THEN RAISE EXCEPTION 'P5_INVALID' USING ERRCODE='22023'; END IF;
 INSERT INTO p5_ci.activities(organization_id,id,deal_id,actor_id,kind,title) VALUES(p_org,p_id,p_deal,who.actor_id,p_kind,p_title) ON CONFLICT DO NOTHING;
 SELECT * INTO a FROM p5_ci.activities x WHERE x.organization_id=p_org AND x.id=p_id AND x.deal_id=p_deal AND x.actor_id=who.actor_id;
 IF NOT FOUND OR a.kind<>p_kind OR a.title<>p_title THEN RAISE EXCEPTION 'P5_CONFLICT' USING ERRCODE='23505'; END IF;
 ELSE
 IF p_expected<>0 OR p_kind IS NOT NULL OR p_title IS NOT NULL THEN RAISE EXCEPTION 'P5_INVALID' USING ERRCODE='22023'; END IF;
 SELECT * INTO a FROM p5_ci.activities x WHERE x.organization_id=p_org AND x.id=p_id AND x.deal_id=p_deal AND x.actor_id=who.actor_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='P5004'; END IF;
 IF a.kind<>'TASK' OR a.revision<>p_expected THEN RAISE EXCEPTION 'P5_CONFLICT' USING ERRCODE='23505'; END IF;
 UPDATE p5_ci.activities SET completed=true,revision=1 WHERE organization_id=p_org AND id=p_id RETURNING * INTO a;
 END IF;
 RETURN p5_ci.activity_projection(a);
 END $$;
GRANT CREATE ON SCHEMA p5_ci TO p5_ci_definer;
ALTER FUNCTION p5_ci.read_activities(text,text,uuid,uuid,uuid) OWNER TO p5_ci_definer;
ALTER FUNCTION p5_ci.write_activity(text,text,uuid,uuid,uuid,text,text,integer) OWNER TO p5_ci_definer;
REVOKE CREATE ON SCHEMA p5_ci FROM p5_ci_definer;
REVOKE ALL ON FUNCTION p5_ci.activity_projection(p5_ci.activities),p5_ci.activity_access(text,text,uuid,uuid),p5_ci.read_activities(text,text,uuid,uuid,uuid),p5_ci.write_activity(text,text,uuid,uuid,uuid,text,text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p5_ci.activity_projection(p5_ci.activities),p5_ci.activity_access(text,text,uuid,uuid) TO p5_ci_definer;
GRANT EXECUTE ON FUNCTION p5_ci.read_activities(text,text,uuid,uuid,uuid),p5_ci.write_activity(text,text,uuid,uuid,uuid,text,text,integer) TO p5_ci_runtime;
COMMIT;
