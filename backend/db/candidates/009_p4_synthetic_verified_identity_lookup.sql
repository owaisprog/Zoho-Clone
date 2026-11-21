-- P4 EXIT: disposable CI-only verified subject mapping function.
-- This is NOT a Neon migration or an Auth0 identity certification.
\set ON_ERROR_STOP on
BEGIN;
DO $guard$
BEGIN
 IF current_database() <> 'zoho_clone_synthetic_ci'
 OR NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='p4_synthetic')
 OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='p4_synthetic_ci_runtime') THEN
  RAISE EXCEPTION 'P4 identity bridge must run only in disposable CI';
 END IF;
END $guard$;

-- A purpose-specific role executes an exact issuer+subject mapping lookup.
-- It receives NO generic membership, user, profile or tenant SELECT grants.
CREATE ROLE p4_synthetic_ci_identity_lookup NOLOGIN
 NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
GRANT USAGE ON SCHEMA p4_synthetic TO p4_synthetic_ci_identity_lookup;

CREATE FUNCTION p4_synthetic.lookup_verified_subject(p_issuer text, p_subject text)
RETURNS TABLE(user_id text, email_verified boolean)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, p4_synthetic
AS $lookup$
 SELECT ids.user_id, ids.email_verified
 FROM p4_synthetic.identity_subjects ids
 WHERE ids.issuer = p_issuer AND ids.external_subject = p_subject
 LIMIT 1
$lookup$;
REVOKE ALL ON FUNCTION p4_synthetic.lookup_verified_subject(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p4_synthetic.lookup_verified_subject(text,text)
 TO p4_synthetic_ci_identity_lookup;
COMMIT;
