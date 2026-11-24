-- R60: scoped CRM lead keyset pages in disposable CI PostgreSQL only.
\set ON_ERROR_STOP on
BEGIN;
DO $guard$ BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci'
 OR current_user<>'demo_ci'
 OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
 OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='p4_r60_ci')
 OR to_regprocedure('p4_r40_ci.require_current_owner(uuid)') IS NULL
 OR to_regclass('p4_r57_ci.leads') IS NULL
 THEN RAISE EXCEPTION 'P4_R60_CI_ONLY'; END IF;
END $guard$;
CREATE SCHEMA p4_r60_ci;
REVOKE ALL ON SCHEMA p4_r60_ci FROM PUBLIC;
GRANT USAGE ON SCHEMA p4_r60_ci TO p4_synthetic_ci_runtime;
CREATE FUNCTION p4_r60_ci.owner_crm_lead_page(
 p_org uuid,p_status text,p_search text,
 p_after_time timestamptz,p_after_id uuid
) RETURNS TABLE(
 lead_id uuid,company_name text,contact_email text,
 source text,status text,revision integer,created_at timestamptz,key_time text
) LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $body$
BEGIN
 PERFORM p4_r40_ci.require_current_owner(p_org);
 IF p_status IS NULL OR p_status NOT IN
  ('all','NEW','CONTACTED','QUALIFIED','LOST')
  OR p_search IS NULL OR length(p_search)>40
  OR p_search !~ '^[a-z0-9._@ -]*$'
  OR ((p_after_time IS NULL) IS DISTINCT FROM (p_after_id IS NULL))
 THEN RAISE EXCEPTION USING ERRCODE='P6000',MESSAGE='INVALID_PAGE'; END IF;
 RETURN QUERY SELECT l.lead_id,l.company_name,l.contact_email,
  l.source,l.status,l.revision,l.created_at,
  to_char(l.created_at AT TIME ZONE 'UTC',
   'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')::text
 FROM p4_r57_ci.leads l
 WHERE l.org_id=p_org
  AND (p_status='all' OR l.status=p_status)
  AND (p_search='' OR strpos(lower(l.company_name),p_search)>0
   OR strpos(lower(l.contact_email),p_search)>0)
  AND (p_after_time IS NULL OR
   (l.created_at,l.lead_id)<(p_after_time,p_after_id))
 ORDER BY l.created_at DESC,l.lead_id DESC
 LIMIT 21;
END $body$;
REVOKE ALL ON FUNCTION
 p4_r60_ci.owner_crm_lead_page(uuid,text,text,timestamptz,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION
 p4_r60_ci.owner_crm_lead_page(uuid,text,text,timestamptz,uuid)
 TO p4_synthetic_ci_runtime;
COMMIT;
