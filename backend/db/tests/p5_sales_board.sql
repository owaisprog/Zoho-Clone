-- Scoped sales board, disposable CI only.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' OR current_user<>'demo_ci'
 OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
 OR to_regclass('p5_ci.pipelines') IS NULL THEN RAISE EXCEPTION 'P5_DISPOSABLE_ONLY'; END IF;
END $$;
CREATE INDEX p5_deals_board_lookup ON p5_ci.deals(organization_id,pipeline_id,stage,id);
CREATE FUNCTION p5_ci.sales_board(p_issuer text,p_subject text,p_org uuid,p_pipeline uuid,p_search text,p_stage text,p_after uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 DECLARE who record; p p5_ci.pipelines%ROWTYPE; result jsonb;
 BEGIN
 IF current_setting('transaction_read_only')<>'on' THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 IF p_pipeline IS NULL OR p_search IS NULL OR p_search !~ '^[A-Za-z0-9 &.-]{0,80}$'
 OR (p_stage IS NULL AND p_after IS NOT NULL) OR (p_stage IS NOT NULL AND p_stage !~ '^[A-Z][A-Z0-9_]{0,23}$')
 THEN RAISE EXCEPTION 'P5_INVALID' USING ERRCODE='22023'; END IF;
 SELECT * INTO who FROM p5_ci.actor(p_issuer,p_subject,p_org);
 IF NOT FOUND OR NOT(who.rep OR who.manager) THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 SELECT * INTO p FROM p5_ci.pipelines x WHERE x.organization_id=p_org AND x.id=p_pipeline;
 IF NOT FOUND THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='P5004'; END IF;
 IF p_stage IS NOT NULL AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p.stages) s WHERE s->>'key'=p_stage) THEN RAISE EXCEPTION 'P5_INVALID' USING ERRCODE='22023'; END IF;
 WITH stages AS (
 SELECT s.value->>'key' AS key,s.value->>'label' AS label,s.ordinality AS position
 FROM jsonb_array_elements(p.stages) WITH ORDINALITY s(value,ordinality)
 WHERE p_stage IS NULL OR s.value->>'key'=p_stage
 ), visible AS MATERIALIZED (
 SELECT d AS row_value,d.id,d.stage,d.value_cents FROM p5_ci.deals d
 WHERE d.organization_id=p_org AND d.pipeline_id=p_pipeline AND (p_stage IS NULL OR d.stage=p_stage)
 AND (p_search='' OR strpos(lower(d.title),lower(p_search))>0)
 AND p5_ci.deal_visible(p_issuer,p_subject,p_org,d)
 ), totals AS (
 SELECT v.stage,count(*) AS count,coalesce(sum(v.value_cents),0) AS value_cents FROM visible v GROUP BY v.stage
 )
 SELECT coalesce(jsonb_agg(jsonb_build_object('key',s.key,'label',s.label,'count',coalesce(t.count,0),'valueCents',coalesce(t.value_cents,0),
 'items',coalesce(page.items,'[]'::jsonb),'nextCursor',page.next_cursor) ORDER BY s.position),'[]'::jsonb) INTO result
 FROM stages s LEFT JOIN totals t ON t.stage=s.key
 LEFT JOIN LATERAL (
 SELECT jsonb_agg(p5_ci.deal_projection(z.row_value) ORDER BY z.id) FILTER(WHERE z.rn<=10) AS items,
 CASE WHEN count(*)=11 THEN (array_agg(z.id ORDER BY z.id))[10] ELSE NULL END AS next_cursor
 FROM (SELECT v.row_value,v.id,row_number() OVER(ORDER BY v.id) AS rn FROM visible v
 WHERE v.stage=s.key AND (p_after IS NULL OR v.id>p_after) ORDER BY v.id LIMIT 11) z
 ) page ON true;
 RETURN jsonb_build_object('pipelineId',p.id,'pipelineName',p.name,'pipelineRevision',p.revision,'columns',result);
 END $$;
GRANT CREATE ON SCHEMA p5_ci TO p5_ci_definer;
ALTER FUNCTION p5_ci.sales_board(text,text,uuid,uuid,text,text,uuid) OWNER TO p5_ci_definer;
REVOKE CREATE ON SCHEMA p5_ci FROM p5_ci_definer;
REVOKE ALL ON FUNCTION p5_ci.sales_board(text,text,uuid,uuid,text,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p5_ci.sales_board(text,text,uuid,uuid,text,text,uuid) TO p5_ci_runtime;
COMMIT;
