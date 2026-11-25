-- R77 own-record CRM search and task record picker, disposable CI only.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' OR current_user<>'demo_ci'
 OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
 OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='p4_r77_ci')
 OR to_regclass('p4_r75_ci.tasks') IS NULL
 OR to_regclass('p4_r76_ci.records') IS NULL
 THEN RAISE EXCEPTION 'P4_R77_CI_ONLY'; END IF;
END $$;
CREATE SCHEMA p4_r77_ci;
REVOKE ALL ON SCHEMA p4_r77_ci FROM PUBLIC;
GRANT USAGE ON SCHEMA p4_r77_ci TO p4_synthetic_ci_runtime;
CREATE FUNCTION p4_r77_ci.search_records(p_org uuid,p_kind text,p_q text,p_status text,p_after uuid)
 RETURNS TABLE(id uuid,label text,status text) LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE who text:=p4_r69_ci.require_rep(p_org);
BEGIN
 IF p_kind IS NULL OR p_kind NOT IN ('LEAD','ACCOUNT','CONTACT','DEAL','TASK')
 OR p_q IS NULL OR p_q !~ '^[A-Za-z0-9 .&-]{0,64}$'
 OR (p_status IS NOT NULL AND NOT (
 (p_kind='LEAD' AND p_status IN ('NEW','CONTACTED','QUALIFIED','LOST','CONVERTED'))
 OR (p_kind='DEAL' AND p_status IN ('OPEN','DISCOVERY','PROPOSAL','NEGOTIATION','WON','LOST'))
 OR (p_kind='TASK' AND p_status IN ('OPEN','COMPLETED'))))
 THEN RAISE EXCEPTION USING ERRCODE='P7700',MESSAGE='INVALID_INPUT'; END IF;
 RETURN QUERY SELECT r.id,r.label,r.status FROM (
 SELECT x.id,x.label,x.status FROM p4_r76_ci.records x
 WHERE x.org_id=p_org AND x.owner_user_id=who AND x.kind=p_kind
 UNION ALL
 SELECT t.id,t.title,t.status FROM p4_r75_ci.tasks t
 WHERE p_kind='TASK' AND t.org_id=p_org AND t.owner_user_id=who
 AND p4_r75_ci.parent_allowed(p_org,who,CASE WHEN t.lead_id IS NOT NULL THEN 'LEAD' WHEN t.account_id IS NOT NULL THEN 'ACCOUNT' ELSE 'DEAL' END,coalesce(t.lead_id,t.account_id,t.deal_id))
 ) r WHERE (p_after IS NULL OR r.id>p_after)
 AND (p_status IS NULL OR r.status=p_status)
 AND strpos(lower(r.label),lower(p_q))>0
 ORDER BY r.id LIMIT 21;
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA p4_r77_ci FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p4_r77_ci.search_records(uuid,text,text,text,uuid) TO p4_synthetic_ci_runtime;
COMMIT;
