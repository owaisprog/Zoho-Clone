-- P4 Batch 15: bounded, read-only audit keyset on fictional tenants.
-- Disposable CI only; not a Neon schema migration or production access path.
\set ON_ERROR_STOP on
BEGIN;
DO $guard$
BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' OR current_user<>'demo_ci'
 OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
 OR NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='p4_r14_ci')
 OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='p4_r15_ci') THEN
  RAISE EXCEPTION 'P4 R15 requires fresh disposable GitHub CI';
 END IF;
END $guard$;
CREATE SCHEMA p4_r15_ci;
REVOKE ALL ON SCHEMA p4_r15_ci FROM PUBLIC;
-- Underlying audit table retains private raw_payload; never project it.
CREATE INDEX p4_r15_audit_tenant_cursor_idx
 ON p4_r11_ci.audit_status(organization_id,id);

CREATE FUNCTION p4_r15_ci.read_audit_page(p_after uuid,p_max integer)
RETURNS TABLE(org_id uuid,event_id uuid,actor_id uuid,
 action_code text,occurred_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $fn$
 SELECT a.organization_id::uuid,a.id::uuid,a.actor_user_id::uuid,
        a.action,a.occurred_at
 FROM p4_r11_ci.audit_status a
 WHERE a.organization_id::text=NULLIF(current_setting('app.tenant_id',true),'')
  AND (p_after IS NULL OR a.id::uuid>p_after)
  AND p_max BETWEEN 1 AND 21
  AND EXISTS(
   SELECT 1 FROM p4_r7_ci.memberships m
   JOIN p4_r7_ci.role_grants r
    ON r.organization_id=m.organization_id AND r.actor_id=m.actor_id
   JOIN p4_r7_ci.app_grants app
    ON app.organization_id=m.organization_id AND app.app_code='platform'
   WHERE m.organization_id=a.organization_id
    AND m.actor_id::text=NULLIF(current_setting('app.actor_id',true),'')
    AND m.active AND r.active AND app.active
    AND r.role_code IN ('ORG_OWNER','SECURITY_REVIEWER')
  )
 ORDER BY a.id
 LIMIT LEAST(p_max,21)
$fn$;
REVOKE ALL ON FUNCTION p4_r15_ci.read_audit_page(uuid,integer) FROM PUBLIC;
GRANT USAGE ON SCHEMA p4_r15_ci TO p4_v1_ci_runtime;
GRANT EXECUTE ON FUNCTION p4_r15_ci.read_audit_page(uuid,integer) TO p4_v1_ci_runtime;
-- No SELECT on underlying private columns, no write permissions.
COMMIT;
