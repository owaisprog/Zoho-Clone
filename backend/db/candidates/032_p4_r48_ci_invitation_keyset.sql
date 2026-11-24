-- P4 R48: narrow keyset paginated invitation directory for disposable CI only.
\set ON_ERROR_STOP on
BEGIN;
DO $guard$ BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci'
  OR current_user<>'demo_ci'
  OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
  OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='p4_r48_ci')
  OR to_regprocedure('p4_r40_ci.require_current_owner(uuid)') IS NULL
 THEN RAISE EXCEPTION 'P4_R48_CI_ONLY'; END IF;
END $guard$;
CREATE SCHEMA p4_r48_ci;
REVOKE ALL ON SCHEMA p4_r48_ci FROM PUBLIC;
GRANT USAGE ON SCHEMA p4_r48_ci TO p4_synthetic_ci_runtime;
CREATE FUNCTION p4_r48_ci.owner_invitation_page(
 p_org uuid,p_status text,p_search text,
 p_after_time timestamptz,p_after_id uuid
) RETURNS TABLE(
 id uuid,org_id uuid,recipient_email text,granted_role text,
 status text,issued_at timestamptz,expires_at timestamptz,version integer,
 key_time text
) LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $body$
BEGIN
 PERFORM p4_r40_ci.require_current_owner(p_org);
 IF p_status IS NULL OR p_status NOT IN ('all','pending','accepted','revoked','expired')
  OR p_search IS NULL OR length(p_search)>40 OR p_search !~ '^[a-z0-9._@-]*$'
  OR ((p_after_time IS NULL) IS DISTINCT FROM (p_after_id IS NULL))
 THEN RAISE EXCEPTION USING ERRCODE='P4700',MESSAGE='INVALID_PAGE'; END IF;
 RETURN QUERY
 WITH items AS (
  SELECT i.id,i.org_id,i.recipient_email,i.granted_role,
   CASE WHEN i.status='pending' AND i.expires_at<=clock_timestamp()
    THEN 'expired' ELSE i.status END::text AS display_status,
   i.issued_at,i.expires_at,i.version
  FROM p4_synthetic.invitations i WHERE i.org_id=p_org
 )
 SELECT v.id,v.org_id,v.recipient_email::text,v.granted_role::text,
  v.display_status,v.issued_at,v.expires_at,v.version,
 to_char(v.issued_at AT TIME ZONE 'UTC',
 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')::text AS key_time
 FROM items v
 WHERE (p_status='all' OR v.display_status=p_status)
  AND (p_search='' OR strpos(lower(v.recipient_email),p_search)>0)
  AND (p_after_time IS NULL OR (v.issued_at,v.id)<(p_after_time,p_after_id))
 ORDER BY v.issued_at DESC,v.id DESC
 LIMIT 21;
END $body$;
REVOKE ALL ON FUNCTION p4_r48_ci.owner_invitation_page(uuid,text,text,timestamptz,uuid)
 FROM PUBLIC;
GRANT EXECUTE ON FUNCTION
 p4_r48_ci.owner_invitation_page(uuid,text,text,timestamptz,uuid)
 TO p4_synthetic_ci_runtime;
COMMIT;
