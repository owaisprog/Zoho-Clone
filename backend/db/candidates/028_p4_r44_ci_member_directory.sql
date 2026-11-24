-- P4 R44: owner-only searchable CI membership directory.
-- Disposable zoho_clone_synthetic_ci only; NOT a Neon/staging/prod migration.
\set ON_ERROR_STOP on
BEGIN;
DO $guard$
BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci'
    OR current_user<>'demo_ci'
    OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
    OR to_regprocedure('p4_r40_ci.require_current_owner(uuid)') IS NULL
    OR EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='p4_r44_ci')
 THEN RAISE EXCEPTION 'P4_R44_DISPOSABLE_CI_ONLY'; END IF;
END $guard$;
CREATE SCHEMA p4_r44_ci;
REVOKE ALL ON SCHEMA p4_r44_ci FROM PUBLIC;
GRANT USAGE ON SCHEMA p4_r44_ci TO p4_synthetic_ci_runtime;

-- Explicit owner-authorized projection. Only synthetic MEMBER records, never
-- owners, external identity subject strings, raw tokens or audit internals.
-- Query is a literal substring, not SQL LIKE / wildcard interpretation.
CREATE FUNCTION p4_r44_ci.search_member_directory(
 p_org uuid,p_status text,p_search text
) RETURNS TABLE (
 user_id text, email text, role_code text, revision integer, active boolean
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $body$
BEGIN
 PERFORM p4_r40_ci.require_current_owner(p_org);
 IF p_status IS NULL OR p_status NOT IN ('all','active','revoked')
  OR p_search IS NULL OR length(p_search)>40
  OR p_search !~ '^[a-z0-9._@-]*$'
 THEN RAISE EXCEPTION USING ERRCODE='P4400',
   MESSAGE='INVALID_DIRECTORY_QUERY'; END IF;
 RETURN QUERY
 SELECT m.user_id,
        identity_email.email::text,
        coalesce(r.role_code,'SALES_REP')::text,
        coalesce(r.revision,0)::integer,
        m.active
 FROM p4_synthetic.memberships m
 LEFT JOIN p4_r40_ci.sales_roles r
  ON r.org_id=m.org_id AND r.user_id=m.user_id
 LEFT JOIN LATERAL (
  SELECT min(s.canonical_email)::text AS email
  FROM p4_synthetic.identity_subjects s
  WHERE s.user_id=m.user_id AND s.email_verified=true
   AND s.canonical_email ~ '^[a-z0-9._-]+@example[.]com$'
 ) identity_email ON true
 WHERE m.org_id=p_org AND m.role='MEMBER'
  AND (p_status='all'
    OR (p_status='active' AND m.active=true)
    OR (p_status='revoked' AND m.active=false))
  AND (p_search=''
    OR strpos(lower(m.user_id),p_search)>0
    OR strpos(lower(coalesce(identity_email.email,'')),p_search)>0)
 ORDER BY m.user_id
 LIMIT 21;
END $body$;
REVOKE ALL ON FUNCTION p4_r44_ci.search_member_directory(uuid,text,text)
 FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p4_r44_ci.search_member_directory(uuid,text,text)
 TO p4_synthetic_ci_runtime;
-- Nothing new may SELECT membership or identity tables through a public API.
COMMIT;
