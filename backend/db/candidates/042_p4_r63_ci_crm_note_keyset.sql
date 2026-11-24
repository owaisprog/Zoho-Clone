-- R63: immutable CRM follow-up notes keyset, disposable CI only.
\set ON_ERROR_STOP on
BEGIN;
DO $guard$ BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' OR current_user<>'demo_ci'
 OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
 OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='p4_r63_ci')
 OR to_regprocedure('p4_r40_ci.require_current_owner(uuid)') IS NULL
 OR to_regclass('p4_r61_ci.lead_notes') IS NULL
 THEN RAISE EXCEPTION 'P4_R63_CI_ONLY'; END IF;
END $guard$;
CREATE SCHEMA p4_r63_ci;
REVOKE ALL ON SCHEMA p4_r63_ci FROM PUBLIC;
GRANT USAGE ON SCHEMA p4_r63_ci TO p4_synthetic_ci_runtime;
CREATE FUNCTION p4_r63_ci.owner_note_page(
 p_org uuid,p_lead uuid,p_after_time timestamptz,p_after_id uuid
) RETURNS TABLE(note_id uuid,lead_id uuid,note_text text,
 actor_user_id text,created_at timestamptz,key_time text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $body$
BEGIN
 PERFORM p4_r40_ci.require_current_owner(p_org);
 IF p_lead IS NULL OR ((p_after_time IS NULL) IS DISTINCT FROM
  (p_after_id IS NULL))
 THEN RAISE EXCEPTION USING ERRCODE='P6300',MESSAGE='INVALID_NOTE_PAGE'; END IF;
 IF NOT EXISTS(SELECT 1 FROM p4_r57_ci.leads l
  WHERE l.org_id=p_org AND l.lead_id=p_lead)
 THEN RAISE EXCEPTION USING ERRCODE='P4009',MESSAGE='LEAD_NOT_FOUND'; END IF;
 RETURN QUERY SELECT n.note_id,n.lead_id,n.note_text,n.actor_user_id,
  n.created_at,to_char(n.created_at AT TIME ZONE 'UTC',
   'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')::text
 FROM p4_r61_ci.lead_notes n
 WHERE n.org_id=p_org AND n.lead_id=p_lead
  AND (p_after_time IS NULL OR
    (n.created_at,n.note_id)<(p_after_time,p_after_id))
 ORDER BY n.created_at DESC,n.note_id DESC LIMIT 21;
END $body$;
REVOKE ALL ON FUNCTION
 p4_r63_ci.owner_note_page(uuid,uuid,timestamptz,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION
 p4_r63_ci.owner_note_page(uuid,uuid,timestamptz,uuid)
 TO p4_synthetic_ci_runtime;
COMMIT;
