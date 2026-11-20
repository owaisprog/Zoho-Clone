-- P4 EXIT: SQL tests for exact provider subject lookup (CI only).
\set ON_ERROR_STOP on
DO $guard$
BEGIN
 IF current_database() <> 'zoho_clone_synthetic_ci' THEN
  RAISE EXCEPTION 'P4 identity lookup acceptance is only allowed in CI';
 END IF;
END $guard$;
SET ROLE p4_synthetic_ci_identity_lookup;
DO $test$
BEGIN
 IF current_user <> 'p4_synthetic_ci_identity_lookup' OR
    (SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname=current_user) THEN
  RAISE EXCEPTION 'Restricted role was not used';
 END IF;
 IF (SELECT count(*) FROM p4_synthetic.lookup_verified_subject('https://demo.us.auth0.com/','auth0|demo-alice')
     WHERE user_id='user_demo_alice' AND email_verified=true)<>1 THEN
  RAISE EXCEPTION 'Exact verified subject mapping missing';
 END IF;
 IF (SELECT count(*) FROM p4_synthetic.lookup_verified_subject('https://demo.us.auth0.com/','auth0|demo-bob')
     WHERE user_id='user_demo_bob' AND email_verified=false)<>1 THEN
  RAISE EXCEPTION 'Unverified subject mismatch';
 END IF;
 IF (SELECT count(*) FROM p4_synthetic.lookup_verified_subject('https://evil.us.auth0.com/','auth0|demo-alice'))<>0 OR
    (SELECT count(*) FROM p4_synthetic.lookup_verified_subject('https://demo.us.auth0.com/','auth0|unknown'))<>0 THEN
  RAISE EXCEPTION 'Cross-issuer/subject mapping leak';
 END IF;
 BEGIN
  PERFORM count(*) FROM p4_synthetic.identity_subjects;
  RAISE EXCEPTION 'Identity resolver role obtained generic identity SELECT';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
  PERFORM count(*) FROM p4_synthetic.memberships;
  RAISE EXCEPTION 'Identity resolver role obtained generic membership SELECT';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $test$;
RESET ROLE;
SELECT 'P4 exit CI-only verified subject identity lookup PASS' AS result;
