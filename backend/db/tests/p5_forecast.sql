-- Synthetic disposable CI only. USD cents; UTC dates; no actual revenue recognition.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' OR current_user<>'demo_ci'
 OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
 OR to_regclass('p5_ci.followups') IS NULL THEN RAISE EXCEPTION 'P5_DISPOSABLE_ONLY'; END IF;
END $$;
CREATE TABLE p5_ci.forecast_inputs(
 organization_id uuid NOT NULL,deal_id uuid NOT NULL,expected_close date NOT NULL CHECK(expected_close BETWEEN DATE '2000-01-01' AND DATE '2099-12-31'),
 probability_bp integer NOT NULL CHECK(probability_bp BETWEEN 0 AND 10000),
 revision integer NOT NULL DEFAULT 0 CHECK(revision BETWEEN 0 AND 1000000),
 PRIMARY KEY(organization_id,deal_id),FOREIGN KEY(organization_id,deal_id) REFERENCES p5_ci.deals(organization_id,id)
);
CREATE INDEX p5_forecast_date ON p5_ci.forecast_inputs(organization_id,expected_close,deal_id);
ALTER TABLE p5_ci.forecast_inputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE p5_ci.forecast_inputs FORCE ROW LEVEL SECURITY;
ALTER TABLE p5_ci.forecast_inputs OWNER TO p4_stage_owner;
REVOKE ALL ON p5_ci.forecast_inputs FROM PUBLIC,p5_ci_runtime;
GRANT SELECT,INSERT ON p5_ci.forecast_inputs TO p5_ci_definer;
GRANT UPDATE(expected_close,probability_bp,revision) ON p5_ci.forecast_inputs TO p5_ci_definer;
CREATE POLICY forecast_read ON p5_ci.forecast_inputs FOR SELECT TO p5_ci_definer USING(true);
CREATE POLICY forecast_insert ON p5_ci.forecast_inputs FOR INSERT TO p5_ci_definer WITH CHECK(true);
CREATE POLICY forecast_update ON p5_ci.forecast_inputs FOR UPDATE TO p5_ci_definer USING(true) WITH CHECK(true);
CREATE FUNCTION p5_ci.forecast_projection(f p5_ci.forecast_inputs) RETURNS jsonb LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('dealId',f.deal_id,'expectedClose',to_char(f.expected_close,'YYYY-MM-DD'),'probabilityBp',f.probability_bp,'revision',f.revision)
$$;
CREATE FUNCTION p5_ci.read_forecast(p_issuer text,p_subject text,p_org uuid,p_deal uuid) RETURNS jsonb
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 DECLARE who record; result jsonb;
 BEGIN
 IF current_setting('transaction_read_only')<>'on' THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 SELECT * INTO who FROM p5_ci.actor(p_issuer,p_subject,p_org);
 IF NOT FOUND OR NOT(who.rep OR who.manager) THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 IF NOT p5_ci.activity_access(p_issuer,p_subject,p_org,p_deal) THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='P5004'; END IF;
 SELECT p5_ci.forecast_projection(f) INTO result FROM p5_ci.forecast_inputs f WHERE f.organization_id=p_org AND f.deal_id=p_deal;
 RETURN result;
 END $$;
CREATE FUNCTION p5_ci.write_forecast(p_issuer text,p_subject text,p_org uuid,p_deal uuid,p_close text,p_bp integer,p_expected integer) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
 DECLARE who record; d p5_ci.deals%ROWTYPE; f p5_ci.forecast_inputs%ROWTYPE; close_date date;
 BEGIN
 IF current_setting('transaction_isolation')<>'serializable' THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 SELECT * INTO who FROM p5_ci.actor(p_issuer,p_subject,p_org);
 IF NOT FOUND OR NOT who.rep THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 IF p_close IS NULL OR p_close !~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$' OR p_bp IS NULL OR p_bp NOT BETWEEN 0 AND 10000 OR p_expected IS NULL OR p_expected NOT BETWEEN -1 AND 999999 THEN RAISE EXCEPTION 'P5_INVALID' USING ERRCODE='22023'; END IF;
 BEGIN close_date:=p_close::date; EXCEPTION WHEN datetime_field_overflow OR invalid_datetime_format THEN RAISE EXCEPTION 'P5_INVALID' USING ERRCODE='22023'; END;
 SELECT * INTO d FROM p5_ci.deals x WHERE x.organization_id=p_org AND x.id=p_deal AND x.owner_id=who.actor_id AND p5_ci.deal_visible(p_issuer,p_subject,p_org,x) FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='P5004'; END IF;
 IF d.stage IN ('WON','LOST') THEN RAISE EXCEPTION 'P5_CONFLICT' USING ERRCODE='23505'; END IF;
 SELECT * INTO f FROM p5_ci.forecast_inputs x WHERE x.organization_id=p_org AND x.deal_id=p_deal FOR UPDATE;
 IF NOT FOUND THEN
 IF p_expected<>-1 THEN RAISE EXCEPTION 'P5_CONFLICT' USING ERRCODE='23505'; END IF;
 INSERT INTO p5_ci.forecast_inputs(organization_id,deal_id,expected_close,probability_bp) VALUES(p_org,p_deal,close_date,p_bp) RETURNING * INTO f;
 ELSIF f.revision=p_expected+1 AND (f.expected_close,f.probability_bp)=(close_date,p_bp) THEN NULL;
 ELSIF f.revision=p_expected AND (f.expected_close,f.probability_bp) IS DISTINCT FROM (close_date,p_bp) THEN
 UPDATE p5_ci.forecast_inputs SET expected_close=close_date,probability_bp=p_bp,revision=revision+1 WHERE organization_id=p_org AND deal_id=p_deal RETURNING * INTO f;
 ELSE RAISE EXCEPTION 'P5_CONFLICT' USING ERRCODE='23505';
 END IF;
 RETURN p5_ci.forecast_projection(f);
 END $$;
CREATE FUNCTION p5_ci.sales_report(p_issuer text,p_subject text,p_org uuid,p_pipeline uuid,p_from text,p_to text) RETURNS jsonb
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 DECLARE who record; p p5_ci.pipelines%ROWTYPE; start_date date; end_date date; result jsonb;
 BEGIN
 IF current_setting('transaction_read_only')<>'on' THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 IF p_from IS NULL OR p_to IS NULL OR p_from !~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$' OR p_to !~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$' THEN RAISE EXCEPTION 'P5_INVALID' USING ERRCODE='22023'; END IF;
 BEGIN start_date:=p_from::date;end_date:=p_to::date; EXCEPTION WHEN datetime_field_overflow OR invalid_datetime_format THEN RAISE EXCEPTION 'P5_INVALID' USING ERRCODE='22023'; END;
 IF end_date<start_date OR end_date-start_date>366 THEN RAISE EXCEPTION 'P5_INVALID' USING ERRCODE='22023'; END IF;
 SELECT * INTO who FROM p5_ci.actor(p_issuer,p_subject,p_org);
 IF NOT FOUND OR NOT(who.rep OR who.manager) THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 SELECT * INTO p FROM p5_ci.pipelines x WHERE x.organization_id=p_org AND x.id=p_pipeline;
 IF NOT FOUND THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='P5004'; END IF;
 WITH visible AS MATERIALIZED (
 SELECT d.id,d.stage,d.value_cents,f.expected_close,f.probability_bp,
 (SELECT (e.occurred_at AT TIME ZONE 'UTC')::date FROM p5_ci.deal_events e WHERE e.organization_id=p_org AND e.deal_id=d.id AND e.action='STAGE_CHANGED' AND e.next_stage IN ('WON','LOST') ORDER BY e.revision DESC LIMIT 1) AS closed_on
 FROM p5_ci.deals d LEFT JOIN p5_ci.forecast_inputs f ON f.organization_id=d.organization_id AND f.deal_id=d.id
 WHERE d.organization_id=p_org AND d.pipeline_id=p_pipeline AND p5_ci.deal_visible(p_issuer,p_subject,p_org,d)
 ), totals AS (
 SELECT stage,count(*) AS n,sum(value_cents) AS amount,
 count(*) FILTER(WHERE stage NOT IN ('WON','LOST') AND expected_close IS NULL) AS missing,
 count(*) FILTER(WHERE stage NOT IN ('WON','LOST') AND expected_close BETWEEN start_date AND end_date) AS scheduled,
 coalesce(sum(round(value_cents::numeric*probability_bp/10000)) FILTER(WHERE stage NOT IN ('WON','LOST') AND expected_close BETWEEN start_date AND end_date),0) AS weighted,
 count(*) FILTER(WHERE stage IN ('WON','LOST') AND closed_on BETWEEN start_date AND end_date) AS closed_count,
 coalesce(sum(value_cents) FILTER(WHERE stage='WON' AND closed_on BETWEEN start_date AND end_date),0) AS won_amount
 FROM visible GROUP BY stage
 )
 SELECT jsonb_build_object('pipelineId',p.id,'from',p_from,'to',p_to,'currency','USD','stages',
 jsonb_agg(jsonb_build_object('key',s.value->>'key','label',s.value->>'label','count',coalesce(t.n,0),'valueCents',coalesce(t.amount,0),'missingCount',coalesce(t.missing,0),'scheduledCount',coalesce(t.scheduled,0),'weightedCents',coalesce(t.weighted,0),'closedCount',coalesce(t.closed_count,0),'wonCents',coalesce(t.won_amount,0)) ORDER BY s.ordinality))
 INTO result FROM jsonb_array_elements(p.stages) WITH ORDINALITY s(value,ordinality) LEFT JOIN totals t ON t.stage=s.value->>'key';
 RETURN result;
 END $$;
GRANT CREATE ON SCHEMA p5_ci TO p5_ci_definer;
ALTER FUNCTION p5_ci.read_forecast(text,text,uuid,uuid) OWNER TO p5_ci_definer;
ALTER FUNCTION p5_ci.write_forecast(text,text,uuid,uuid,text,integer,integer) OWNER TO p5_ci_definer;
ALTER FUNCTION p5_ci.sales_report(text,text,uuid,uuid,text,text) OWNER TO p5_ci_definer;
REVOKE CREATE ON SCHEMA p5_ci FROM p5_ci_definer;
REVOKE ALL ON FUNCTION p5_ci.forecast_projection(p5_ci.forecast_inputs),p5_ci.read_forecast(text,text,uuid,uuid),p5_ci.write_forecast(text,text,uuid,uuid,text,integer,integer),p5_ci.sales_report(text,text,uuid,uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p5_ci.forecast_projection(p5_ci.forecast_inputs) TO p5_ci_definer;
GRANT EXECUTE ON FUNCTION p5_ci.read_forecast(text,text,uuid,uuid),p5_ci.write_forecast(text,text,uuid,uuid,text,integer,integer),p5_ci.sales_report(text,text,uuid,uuid,text,text) TO p5_ci_runtime;
COMMIT;
