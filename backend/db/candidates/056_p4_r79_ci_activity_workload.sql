-- R79: immutable record history and authorized workload counts in disposable CI only.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' OR current_user<>'demo_ci'
 OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
 OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='p4_r79_ci')
 OR to_regnamespace('p4_r78_ci') IS NULL THEN RAISE EXCEPTION 'P4_R79_CI_ONLY'; END IF;
END $$;
CREATE SCHEMA p4_r79_ci;
REVOKE ALL ON SCHEMA p4_r79_ci FROM PUBLIC;
GRANT USAGE ON SCHEMA p4_r79_ci TO p4_synthetic_ci_runtime;
CREATE FUNCTION p4_r79_ci.timeline(p_org uuid,p_team text,p_kind text,p_record uuid,p_before integer)
 RETURNS TABLE(revision integer,actor text,action text,occurred_at timestamptz,before_value text,after_value text)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE who text; allowed boolean:=false;
BEGIN
 IF p_kind IS NULL OR p_kind NOT IN ('LEAD','ACCOUNT','CONTACT','DEAL','TASK') OR p_record IS NULL
 OR (p_before IS NOT NULL AND (p_before<0 OR p_before>1000001))
 THEN RAISE EXCEPTION USING ERRCODE='P7900',MESSAGE='INVALID_INPUT'; END IF;
 IF p_team IS NULL THEN
  who:=p4_r69_ci.require_rep(p_org);
  IF p_kind='TASK' THEN
   SELECT EXISTS(SELECT 1 FROM p4_r75_ci.tasks t WHERE t.org_id=p_org AND t.id=p_record
   AND p4_r78_ci.task_allowed(p_org,who,t.owner_user_id,CASE WHEN t.lead_id IS NOT NULL THEN 'LEAD' WHEN t.account_id IS NOT NULL THEN 'ACCOUNT' ELSE 'DEAL' END,coalesce(t.lead_id,t.account_id,t.deal_id),t.team_id)) INTO allowed;
  ELSE
   SELECT EXISTS(SELECT 1 FROM p4_r76_ci.records r WHERE r.org_id=p_org AND r.kind=p_kind AND r.id=p_record AND r.owner_user_id=who) INTO allowed;
  END IF;
 ELSE
  who:=p4_r78_ci.require_team(p_org,p_team);
  IF p_kind='DEAL' THEN allowed:=p4_r78_ci.shared_deal(p_org,p_team,p_record);
  ELSIF p_kind='TASK' THEN
   SELECT EXISTS(SELECT 1 FROM p4_r75_ci.tasks t WHERE t.org_id=p_org AND t.id=p_record AND t.deal_id IS NOT NULL
   AND (t.team_id IS NULL OR t.team_id=p_team) AND p4_r78_ci.active_rep(p_org,p_team,t.owner_user_id)
   AND p4_r78_ci.shared_deal(p_org,p_team,t.deal_id)) INTO allowed;
  END IF;
 END IF;
 IF NOT allowed THEN RAISE EXCEPTION USING ERRCODE='P4003',MESSAGE='ACCESS_DENIED'; END IF;
 RETURN QUERY SELECT e.* FROM (
 SELECT a.revision,a.actor_user_id,a.action,a.occurred_at,NULL::text,NULL::text FROM p4_r69_ci.account_events a WHERE p_kind='ACCOUNT' AND a.org_id=p_org AND a.account_id=p_record
 UNION ALL SELECT c.revision,c.actor_user_id,c.action,c.occurred_at,NULL::text,NULL::text FROM p4_r70_ci.contact_events c WHERE p_kind='CONTACT' AND c.org_id=p_org AND c.contact_id=p_record
 UNION ALL SELECT l.revision,l.actor_user_id,CASE WHEN l.revision=0 THEN 'CREATED' ELSE 'STAGE_CHANGED' END,l.occurred_at,l.before_status,l.after_status FROM p4_r72_ci.lead_events l WHERE p_kind='LEAD' AND l.org_id=p_org AND l.lead_id=p_record
 UNION ALL SELECT d.revision,d.actor_user_id,CASE WHEN d.revision=0 THEN 'CREATED' ELSE 'STAGE_CHANGED' END,d.occurred_at,d.before_stage,d.after_stage FROM p4_r71_ci.deal_events d WHERE p_kind='DEAL' AND d.org_id=p_org AND d.deal_id=p_record
 UNION ALL SELECT t.revision,t.actor_user_id,t.action,t.occurred_at,t.before_due::text,t.after_due::text FROM p4_r75_ci.events t WHERE p_kind='TASK' AND t.org_id=p_org AND t.task_id=p_record
 ) e WHERE p_before IS NULL OR e.revision<p_before ORDER BY e.revision DESC LIMIT 21;
END $$;
CREATE FUNCTION p4_r79_ci.workload(p_org uuid,p_team text,p_asof date,p_owner text)
 RETURNS TABLE(owner text,overdue integer,due_today integer,upcoming integer,completed integer)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM p4_r78_ci.require_team(p_org,p_team);
 IF p_asof IS NULL OR p_asof NOT BETWEEN '2020-01-01' AND '2100-12-31' THEN RAISE EXCEPTION USING ERRCODE='P7900',MESSAGE='INVALID_INPUT'; END IF;
 IF p_owner IS NOT NULL AND NOT p4_r78_ci.active_rep(p_org,p_team,p_owner)
 THEN RAISE EXCEPTION USING ERRCODE='P4003',MESSAGE='ACCESS_DENIED'; END IF;
 RETURN QUERY WITH eligible AS (
 SELECT tm.user_id FROM p4_synthetic.team_memberships tm
 WHERE tm.org_id=p_org AND tm.team_id=p_team AND (p_owner IS NULL OR tm.user_id=p_owner)
 AND p4_r78_ci.active_rep(p_org,p_team,tm.user_id)
 ), visible AS (
 SELECT t.owner_user_id,t.status,t.due_date FROM p4_r75_ci.tasks t
 JOIN eligible e ON e.user_id=t.owner_user_id
 WHERE t.org_id=p_org AND t.deal_id IS NOT NULL AND (t.team_id IS NULL OR t.team_id=p_team)
 AND p4_r78_ci.shared_deal(p_org,p_team,t.deal_id)
 )
 SELECT e.user_id,(count(v.status) FILTER(WHERE v.status='OPEN' AND v.due_date<p_asof))::int,
 (count(v.status) FILTER(WHERE v.status='OPEN' AND v.due_date=p_asof))::int,
 (count(v.status) FILTER(WHERE v.status='OPEN' AND v.due_date>p_asof))::int,
 (count(v.status) FILTER(WHERE v.status='COMPLETED'))::int
 FROM eligible e LEFT JOIN visible v ON v.owner_user_id=e.user_id GROUP BY e.user_id ORDER BY e.user_id LIMIT 101;
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA p4_r79_ci FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p4_r79_ci.timeline(uuid,text,text,uuid,integer),p4_r79_ci.workload(uuid,text,date,text) TO p4_synthetic_ci_runtime;
COMMIT;
