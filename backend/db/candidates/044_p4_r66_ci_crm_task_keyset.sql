-- R66: bounded cursor over owner-only task rows. CI only; never Neon or live.
\set ON_ERROR_STOP on
BEGIN;
DO $guard$ BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' OR current_user<>'demo_ci'
 OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
 OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='p4_r66_ci')
 OR to_regprocedure('p4_r40_ci.require_current_owner(uuid)') IS NULL
 OR to_regclass('p4_r64_ci.lead_tasks') IS NULL
 THEN RAISE EXCEPTION 'P4_R66_CI_ONLY'; END IF;
END $guard$;
CREATE SCHEMA p4_r66_ci;
REVOKE ALL ON SCHEMA p4_r66_ci FROM PUBLIC;
GRANT USAGE ON SCHEMA p4_r66_ci TO p4_synthetic_ci_runtime;
CREATE FUNCTION p4_r66_ci.owner_task_page(
 p_org uuid,p_lead uuid,p_after_time timestamptz,p_after_id uuid
) RETURNS TABLE(task_id uuid,lead_id uuid,title text,due_date text,
 status text,revision integer,created_by text,updated_by text,
 created_at timestamptz,completed_at timestamptz,key_time text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $body$
BEGIN
 PERFORM p4_r40_ci.require_current_owner(p_org);
 IF p_lead IS NULL OR ((p_after_time IS NULL) IS DISTINCT FROM
  (p_after_id IS NULL))
 THEN RAISE EXCEPTION USING ERRCODE='P6600',MESSAGE='INVALID_TASK_PAGE'; END IF;
 IF NOT EXISTS(SELECT 1 FROM p4_r57_ci.leads l
  WHERE l.org_id=p_org AND l.lead_id=p_lead)
 THEN RAISE EXCEPTION USING ERRCODE='P4009',MESSAGE='LEAD_NOT_FOUND'; END IF;
 RETURN QUERY SELECT t.task_id,t.lead_id,t.title,t.due_date::text,
  t.status,t.revision,t.created_by,t.updated_by,t.created_at,t.completed_at,
  to_char(t.created_at AT TIME ZONE 'UTC',
   'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')::text
 FROM p4_r64_ci.lead_tasks t
 WHERE t.org_id=p_org AND t.lead_id=p_lead
  AND (p_after_time IS NULL OR
   (t.created_at,t.task_id)<(p_after_time,p_after_id))
 ORDER BY t.created_at DESC,t.task_id DESC LIMIT 21;
END $body$;
REVOKE ALL ON FUNCTION
 p4_r66_ci.owner_task_page(uuid,uuid,timestamptz,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION
 p4_r66_ci.owner_task_page(uuid,uuid,timestamptz,uuid)
 TO p4_synthetic_ci_runtime;
COMMIT;
