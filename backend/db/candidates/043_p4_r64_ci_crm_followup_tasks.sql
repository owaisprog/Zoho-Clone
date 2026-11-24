-- R64: real persisted fictional CRM follow-up tasks. CI only, never Neon/production.
\set ON_ERROR_STOP on
BEGIN;
DO $guard$ BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' OR current_user<>'demo_ci'
 OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
 OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='p4_r64_ci')
 OR to_regprocedure('p4_r40_ci.require_current_owner(uuid)') IS NULL
 OR to_regclass('p4_r57_ci.leads') IS NULL
 THEN RAISE EXCEPTION 'P4_R64_CI_ONLY'; END IF;
END $guard$;
CREATE SCHEMA p4_r64_ci;
REVOKE ALL ON SCHEMA p4_r64_ci FROM PUBLIC;
GRANT USAGE ON SCHEMA p4_r64_ci TO p4_synthetic_ci_runtime;

CREATE TABLE p4_r64_ci.lead_tasks(
 org_id uuid NOT NULL,
 task_id uuid NOT NULL,
 lead_id uuid NOT NULL,
 request_id uuid NOT NULL,
 title text NOT NULL CHECK(title ~ '^Demo [A-Za-z0-9 ,.!?-]{8,70}$'),
 due_date date NOT NULL CHECK(due_date BETWEEN DATE '2026-01-01' AND DATE '2032-12-31'),
 status text NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','DONE')),
 revision integer NOT NULL DEFAULT 0 CHECK(revision IN (0,1)),
 created_by text NOT NULL CHECK(created_by ~ '^user_demo_[a-z]{2,16}$'),
 updated_by text CHECK(updated_by ~ '^user_demo_[a-z]{2,16}$'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 completed_at timestamptz,
 PRIMARY KEY(org_id,task_id),
 UNIQUE(org_id,request_id),
 FOREIGN KEY(org_id,lead_id) REFERENCES p4_r57_ci.leads(org_id,lead_id)
  ON DELETE RESTRICT,
 CHECK((status='OPEN' AND revision=0 AND completed_at IS NULL AND updated_by IS NULL)
  OR (status='DONE' AND revision=1 AND completed_at IS NOT NULL AND updated_by IS NOT NULL))
);
CREATE TABLE p4_r64_ci.task_events(
 org_id uuid NOT NULL,
 event_id uuid NOT NULL,
 task_id uuid NOT NULL,
 actor_user_id text NOT NULL CHECK(actor_user_id ~ '^user_demo_[a-z]{2,16}$'),
 event_kind text NOT NULL CHECK(event_kind IN ('CREATED','COMPLETED')),
 revision integer NOT NULL CHECK(revision IN (0,1)),
 occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(org_id,event_id),
 FOREIGN KEY(org_id,task_id) REFERENCES p4_r64_ci.lead_tasks(org_id,task_id)
 ON DELETE RESTRICT,
 CHECK((event_kind='CREATED' AND revision=0) OR
  (event_kind='COMPLETED' AND revision=1))
);
ALTER TABLE p4_r64_ci.lead_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE p4_r64_ci.lead_tasks FORCE ROW LEVEL SECURITY;
ALTER TABLE p4_r64_ci.task_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE p4_r64_ci.task_events FORCE ROW LEVEL SECURITY;
REVOKE ALL ON p4_r64_ci.lead_tasks,p4_r64_ci.task_events FROM PUBLIC;
CREATE FUNCTION p4_r64_ci.immutable_task_event() RETURNS trigger
 LANGUAGE plpgsql SET search_path=pg_catalog AS $body$
BEGIN RAISE EXCEPTION 'P4_R64_TASK_AUDIT_IMMUTABLE'; END $body$;
CREATE TRIGGER r64_task_event_immutable BEFORE UPDATE OR DELETE
 ON p4_r64_ci.task_events FOR EACH ROW
 EXECUTE FUNCTION p4_r64_ci.immutable_task_event();

CREATE FUNCTION p4_r64_ci.create_task(
 p_org uuid,p_lead uuid,p_task uuid,p_request uuid,p_title text,p_due date
) RETURNS TABLE(
 task_id uuid,lead_id uuid,title text,due_date date,status text,
 revision integer,created_by text,updated_by text,
 created_at timestamptz,completed_at timestamptz
) LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $body$
DECLARE who text;
BEGIN
 PERFORM p4_r40_ci.require_current_owner(p_org);
 who:=nullif(current_setting('app.actor_id',true),'');
 IF p_task IS NULL OR p_lead IS NULL OR p_request IS NULL
 OR p_title IS NULL OR p_title !~ '^Demo [A-Za-z0-9 ,.!?-]{8,70}$'
 OR p_due IS NULL OR p_due NOT BETWEEN DATE '2026-01-01' AND DATE '2032-12-31'
 THEN RAISE EXCEPTION USING ERRCODE='P6400',MESSAGE='INVALID_TASK'; END IF;
 IF NOT EXISTS(SELECT 1 FROM p4_r57_ci.leads l
  WHERE l.org_id=p_org AND l.lead_id=p_lead)
 THEN RAISE EXCEPTION USING ERRCODE='P4009',MESSAGE='LEAD_MISSING'; END IF;
 INSERT INTO p4_r64_ci.lead_tasks(
  org_id,task_id,lead_id,request_id,title,due_date,created_by
 ) VALUES (p_org,p_task,p_lead,p_request,p_title,p_due,who);
 INSERT INTO p4_r64_ci.task_events(org_id,event_id,task_id,
  actor_user_id,event_kind,revision)
 VALUES(p_org,p_request,p_task,who,'CREATED',0);
 RETURN QUERY SELECT t.task_id,t.lead_id,t.title,t.due_date,t.status,
  t.revision,t.created_by,t.updated_by,t.created_at,t.completed_at
 FROM p4_r64_ci.lead_tasks t WHERE t.org_id=p_org AND t.task_id=p_task;
END $body$;

CREATE FUNCTION p4_r64_ci.list_tasks(p_org uuid,p_lead uuid)
RETURNS TABLE(
 task_id uuid,lead_id uuid,title text,due_date date,status text,
 revision integer,created_by text,updated_by text,
 created_at timestamptz,completed_at timestamptz
) LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $body$
BEGIN
 PERFORM p4_r40_ci.require_current_owner(p_org);
 IF p_lead IS NULL OR NOT EXISTS(SELECT 1 FROM p4_r57_ci.leads l
  WHERE l.org_id=p_org AND l.lead_id=p_lead)
 THEN RAISE EXCEPTION USING ERRCODE='P4009',MESSAGE='LEAD_MISSING'; END IF;
 RETURN QUERY SELECT t.task_id,t.lead_id,t.title,t.due_date,t.status,
  t.revision,t.created_by,t.updated_by,t.created_at,t.completed_at
 FROM p4_r64_ci.lead_tasks t
 WHERE t.org_id=p_org AND t.lead_id=p_lead
 ORDER BY t.created_at DESC,t.task_id DESC LIMIT 21;
END $body$;

CREATE FUNCTION p4_r64_ci.complete_task(
 p_org uuid,p_lead uuid,p_task uuid,p_expected integer,p_event uuid
) RETURNS TABLE(
 task_id uuid,lead_id uuid,title text,due_date date,status text,
 revision integer,created_by text,updated_by text,
 created_at timestamptz,completed_at timestamptz
) LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $body$
DECLARE who text; old_status text; old_revision integer;
BEGIN
 PERFORM p4_r40_ci.require_current_owner(p_org);
 who:=nullif(current_setting('app.actor_id',true),'');
 IF p_lead IS NULL OR p_task IS NULL OR p_event IS NULL
 OR p_expected IS DISTINCT FROM 0
 THEN RAISE EXCEPTION USING ERRCODE='P6400',MESSAGE='INVALID_TASK_COMPLETION'; END IF;
 SELECT t.status,t.revision INTO old_status,old_revision
 FROM p4_r64_ci.lead_tasks t WHERE t.org_id=p_org
  AND t.lead_id=p_lead AND t.task_id=p_task FOR UPDATE;
 IF old_status IS DISTINCT FROM 'OPEN' OR old_revision IS DISTINCT FROM p_expected
 THEN RAISE EXCEPTION USING ERRCODE='P4009',MESSAGE='STALE_OR_UNKNOWN_TASK'; END IF;
 UPDATE p4_r64_ci.lead_tasks t SET status='DONE',revision=1,
  updated_by=who,completed_at=clock_timestamp()
 WHERE t.org_id=p_org AND t.lead_id=p_lead AND t.task_id=p_task;
 INSERT INTO p4_r64_ci.task_events(org_id,event_id,task_id,
  actor_user_id,event_kind,revision)
 VALUES(p_org,p_event,p_task,who,'COMPLETED',1);
 RETURN QUERY SELECT t.task_id,t.lead_id,t.title,t.due_date,t.status,
  t.revision,t.created_by,t.updated_by,t.created_at,t.completed_at
 FROM p4_r64_ci.lead_tasks t WHERE t.org_id=p_org AND t.task_id=p_task;
END $body$;
REVOKE ALL ON FUNCTION
 p4_r64_ci.create_task(uuid,uuid,uuid,uuid,text,date) FROM PUBLIC;
REVOKE ALL ON FUNCTION p4_r64_ci.list_tasks(uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION
 p4_r64_ci.complete_task(uuid,uuid,uuid,integer,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION
 p4_r64_ci.create_task(uuid,uuid,uuid,uuid,text,date)
 TO p4_synthetic_ci_runtime;
GRANT EXECUTE ON FUNCTION
 p4_r64_ci.list_tasks(uuid,uuid)
 TO p4_synthetic_ci_runtime;
GRANT EXECUTE ON FUNCTION
 p4_r64_ci.complete_task(uuid,uuid,uuid,integer,uuid)
 TO p4_synthetic_ci_runtime;
COMMIT;
