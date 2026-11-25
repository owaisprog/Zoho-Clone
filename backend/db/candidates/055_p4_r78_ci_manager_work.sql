-- R78 manager Deal stage edits and team task assignment; synthetic CI only.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' OR current_user<>'demo_ci'
 OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
 OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='p4_r78_ci')
 OR to_regnamespace('p4_r77_ci') IS NULL
 THEN RAISE EXCEPTION 'P4_R78_CI_ONLY'; END IF;
END $$;
CREATE SCHEMA p4_r78_ci;
REVOKE ALL ON SCHEMA p4_r78_ci FROM PUBLIC;
GRANT USAGE ON SCHEMA p4_r78_ci TO p4_synthetic_ci_runtime;
ALTER TABLE p4_r75_ci.tasks ADD COLUMN team_id text,
 ADD FOREIGN KEY(org_id,team_id) REFERENCES p4_synthetic.teams(org_id,id);
ALTER TABLE p4_r75_ci.events DROP CONSTRAINT events_action_check;
ALTER TABLE p4_r75_ci.events ADD CONSTRAINT r78_event_action CHECK(action IN ('CREATED','RESCHEDULED','COMPLETED','REASSIGNED')),
 ADD COLUMN before_assignee text, ADD COLUMN after_assignee text;
CREATE FUNCTION p4_r78_ci.active_rep(p_org uuid,p_team text,p_user text) RETURNS boolean
 LANGUAGE sql SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM p4_synthetic.team_memberships tm
 JOIN p4_synthetic.memberships m ON m.org_id=tm.org_id AND m.user_id=tm.user_id AND m.active AND m.role='MEMBER'
 JOIN p4_r40_ci.sales_roles r ON r.org_id=m.org_id AND r.user_id=m.user_id AND r.role_code='SALES_REP'
 JOIN p4_synthetic.teams t ON t.org_id=tm.org_id AND t.id=tm.team_id AND t.active
 JOIN p4_synthetic.departments dep ON dep.org_id=t.org_id AND dep.id=t.department_id AND dep.active
 WHERE tm.org_id=p_org AND tm.team_id=p_team AND tm.user_id=p_user AND tm.active
 AND EXISTS(SELECT 1 FROM p4_synthetic.identity_subjects s WHERE s.user_id=p_user AND s.email_verified));
$$;
CREATE FUNCTION p4_r78_ci.shared_deal(p_org uuid,p_team text,p_deal uuid) RETURNS boolean
 LANGUAGE sql SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM p4_r74_ci.deal_team_assignments a
 JOIN p4_r71_ci.deals d ON d.org_id=a.org_id AND d.id=a.deal_id
 WHERE a.org_id=p_org AND a.team_id=p_team AND a.deal_id=p_deal AND a.active
 AND p4_r78_ci.active_rep(p_org,p_team,d.owner_user_id));
$$;
CREATE FUNCTION p4_r78_ci.task_allowed(p_org uuid,p_who text,p_owner text,p_kind text,p_parent uuid,p_team text) RETURNS boolean
 LANGUAGE sql SET search_path=pg_catalog AS $$
 SELECT p_owner=p_who AND CASE WHEN p_team IS NULL THEN p4_r75_ci.parent_allowed(p_org,p_who,p_kind,p_parent)
 ELSE p_kind='DEAL' AND p4_r78_ci.active_rep(p_org,p_team,p_who) AND p4_r78_ci.shared_deal(p_org,p_team,p_parent) END;
$$;
CREATE FUNCTION p4_r78_ci.require_team(p_org uuid,p_team text) RETURNS text
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE who text:=p4_r74_ci.require_manager(p_org);
BEGIN
 IF p_team IS NULL OR NOT EXISTS(SELECT 1 FROM p4_r74_ci.teams(p_org) t WHERE t.id=p_team)
 THEN RAISE EXCEPTION USING ERRCODE='P4003',MESSAGE='ACCESS_DENIED'; END IF;
 RETURN who;
END $$;
CREATE FUNCTION p4_r78_ci.members(p_org uuid,p_team text) RETURNS TABLE(user_id text)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM p4_r78_ci.require_team(p_org,p_team);
 RETURN QUERY SELECT tm.user_id FROM p4_synthetic.team_memberships tm
 WHERE tm.org_id=p_org AND tm.team_id=p_team AND p4_r78_ci.active_rep(p_org,p_team,tm.user_id)
 ORDER BY tm.user_id LIMIT 101;
END $$;
CREATE FUNCTION p4_r78_ci.work(p_org uuid,p_team text,p_kind text,p_after uuid)
 RETURNS TABLE(id uuid,label text,status text,owner_user_id text,revision integer,parent_id uuid,due_date date)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM p4_r78_ci.require_team(p_org,p_team);
 IF p_kind IS NULL OR p_kind NOT IN ('DEAL','TASK') THEN RAISE EXCEPTION USING ERRCODE='P7800',MESSAGE='INVALID_INPUT'; END IF;
 RETURN QUERY SELECT w.* FROM (
 SELECT d.id,d.title,s.code,d.owner_user_id,d.revision,NULL::uuid AS parent_id,NULL::date AS due_date
 FROM p4_r71_ci.deals d JOIN p4_r71_ci.stages s ON s.org_id=d.org_id AND s.pipeline_id=d.pipeline_id AND s.id=d.stage_id
 WHERE p_kind='DEAL' AND d.org_id=p_org AND p4_r78_ci.shared_deal(p_org,p_team,d.id)
 UNION ALL
 SELECT t.id,t.title,t.status,t.owner_user_id,t.revision,t.deal_id,t.due_date FROM p4_r75_ci.tasks t
 WHERE p_kind='TASK' AND t.org_id=p_org AND t.deal_id IS NOT NULL AND (t.team_id IS NULL OR t.team_id=p_team)
 AND p4_r78_ci.active_rep(p_org,p_team,t.owner_user_id) AND p4_r78_ci.shared_deal(p_org,p_team,t.deal_id)
 ) w WHERE p_after IS NULL OR w.id>p_after ORDER BY w.id LIMIT 21;
END $$;
CREATE FUNCTION p4_r78_ci.create_task(p_org uuid,p_team text,p_id uuid,p_deal uuid,p_title text,p_due date,p_assignee text)
 RETURNS SETOF p4_r75_ci.tasks LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE who text:=p4_r78_ci.require_team(p_org,p_team);
BEGIN
 IF p_id IS NULL OR p_deal IS NULL OR p_title IS NULL OR p_title !~ '^Demo [A-Za-z][A-Za-z0-9 &.-]{2,148}$'
 OR p_due IS NULL OR p_due NOT BETWEEN '2020-01-01' AND '2100-12-31'
 THEN RAISE EXCEPTION USING ERRCODE='P7800',MESSAGE='INVALID_INPUT'; END IF;
 IF NOT p4_r78_ci.shared_deal(p_org,p_team,p_deal) OR NOT p4_r78_ci.active_rep(p_org,p_team,p_assignee)
 THEN RAISE EXCEPTION USING ERRCODE='P4003',MESSAGE='ACCESS_DENIED'; END IF;
 INSERT INTO p4_r75_ci.tasks(org_id,id,owner_user_id,deal_id,title,due_date,team_id)
 VALUES(p_org,p_id,p_assignee,p_deal,p_title,p_due,p_team);
 INSERT INTO p4_r75_ci.events(org_id,task_id,revision,actor_user_id,action,before_due,after_due,after_assignee)
 VALUES(p_org,p_id,0,who,'CREATED',NULL,p_due,p_assignee);
 RETURN QUERY SELECT t.* FROM p4_r75_ci.tasks t WHERE t.org_id=p_org AND t.id=p_id;
END $$;
CREATE FUNCTION p4_r78_ci.reassign(p_org uuid,p_team text,p_id uuid,p_assignee text,p_expected integer)
 RETURNS SETOF p4_r75_ci.tasks LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE who text:=p4_r78_ci.require_team(p_org,p_team); rec p4_r75_ci.tasks%ROWTYPE;
BEGIN
 IF p_id IS NULL OR p_expected IS NULL OR p_expected<0 OR p_expected>=1000000
 THEN RAISE EXCEPTION USING ERRCODE='P7800',MESSAGE='INVALID_INPUT'; END IF;
 SELECT t.* INTO rec FROM p4_r75_ci.tasks t WHERE t.org_id=p_org AND t.id=p_id FOR UPDATE;
 IF NOT FOUND OR rec.deal_id IS NULL OR (rec.team_id IS NOT NULL AND rec.team_id<>p_team)
 OR NOT p4_r78_ci.shared_deal(p_org,p_team,rec.deal_id)
 OR NOT p4_r78_ci.active_rep(p_org,p_team,rec.owner_user_id)
 OR NOT p4_r78_ci.active_rep(p_org,p_team,p_assignee)
 THEN RAISE EXCEPTION USING ERRCODE='P4003',MESSAGE='ACCESS_DENIED'; END IF;
 IF rec.revision<>p_expected OR rec.status<>'OPEN' OR rec.owner_user_id=p_assignee
 THEN RAISE EXCEPTION USING ERRCODE='P4009',MESSAGE='CONFLICT'; END IF;
 UPDATE p4_r75_ci.tasks t SET owner_user_id=p_assignee,team_id=p_team,revision=t.revision+1 WHERE t.org_id=p_org AND t.id=p_id;
 INSERT INTO p4_r75_ci.events(org_id,task_id,revision,actor_user_id,action,before_due,after_due,before_assignee,after_assignee)
 VALUES(p_org,p_id,p_expected+1,who,'REASSIGNED',rec.due_date,rec.due_date,rec.owner_user_id,p_assignee);
 RETURN QUERY SELECT t.* FROM p4_r75_ci.tasks t WHERE t.org_id=p_org AND t.id=p_id;
END $$;
CREATE FUNCTION p4_r78_ci.change_stage(p_org uuid,p_team text,p_id uuid,p_next text,p_expected integer)
 RETURNS TABLE(id uuid,title text,account_id uuid,contact_id uuid,pipeline_id uuid,stage_id uuid,
 stage text,revision integer,created_at timestamptz)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE who text:=p4_r78_ci.require_team(p_org,p_team); owner_id text; prior text; pipe uuid; next_id uuid; ver integer;
BEGIN
 IF p_id IS NULL OR p_next IS NULL OR p_next NOT IN ('DISCOVERY','PROPOSAL','NEGOTIATION','WON','LOST')
 OR p_expected IS NULL OR p_expected<0 OR p_expected>=1000000
 THEN RAISE EXCEPTION USING ERRCODE='P7800',MESSAGE='INVALID_INPUT'; END IF;
 SELECT s.code,d.pipeline_id,d.revision,d.owner_user_id INTO prior,pipe,ver,owner_id FROM p4_r71_ci.deals d
 JOIN p4_r71_ci.stages s ON s.org_id=d.org_id AND s.pipeline_id=d.pipeline_id AND s.id=d.stage_id
 JOIN p4_r71_ci.pipelines p ON p.org_id=d.org_id AND p.id=d.pipeline_id AND p.active
 WHERE d.org_id=p_org AND d.id=p_id AND p4_r78_ci.shared_deal(p_org,p_team,d.id) FOR UPDATE OF d;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P4003',MESSAGE='ACCESS_DENIED'; END IF;
 IF prior IS NULL OR ver<>p_expected OR NOT (
 (prior='OPEN' AND p_next IN ('DISCOVERY','LOST')) OR
 (prior='DISCOVERY' AND p_next IN ('PROPOSAL','LOST')) OR
 (prior='PROPOSAL' AND p_next IN ('NEGOTIATION','LOST')) OR
 (prior='NEGOTIATION' AND p_next IN ('WON','LOST')))
 THEN RAISE EXCEPTION USING ERRCODE='P4009',MESSAGE='CONFLICT'; END IF;
 SELECT s.id INTO next_id FROM p4_r71_ci.stages s WHERE s.org_id=p_org AND s.pipeline_id=pipe AND s.code=p_next;
 IF next_id IS NULL THEN RAISE EXCEPTION USING ERRCODE='P4009',MESSAGE='CONFLICT'; END IF;
 UPDATE p4_r71_ci.deals d SET stage_id=next_id,revision=d.revision+1
 WHERE d.org_id=p_org AND d.id=p_id AND d.owner_user_id=owner_id AND d.revision=p_expected;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P4009',MESSAGE='CONFLICT'; END IF;
 INSERT INTO p4_r71_ci.deal_events(org_id,deal_id,revision,actor_user_id,before_stage,after_stage)
 VALUES(p_org,p_id,p_expected+1,who,prior,p_next);
 RETURN QUERY SELECT * FROM p4_r71_ci.owned_deal(p_org,p_id,owner_id);
END $$;
CREATE OR REPLACE FUNCTION p4_r75_ci.change_task(p_org uuid,p_id uuid,p_expected integer,p_action text,p_due date)
 RETURNS SETOF p4_r75_ci.tasks LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE who text:=p4_r69_ci.require_rep(p_org); rec p4_r75_ci.tasks%ROWTYPE;
BEGIN
 IF p_id IS NULL OR p_expected IS NULL OR p_expected<0 OR p_expected>=1000000 OR p_action IS NULL
 OR p_action NOT IN ('RESCHEDULED','COMPLETED')
 OR (p_action='RESCHEDULED' AND (p_due IS NULL OR p_due NOT BETWEEN '2020-01-01' AND '2100-12-31'))
 OR (p_action='COMPLETED' AND p_due IS NOT NULL)
 THEN RAISE EXCEPTION USING ERRCODE='P7500',MESSAGE='INVALID_INPUT'; END IF;
 SELECT t.* INTO rec FROM p4_r75_ci.tasks t WHERE t.org_id=p_org AND t.id=p_id AND t.owner_user_id=who FOR UPDATE;
 IF NOT FOUND OR NOT p4_r78_ci.task_allowed(p_org,who,rec.owner_user_id,CASE WHEN rec.lead_id IS NOT NULL THEN 'LEAD' WHEN rec.account_id IS NOT NULL THEN 'ACCOUNT' ELSE 'DEAL' END,coalesce(rec.lead_id,rec.account_id,rec.deal_id),rec.team_id)
 THEN RAISE EXCEPTION USING ERRCODE='P4003',MESSAGE='ACCESS_DENIED'; END IF;
 IF rec.revision<>p_expected OR rec.status<>'OPEN' OR (p_action='RESCHEDULED' AND p_due=rec.due_date)
 THEN RAISE EXCEPTION USING ERRCODE='P4009',MESSAGE='CONFLICT'; END IF;
 UPDATE p4_r75_ci.tasks t SET due_date=coalesce(p_due,rec.due_date),status=CASE WHEN p_action='COMPLETED' THEN 'COMPLETED' ELSE 'OPEN' END,revision=t.revision+1
 WHERE t.org_id=p_org AND t.id=p_id;
 INSERT INTO p4_r75_ci.events(org_id,task_id,revision,actor_user_id,action,before_due,after_due)
 VALUES(p_org,p_id,p_expected+1,who,p_action,rec.due_date,coalesce(p_due,rec.due_date));
 RETURN QUERY SELECT t.* FROM p4_r75_ci.tasks t WHERE t.org_id=p_org AND t.id=p_id;
END $$;
CREATE OR REPLACE FUNCTION p4_r75_ci.list_tasks(p_org uuid,p_after uuid)
 RETURNS SETOF p4_r75_ci.tasks LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE who text:=p4_r69_ci.require_rep(p_org);
BEGIN
 RETURN QUERY SELECT t.* FROM p4_r75_ci.tasks t WHERE t.org_id=p_org AND t.owner_user_id=who AND (p_after IS NULL OR t.id>p_after)
 AND p4_r78_ci.task_allowed(p_org,who,t.owner_user_id,CASE WHEN t.lead_id IS NOT NULL THEN 'LEAD' WHEN t.account_id IS NOT NULL THEN 'ACCOUNT' ELSE 'DEAL' END,coalesce(t.lead_id,t.account_id,t.deal_id),t.team_id)
 ORDER BY t.id LIMIT 21;
END $$;
CREATE OR REPLACE FUNCTION p4_r77_ci.search_records(p_org uuid,p_kind text,p_q text,p_status text,p_after uuid)
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
 AND p4_r78_ci.task_allowed(p_org,who,t.owner_user_id,CASE WHEN t.lead_id IS NOT NULL THEN 'LEAD' WHEN t.account_id IS NOT NULL THEN 'ACCOUNT' ELSE 'DEAL' END,coalesce(t.lead_id,t.account_id,t.deal_id),t.team_id)
 ) r WHERE (p_after IS NULL OR r.id>p_after)
 AND (p_status IS NULL OR r.status=p_status)
 AND strpos(lower(r.label),lower(p_q))>0
 ORDER BY r.id LIMIT 21;
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA p4_r78_ci FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p4_r78_ci.members(uuid,text),p4_r78_ci.work(uuid,text,text,uuid),p4_r78_ci.create_task(uuid,text,uuid,uuid,text,date,text),p4_r78_ci.reassign(uuid,text,uuid,text,integer),p4_r78_ci.change_stage(uuid,text,uuid,text,integer) TO p4_synthetic_ci_runtime;
COMMIT;
