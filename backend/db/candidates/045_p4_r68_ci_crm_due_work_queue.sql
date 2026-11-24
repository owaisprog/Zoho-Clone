-- R68 owner-scoped open CRM tasks across leads, earliest due first; disposable CI only.
\set ON_ERROR_STOP on
BEGIN;
DO $guard$ BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' OR current_user<>'demo_ci'
 OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
 OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='p4_r68_ci')
 OR to_regprocedure('p4_r40_ci.require_current_owner(uuid)') IS NULL
 OR to_regclass('p4_r64_ci.lead_tasks') IS NULL
 OR to_regclass('p4_r57_ci.leads') IS NULL
 THEN RAISE EXCEPTION 'P4_R68_CI_ONLY'; END IF;
END $guard$;
CREATE SCHEMA p4_r68_ci;
REVOKE ALL ON SCHEMA p4_r68_ci FROM PUBLIC;
GRANT USAGE ON SCHEMA p4_r68_ci TO p4_synthetic_ci_runtime;
CREATE FUNCTION p4_r68_ci.owner_due_queue(
 p_org uuid,p_through date,p_after_due date,p_after_id uuid
) RETURNS TABLE(task_id uuid,lead_id uuid,title text,due_date text,
 status text,revision integer,created_by text,updated_by text,
 created_at timestamptz,completed_at timestamptz,
 company_name text,key_date text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $body$
BEGIN
 PERFORM p4_r40_ci.require_current_owner(p_org);
 IF p_through IS NULL OR p_through NOT BETWEEN DATE '2026-01-01' AND DATE '2032-12-31'
 OR ((p_after_due IS NULL) IS DISTINCT FROM (p_after_id IS NULL))
 THEN RAISE EXCEPTION USING ERRCODE='P6800',MESSAGE='INVALID_DUE_QUEUE'; END IF;
 RETURN QUERY SELECT t.task_id,t.lead_id,t.title,t.due_date::text,
  t.status,t.revision,t.created_by,t.updated_by,t.created_at,t.completed_at,
  l.company_name,t.due_date::text
 FROM p4_r64_ci.lead_tasks t
 JOIN p4_r57_ci.leads l ON l.org_id=t.org_id AND l.lead_id=t.lead_id
 WHERE t.org_id=p_org AND t.status='OPEN' AND t.due_date<=p_through
  AND (p_after_due IS NULL OR
   (t.due_date,t.task_id)>(p_after_due,p_after_id))
 ORDER BY t.due_date ASC,t.task_id ASC LIMIT 21;
END $body$;
REVOKE ALL ON FUNCTION
 p4_r68_ci.owner_due_queue(uuid,date,date,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION
 p4_r68_ci.owner_due_queue(uuid,date,date,uuid)
 TO p4_synthetic_ci_runtime;
COMMIT;
