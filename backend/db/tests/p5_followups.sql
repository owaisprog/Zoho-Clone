-- Synthetic disposable CI only. No outbound notifications.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' OR current_user<>'demo_ci'
 OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
 OR to_regclass('p5_ci.activities') IS NULL THEN RAISE EXCEPTION 'P5_DISPOSABLE_ONLY'; END IF;
END $$;
CREATE TABLE p5_ci.followups(
 organization_id uuid NOT NULL,activity_id uuid NOT NULL,due_date date NOT NULL CHECK(due_date BETWEEN DATE '2000-01-01' AND DATE '2099-12-31'),
 revision integer NOT NULL DEFAULT 0 CHECK(revision BETWEEN 0 AND 1000000),
 PRIMARY KEY(organization_id,activity_id),
 FOREIGN KEY(organization_id,activity_id) REFERENCES p5_ci.activities(organization_id,id)
);
CREATE INDEX p5_followup_due ON p5_ci.followups(organization_id,due_date,activity_id);
ALTER TABLE p5_ci.followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE p5_ci.followups FORCE ROW LEVEL SECURITY;
ALTER TABLE p5_ci.followups OWNER TO p4_stage_owner;
REVOKE ALL ON p5_ci.followups FROM PUBLIC,p5_ci_runtime;
GRANT SELECT,INSERT ON p5_ci.followups TO p5_ci_definer;
GRANT UPDATE(due_date,revision) ON p5_ci.followups TO p5_ci_definer;
CREATE POLICY followup_read ON p5_ci.followups FOR SELECT TO p5_ci_definer USING(true);
CREATE POLICY followup_insert ON p5_ci.followups FOR INSERT TO p5_ci_definer WITH CHECK(true);
CREATE POLICY followup_update ON p5_ci.followups FOR UPDATE TO p5_ci_definer USING(true) WITH CHECK(true);
CREATE FUNCTION p5_ci.followup_projection(f p5_ci.followups,a p5_ci.activities) RETURNS jsonb LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('activityId',f.activity_id,'dealId',a.deal_id,'title',a.title,'dueDate',to_char(f.due_date,'YYYY-MM-DD'),'revision',f.revision,'completed',a.completed)
$$;
CREATE FUNCTION p5_ci.read_followups(p_issuer text,p_subject text,p_org uuid,p_after uuid,p_due_only boolean) RETURNS jsonb
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 DECLARE who record; result jsonb;
 BEGIN
 IF current_setting('transaction_read_only')<>'on' THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 IF p_due_only IS NULL THEN RAISE EXCEPTION 'P5_INVALID' USING ERRCODE='22023'; END IF;
 SELECT * INTO who FROM p5_ci.actor(p_issuer,p_subject,p_org);
 IF NOT FOUND OR NOT(who.rep OR who.manager) THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 SELECT coalesce(jsonb_agg(s.item ORDER BY s.id),'[]'::jsonb) INTO result
 FROM (SELECT f.activity_id AS id,p5_ci.followup_projection(f,a) AS item FROM p5_ci.followups f
 JOIN p5_ci.activities a ON a.organization_id=f.organization_id AND a.id=f.activity_id
 WHERE f.organization_id=p_org AND (p_after IS NULL OR f.activity_id>p_after)
 AND (NOT p_due_only OR (NOT a.completed AND f.due_date<=(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date))
 AND p5_ci.activity_access(p_issuer,p_subject,p_org,a.deal_id)
 ORDER BY f.activity_id LIMIT 21) s;
 RETURN result;
 END $$;
CREATE FUNCTION p5_ci.write_followup(p_issuer text,p_subject text,p_org uuid,p_activity uuid,p_due text,p_expected integer) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
 DECLARE who record; a p5_ci.activities%ROWTYPE; f p5_ci.followups%ROWTYPE; d date;
 BEGIN
 IF current_setting('transaction_isolation')<>'serializable' THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 SELECT * INTO who FROM p5_ci.actor(p_issuer,p_subject,p_org);
 IF NOT FOUND OR NOT who.rep THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 IF p_activity IS NULL OR substring(p_activity::text from 15 for 1)<>'4' OR substring(p_activity::text from 20 for 1) NOT IN ('8','9','a','b')
 OR p_due IS NULL OR p_due !~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$' OR p_expected IS NULL OR p_expected NOT BETWEEN -1 AND 999999 THEN RAISE EXCEPTION 'P5_INVALID' USING ERRCODE='22023'; END IF;
 BEGIN d:=p_due::date; EXCEPTION WHEN datetime_field_overflow OR invalid_datetime_format THEN RAISE EXCEPTION 'P5_INVALID' USING ERRCODE='22023'; END;
 SELECT * INTO a FROM p5_ci.activities x WHERE x.organization_id=p_org AND x.id=p_activity AND x.actor_id=who.actor_id FOR UPDATE;
 IF NOT FOUND OR NOT p5_ci.activity_access(p_issuer,p_subject,p_org,a.deal_id) THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='P5004'; END IF;
 IF a.kind<>'TASK' OR a.completed THEN RAISE EXCEPTION 'P5_CONFLICT' USING ERRCODE='23505'; END IF;
 SELECT * INTO f FROM p5_ci.followups x WHERE x.organization_id=p_org AND x.activity_id=p_activity FOR UPDATE;
 IF NOT FOUND THEN
 IF p_expected<>-1 THEN RAISE EXCEPTION 'P5_CONFLICT' USING ERRCODE='23505'; END IF;
 INSERT INTO p5_ci.followups(organization_id,activity_id,due_date) VALUES(p_org,p_activity,d) RETURNING * INTO f;
 ELSIF f.revision=p_expected+1 AND f.due_date=d THEN
 NULL;
 ELSIF f.revision=p_expected AND f.due_date<>d THEN
 UPDATE p5_ci.followups SET due_date=d,revision=revision+1 WHERE organization_id=p_org AND activity_id=p_activity RETURNING * INTO f;
 ELSE RAISE EXCEPTION 'P5_CONFLICT' USING ERRCODE='23505';
 END IF;
 RETURN p5_ci.followup_projection(f,a);
 END $$;
GRANT CREATE ON SCHEMA p5_ci TO p5_ci_definer;
ALTER FUNCTION p5_ci.read_followups(text,text,uuid,uuid,boolean) OWNER TO p5_ci_definer;
ALTER FUNCTION p5_ci.write_followup(text,text,uuid,uuid,text,integer) OWNER TO p5_ci_definer;
REVOKE CREATE ON SCHEMA p5_ci FROM p5_ci_definer;
REVOKE ALL ON FUNCTION p5_ci.followup_projection(p5_ci.followups,p5_ci.activities),p5_ci.read_followups(text,text,uuid,uuid,boolean),p5_ci.write_followup(text,text,uuid,uuid,text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p5_ci.followup_projection(p5_ci.followups,p5_ci.activities) TO p5_ci_definer;
GRANT EXECUTE ON FUNCTION p5_ci.read_followups(text,text,uuid,uuid,boolean),p5_ci.write_followup(text,text,uuid,uuid,text,integer) TO p5_ci_runtime;
COMMIT;
