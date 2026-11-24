-- P4 R49: scoped owner member keyset, disposable CI only.
\set ON_ERROR_STOP on
BEGIN;
DO $g$ BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci'
 OR current_user<>'demo_ci'
 OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
 OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='p4_r49_ci')
 OR to_regprocedure('p4_r40_ci.require_current_owner(uuid)') IS NULL
 THEN RAISE EXCEPTION 'P4_R49_CI_ONLY'; END IF;
END $g$;
CREATE SCHEMA p4_r49_ci;
REVOKE ALL ON SCHEMA p4_r49_ci FROM PUBLIC;
GRANT USAGE ON SCHEMA p4_r49_ci TO p4_synthetic_ci_runtime;
CREATE FUNCTION p4_r49_ci.owner_member_page(
 p_org uuid,p_status text,p_search text,p_after text
) RETURNS TABLE(user_id text,email text,role_code text,
 revision integer,active boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $body$
BEGIN
 PERFORM p4_r40_ci.require_current_owner(p_org);
 IF p_status IS NULL OR p_status NOT IN ('all','active','revoked')
 OR p_search IS NULL OR length(p_search)>40
 OR p_search !~ '^[a-z0-9._@-]*$'
 OR (p_after IS NOT NULL AND p_after !~ '^user_demo_[a-z]{2,16}$')
 THEN RAISE EXCEPTION USING ERRCODE='P4900',
  MESSAGE='INVALID_MEMBER_PAGE'; END IF;
 RETURN QUERY
 SELECT m.user_id,
        identity_email.email::text,
        coalesce(r.role_code,'SALES_REP')::text,
        coalesce(r.revision,0)::integer,m.active
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
  AND (p_status='all' OR (p_status='active' AND m.active)
   OR (p_status='revoked' AND NOT m.active))
  AND (p_search='' OR strpos(lower(m.user_id),p_search)>0
   OR strpos(lower(coalesce(identity_email.email,'')),p_search)>0)
  AND (p_after IS NULL OR m.user_id>p_after)
 ORDER BY m.user_id
 LIMIT 21;
END $body$;
REVOKE ALL ON FUNCTION p4_r49_ci.owner_member_page(uuid,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p4_r49_ci.owner_member_page(uuid,text,text,text)
 TO p4_synthetic_ci_runtime;
COMMIT;
