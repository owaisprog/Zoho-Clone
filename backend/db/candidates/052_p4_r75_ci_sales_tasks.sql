-- R75 disposable CI only: own-record sales tasks and immutable activity history.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' OR current_user<>'demo_ci'
 OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
 OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='p4_r75_ci')
 OR to_regclass('p4_r72_ci.leads') IS NULL
 THEN RAISE EXCEPTION 'P4_R75_CI_ONLY'; END IF;
END $$;
CREATE SCHEMA p4_r75_ci;
REVOKE ALL ON SCHEMA p4_r75_ci FROM PUBLIC;
GRANT USAGE ON SCHEMA p4_r75_ci TO p4_synthetic_ci_runtime;
CREATE TABLE p4_r75_ci.tasks(
 org_id uuid NOT NULL,id uuid NOT NULL,owner_user_id text NOT NULL,
 lead_id uuid,account_id uuid,deal_id uuid,
 title text NOT NULL CHECK(title ~ '^Demo [A-Za-z][A-Za-z0-9 &.-]{2,148}$'),
 due_date date NOT NULL CHECK(due_date BETWEEN '2020-01-01' AND '2100-12-31'),
 status text NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','COMPLETED')),
 revision integer NOT NULL DEFAULT 0 CHECK(revision BETWEEN 0 AND 1000000),
 PRIMARY KEY(org_id,id),CHECK(num_nonnulls(lead_id,account_id,deal_id)=1),
 FOREIGN KEY(org_id,owner_user_id) REFERENCES p4_synthetic.memberships(org_id,user_id),
 FOREIGN KEY(org_id,lead_id) REFERENCES p4_r72_ci.leads(org_id,id),
 FOREIGN KEY(org_id,account_id) REFERENCES p4_r69_ci.accounts(org_id,id),
 FOREIGN KEY(org_id,deal_id) REFERENCES p4_r71_ci.deals(org_id,id)
);
CREATE INDEX r75_tasks_owner ON p4_r75_ci.tasks(org_id,owner_user_id,id);
CREATE TABLE p4_r75_ci.events(
 org_id uuid NOT NULL,task_id uuid NOT NULL,revision integer NOT NULL,
 actor_user_id text NOT NULL,action text NOT NULL CHECK(action IN ('CREATED','RESCHEDULED','COMPLETED')),
 before_due date,after_due date NOT NULL,occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(org_id,task_id,revision),FOREIGN KEY(org_id,task_id) REFERENCES p4_r75_ci.tasks(org_id,id)
);
ALTER TABLE p4_r75_ci.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE p4_r75_ci.tasks FORCE ROW LEVEL SECURITY;
ALTER TABLE p4_r75_ci.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE p4_r75_ci.events FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA p4_r75_ci FROM PUBLIC,p4_synthetic_ci_runtime;
CREATE TRIGGER r75_immutable BEFORE UPDATE OR DELETE ON p4_r75_ci.events
 FOR EACH ROW EXECUTE FUNCTION p4_r69_ci.immutable_event();
CREATE FUNCTION p4_r75_ci.parent_allowed(p_org uuid,p_who text,p_kind text,p_parent uuid) RETURNS boolean
 LANGUAGE sql SET search_path=pg_catalog AS $$
 SELECT CASE p_kind
 WHEN 'LEAD' THEN EXISTS(SELECT 1 FROM p4_r72_ci.leads l WHERE l.org_id=p_org AND l.id=p_parent AND l.owner_user_id=p_who)
 WHEN 'ACCOUNT' THEN EXISTS(SELECT 1 FROM p4_r69_ci.accounts a WHERE a.org_id=p_org AND a.id=p_parent AND a.owner_user_id=p_who)
 WHEN 'DEAL' THEN EXISTS(SELECT 1 FROM p4_r71_ci.deals d WHERE d.org_id=p_org AND d.id=p_parent AND d.owner_user_id=p_who)
 ELSE false END;
$$;
CREATE FUNCTION p4_r75_ci.create_task(p_org uuid,p_id uuid,p_kind text,p_parent uuid,p_title text,p_due date,p_assignee text)
 RETURNS SETOF p4_r75_ci.tasks LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE who text:=p4_r69_ci.require_rep(p_org);
BEGIN
 IF p_id IS NULL OR p_parent IS NULL OR p_kind IS NULL OR p_kind NOT IN ('LEAD','ACCOUNT','DEAL')
 OR p_title IS NULL OR p_title !~ '^Demo [A-Za-z][A-Za-z0-9 &.-]{2,148}$'
 OR p_due IS NULL OR p_due NOT BETWEEN '2020-01-01' AND '2100-12-31'
 THEN RAISE EXCEPTION USING ERRCODE='P7500',MESSAGE='INVALID_INPUT'; END IF;
 IF p_assignee IS DISTINCT FROM who OR NOT p4_r75_ci.parent_allowed(p_org,who,p_kind,p_parent)
 THEN RAISE EXCEPTION USING ERRCODE='P4003',MESSAGE='ACCESS_DENIED'; END IF;
 INSERT INTO p4_r75_ci.tasks(org_id,id,owner_user_id,lead_id,account_id,deal_id,title,due_date)
 VALUES(p_org,p_id,who,CASE WHEN p_kind='LEAD' THEN p_parent END,CASE WHEN p_kind='ACCOUNT' THEN p_parent END,CASE WHEN p_kind='DEAL' THEN p_parent END,p_title,p_due);
 INSERT INTO p4_r75_ci.events(org_id,task_id,revision,actor_user_id,action,before_due,after_due)
 VALUES(p_org,p_id,0,who,'CREATED',NULL,p_due);
 RETURN QUERY SELECT t.* FROM p4_r75_ci.tasks t WHERE t.org_id=p_org AND t.id=p_id;
END $$;
CREATE FUNCTION p4_r75_ci.change_task(p_org uuid,p_id uuid,p_expected integer,p_action text,p_due date)
 RETURNS SETOF p4_r75_ci.tasks LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE who text:=p4_r69_ci.require_rep(p_org); rec p4_r75_ci.tasks%ROWTYPE;
BEGIN
 IF p_id IS NULL OR p_expected IS NULL OR p_expected<0 OR p_expected>=1000000 OR p_action IS NULL
 OR p_action NOT IN ('RESCHEDULED','COMPLETED')
 OR (p_action='RESCHEDULED' AND (p_due IS NULL OR p_due NOT BETWEEN '2020-01-01' AND '2100-12-31'))
 OR (p_action='COMPLETED' AND p_due IS NOT NULL)
 THEN RAISE EXCEPTION USING ERRCODE='P7500',MESSAGE='INVALID_INPUT'; END IF;
 SELECT t.* INTO rec FROM p4_r75_ci.tasks t WHERE t.org_id=p_org AND t.id=p_id AND t.owner_user_id=who FOR UPDATE;
 IF NOT FOUND OR NOT p4_r75_ci.parent_allowed(p_org,who,CASE WHEN rec.lead_id IS NOT NULL THEN 'LEAD' WHEN rec.account_id IS NOT NULL THEN 'ACCOUNT' ELSE 'DEAL' END,coalesce(rec.lead_id,rec.account_id,rec.deal_id))
 THEN RAISE EXCEPTION USING ERRCODE='P4003',MESSAGE='ACCESS_DENIED'; END IF;
 IF rec.revision<>p_expected OR rec.status<>'OPEN' OR (p_action='RESCHEDULED' AND p_due=rec.due_date)
 THEN RAISE EXCEPTION USING ERRCODE='P4009',MESSAGE='CONFLICT'; END IF;
 UPDATE p4_r75_ci.tasks t SET due_date=coalesce(p_due,rec.due_date),status=CASE WHEN p_action='COMPLETED' THEN 'COMPLETED' ELSE 'OPEN' END,revision=t.revision+1
 WHERE t.org_id=p_org AND t.id=p_id;
 INSERT INTO p4_r75_ci.events(org_id,task_id,revision,actor_user_id,action,before_due,after_due)
 VALUES(p_org,p_id,p_expected+1,who,p_action,rec.due_date,coalesce(p_due,rec.due_date));
 RETURN QUERY SELECT t.* FROM p4_r75_ci.tasks t WHERE t.org_id=p_org AND t.id=p_id;
END $$;
CREATE FUNCTION p4_r75_ci.list_tasks(p_org uuid,p_after uuid)
 RETURNS SETOF p4_r75_ci.tasks LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE who text:=p4_r69_ci.require_rep(p_org);
BEGIN
 RETURN QUERY SELECT t.* FROM p4_r75_ci.tasks t WHERE t.org_id=p_org AND t.owner_user_id=who AND (p_after IS NULL OR t.id>p_after)
 AND p4_r75_ci.parent_allowed(p_org,who,CASE WHEN t.lead_id IS NOT NULL THEN 'LEAD' WHEN t.account_id IS NOT NULL THEN 'ACCOUNT' ELSE 'DEAL' END,coalesce(t.lead_id,t.account_id,t.deal_id))
 ORDER BY t.id LIMIT 21;
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA p4_r75_ci FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p4_r75_ci.create_task(uuid,uuid,text,uuid,text,date,text),p4_r75_ci.change_task(uuid,uuid,integer,text,date),p4_r75_ci.list_tasks(uuid,uuid) TO p4_synthetic_ci_runtime;
COMMIT;
