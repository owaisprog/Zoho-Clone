-- P4 R42: bounded read-only signed-owner event history in disposable CI.
-- No deployment or owner Neon migration. R40 transaction and audit unchanged.
\set ON_ERROR_STOP on
BEGIN;
DO $$
BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci'
 OR current_user<>'demo_ci'
 OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
 OR NOT EXISTS(SELECT 1 FROM pg_proc
   WHERE oid=to_regprocedure('p4_r40_ci.require_current_owner(uuid)'))
 THEN RAISE EXCEPTION 'P4_R42_DISPOSABLE_CI_ONLY'; END IF;
END $$;
CREATE FUNCTION p4_r40_ci.read_member_role_history(p_org uuid)
RETURNS TABLE(actor_user_id text,target_user_id text,
 before_role text,after_role text,revision integer,occurred_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM p4_r40_ci.require_current_owner(p_org);
 RETURN QUERY
 SELECT e.actor_user_id,e.target_user_id,e.before_role,e.after_role,
        e.revision,e.occurred_at
 FROM p4_r40_ci.role_events e
 WHERE e.org_id=p_org
 ORDER BY e.occurred_at DESC,e.request_id DESC
 LIMIT 21;
END $$;
REVOKE ALL ON FUNCTION p4_r40_ci.read_member_role_history(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p4_r40_ci.read_member_role_history(uuid)
 TO p4_synthetic_ci_runtime;
-- Explicitly no SELECT/UPDATE/DELETE on immutable event records.
COMMIT;
