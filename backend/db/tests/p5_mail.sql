-- Disposable synthetic CI only; manual records, no delivery or mailbox access.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' OR current_user<>'demo_ci'
 OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
 OR to_regclass('p5_ci.forecast_inputs') IS NULL THEN RAISE EXCEPTION 'P5_DISPOSABLE_ONLY'; END IF;
END $$;
CREATE TABLE p5_ci.email_templates(
 organization_id uuid NOT NULL,id uuid NOT NULL,actor_id uuid NOT NULL,
 subject text NOT NULL CHECK(subject ~ '^Demo [A-Za-z0-9][A-Za-z0-9 &.,!?-]{2,74}$'),
 body text NOT NULL CHECK(body ~ '^Demo [A-Za-z0-9][A-Za-z0-9 &.,!?-]{2,234}$'),
 PRIMARY KEY(organization_id,id),
 FOREIGN KEY(organization_id,actor_id) REFERENCES platform_stage.memberships(organization_id,user_id)
);
CREATE TABLE p5_ci.email_logs(
 organization_id uuid NOT NULL,id uuid NOT NULL,actor_id uuid NOT NULL,deal_id uuid NOT NULL,
 direction text NOT NULL CHECK(direction IN ('INBOUND','OUTBOUND')),
 subject text NOT NULL CHECK(subject ~ '^Demo [A-Za-z0-9][A-Za-z0-9 &.,!?-]{2,74}$'),
 body text NOT NULL CHECK(body ~ '^Demo [A-Za-z0-9][A-Za-z0-9 &.,!?-]{2,234}$'),
 occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(organization_id,id),
 FOREIGN KEY(organization_id,actor_id) REFERENCES platform_stage.memberships(organization_id,user_id),
 FOREIGN KEY(organization_id,deal_id) REFERENCES p5_ci.deals(organization_id,id)
);
CREATE INDEX p5_email_deal ON p5_ci.email_logs(organization_id,deal_id,id);
CREATE INDEX p5_email_template_actor ON p5_ci.email_templates(organization_id,actor_id,id);
ALTER TABLE p5_ci.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE p5_ci.email_templates FORCE ROW LEVEL SECURITY;
ALTER TABLE p5_ci.email_templates OWNER TO p4_stage_owner;
ALTER TABLE p5_ci.email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE p5_ci.email_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE p5_ci.email_logs OWNER TO p4_stage_owner;
REVOKE ALL ON p5_ci.email_templates,p5_ci.email_logs FROM PUBLIC,p5_ci_runtime;
GRANT SELECT,INSERT ON p5_ci.email_templates,p5_ci.email_logs TO p5_ci_definer;
CREATE POLICY template_read ON p5_ci.email_templates FOR SELECT TO p5_ci_definer USING(true);
CREATE POLICY template_insert ON p5_ci.email_templates FOR INSERT TO p5_ci_definer WITH CHECK(true);
CREATE POLICY email_read ON p5_ci.email_logs FOR SELECT TO p5_ci_definer USING(true);
CREATE POLICY email_insert ON p5_ci.email_logs FOR INSERT TO p5_ci_definer WITH CHECK(true);
CREATE TRIGGER p5_email_immutable BEFORE UPDATE OR DELETE ON p5_ci.email_logs FOR EACH ROW EXECUTE FUNCTION platform_stage.grant_audit_immutable();
CREATE FUNCTION p5_ci.template_projection(t p5_ci.email_templates) RETURNS jsonb LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('id',t.id,'subject',t.subject,'body',t.body)
$$;
CREATE FUNCTION p5_ci.email_projection(e p5_ci.email_logs) RETURNS jsonb LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('id',e.id,'dealId',e.deal_id,'subject',e.subject,'body',e.body,'direction',e.direction,'recordedAt',to_char(e.occurred_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
$$;
CREATE FUNCTION p5_ci.read_mail(p_issuer text,p_subject text,p_org uuid,p_deal uuid,p_after uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 DECLARE who record; result jsonb;
 BEGIN
 IF current_setting('transaction_read_only')<>'on' THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 SELECT * INTO who FROM p5_ci.actor(p_issuer,p_subject,p_org);
 IF NOT FOUND OR NOT(who.rep OR who.manager) THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 IF p_deal IS NULL THEN
 SELECT coalesce(jsonb_agg(s.item ORDER BY s.id),'[]'::jsonb) INTO result FROM
 (SELECT t.id,p5_ci.template_projection(t) AS item FROM p5_ci.email_templates t WHERE t.organization_id=p_org AND t.actor_id=who.actor_id AND (p_after IS NULL OR t.id>p_after) ORDER BY t.id LIMIT 11) s;
 ELSE
 IF NOT p5_ci.activity_access(p_issuer,p_subject,p_org,p_deal) THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='P5004'; END IF;
 SELECT coalesce(jsonb_agg(s.item ORDER BY s.id),'[]'::jsonb) INTO result FROM
 (SELECT e.id,p5_ci.email_projection(e) AS item FROM p5_ci.email_logs e WHERE e.organization_id=p_org AND e.deal_id=p_deal AND (p_after IS NULL OR e.id>p_after) ORDER BY e.id LIMIT 11) s;
 END IF;
 RETURN result;
 END $$;
CREATE FUNCTION p5_ci.write_mail(p_issuer text,p_identity text,p_org uuid,p_deal uuid,p_id uuid,p_direction text,p_subject text,p_body text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
 DECLARE who record; t p5_ci.email_templates%ROWTYPE; e p5_ci.email_logs%ROWTYPE;
 BEGIN
 IF current_setting('transaction_isolation')<>'serializable' THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 SELECT * INTO who FROM p5_ci.actor(p_issuer,p_identity,p_org);
 IF NOT FOUND OR NOT who.rep THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 IF p_id IS NULL OR substring(p_id::text from 15 for 1)<>'4' OR substring(p_id::text from 20 for 1) NOT IN ('8','9','a','b')
 OR p_subject IS NULL OR p_subject !~ '^Demo [A-Za-z0-9][A-Za-z0-9 &.,!?-]{2,74}$'
 OR p_body IS NULL OR p_body !~ '^Demo [A-Za-z0-9][A-Za-z0-9 &.,!?-]{2,234}$'
 OR (p_deal IS NULL AND p_direction IS NOT NULL) OR (p_deal IS NOT NULL AND (p_direction IS NULL OR p_direction NOT IN ('INBOUND','OUTBOUND'))) THEN RAISE EXCEPTION 'P5_INVALID' USING ERRCODE='22023'; END IF;
 IF p_deal IS NULL THEN
 INSERT INTO p5_ci.email_templates(organization_id,id,actor_id,subject,body) VALUES(p_org,p_id,who.actor_id,p_subject,p_body) ON CONFLICT DO NOTHING;
 SELECT * INTO t FROM p5_ci.email_templates x WHERE x.organization_id=p_org AND x.id=p_id AND x.actor_id=who.actor_id;
 IF NOT FOUND OR (t.subject,t.body) IS DISTINCT FROM (p_subject,p_body) THEN RAISE EXCEPTION 'P5_CONFLICT' USING ERRCODE='23505'; END IF;
 RETURN p5_ci.template_projection(t);
 END IF;
 IF NOT p5_ci.activity_access(p_issuer,p_identity,p_org,p_deal) THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='P5004'; END IF;
 INSERT INTO p5_ci.email_logs(organization_id,id,actor_id,deal_id,direction,subject,body) VALUES(p_org,p_id,who.actor_id,p_deal,p_direction,p_subject,p_body) ON CONFLICT DO NOTHING;
 SELECT * INTO e FROM p5_ci.email_logs x WHERE x.organization_id=p_org AND x.id=p_id AND x.actor_id=who.actor_id AND x.deal_id=p_deal;
 IF NOT FOUND OR (e.direction,e.subject,e.body) IS DISTINCT FROM (p_direction,p_subject,p_body) THEN RAISE EXCEPTION 'P5_CONFLICT' USING ERRCODE='23505'; END IF;
 RETURN p5_ci.email_projection(e);
 END $$;
GRANT CREATE ON SCHEMA p5_ci TO p5_ci_definer;
ALTER FUNCTION p5_ci.read_mail(text,text,uuid,uuid,uuid) OWNER TO p5_ci_definer;
ALTER FUNCTION p5_ci.write_mail(text,text,uuid,uuid,uuid,text,text,text) OWNER TO p5_ci_definer;
REVOKE CREATE ON SCHEMA p5_ci FROM p5_ci_definer;
REVOKE ALL ON FUNCTION p5_ci.template_projection(p5_ci.email_templates),p5_ci.email_projection(p5_ci.email_logs),p5_ci.read_mail(text,text,uuid,uuid,uuid),p5_ci.write_mail(text,text,uuid,uuid,uuid,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p5_ci.template_projection(p5_ci.email_templates),p5_ci.email_projection(p5_ci.email_logs) TO p5_ci_definer;
GRANT EXECUTE ON FUNCTION p5_ci.read_mail(text,text,uuid,uuid,uuid),p5_ci.write_mail(text,text,uuid,uuid,uuid,text,text,text) TO p5_ci_runtime;
COMMIT;
