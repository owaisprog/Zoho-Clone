-- P4 R47: owner-scoped, redacted invitation search over disposable CI.
-- No token hashes, delivery ciphertext, external user subjects, or Neon changes.
\set ON_ERROR_STOP on
BEGIN;
DO $guard$
BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci'
 OR current_user<>'demo_ci'
 OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
 OR EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='p4_r47_ci')
 OR to_regprocedure('p4_r40_ci.require_current_owner(uuid)') IS NULL
 THEN RAISE EXCEPTION 'P4_R47_DISPOSABLE_CI_ONLY'; END IF;
END $guard$;
CREATE SCHEMA p4_r47_ci;
REVOKE ALL ON SCHEMA p4_r47_ci FROM PUBLIC;
GRANT USAGE ON SCHEMA p4_r47_ci TO p4_synthetic_ci_runtime;
CREATE FUNCTION p4_r47_ci.owner_invitations(
 p_org uuid,p_status text,p_search text
) RETURNS TABLE (
 id uuid,org_id uuid,recipient_email text,granted_role text,
 status text,issued_at timestamptz,expires_at timestamptz,version integer
) LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $body$
BEGIN
 PERFORM p4_r40_ci.require_current_owner(p_org);
 IF p_status IS NULL OR p_status NOT IN (
   'all','pending','accepted','revoked','expired')
  OR p_search IS NULL OR length(p_search)>40
  OR p_search !~ '^[a-z0-9._@-]*$'
 THEN RAISE EXCEPTION USING ERRCODE='P4700',
   MESSAGE='INVALID_INVITATION_DIRECTORY_QUERY'; END IF;
 RETURN QUERY
 WITH candidates AS (
  SELECT i.id,i.org_id,i.recipient_email,i.granted_role,
   CASE WHEN i.status='pending' AND i.expires_at<=clock_timestamp()
     THEN 'expired' ELSE i.status END::text AS display_status,
   i.issued_at,i.expires_at,i.version
  FROM p4_synthetic.invitations i WHERE i.org_id=p_org
 )
 SELECT c.id,c.org_id,c.recipient_email::text,c.granted_role::text,
  c.display_status,c.issued_at,c.expires_at,c.version
 FROM candidates c
 WHERE (p_status='all' OR c.display_status=p_status)
  AND (p_search='' OR strpos(lower(c.recipient_email),p_search)>0)
 ORDER BY c.issued_at DESC,c.id DESC
 LIMIT 21;
END $body$;
REVOKE ALL ON FUNCTION p4_r47_ci.owner_invitations(uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p4_r47_ci.owner_invitations(uuid,text,text)
 TO p4_synthetic_ci_runtime;
COMMIT;
