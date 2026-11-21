-- P4 Batch 14: fictional CI-only organization and role policy metadata.
-- Depends on candidates 010,013,016,017. Never apply to Neon/staging/production.
\set ON_ERROR_STOP on
BEGIN;
DO $guard$
BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' OR current_user<>'demo_ci'
   OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
   OR NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='p4_r13_ci')
   OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='p4_r14_ci') THEN
  RAISE EXCEPTION 'P4 R14 ONLY in clean disposable GitHub CI';
 END IF;
END $guard$;
CREATE SCHEMA p4_r14_ci;
REVOKE ALL ON SCHEMA p4_r14_ci FROM PUBLIC;

-- CI-only SECURITY DEFINER reads current membership, business roles and
-- entitlement from bootstrap-owned tables. Production owner/credential
-- architecture remains an explicit OPEN security gate.
CREATE FUNCTION p4_r14_ci.can_read(p_org uuid, p_resource text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog AS $f$
 SELECT p_org::text=NULLIF(current_setting('app.tenant_id',true),'')
 AND EXISTS(
  SELECT 1 FROM p4_r7_ci.memberships m
  JOIN p4_r7_ci.role_grants r ON
   r.organization_id=m.organization_id AND r.actor_id=m.actor_id
  JOIN p4_r7_ci.app_grants a ON
   a.organization_id=m.organization_id AND a.app_code='platform'
  WHERE m.organization_id=p_org
    AND m.actor_id::text=NULLIF(current_setting('app.actor_id',true),'')
    AND m.active AND r.active AND a.active
    AND (
      (p_resource='organization'
       AND r.role_code IN ('ORG_OWNER','ORG_ADMIN','BILLING_ADMIN','SECURITY_REVIEWER'))
      OR (p_resource='role_grants'
       AND r.role_code IN ('ORG_OWNER','ORG_ADMIN','SECURITY_REVIEWER'))
    )
 )
$f$;
REVOKE ALL ON FUNCTION p4_r14_ci.can_read(uuid,text) FROM PUBLIC;

-- Owner and admin may inspect safe organization display metadata; billing
-- and reviewer only get the opaque org ID, never slug/owner/creator.
CREATE FUNCTION p4_r14_ci.read_organization()
RETURNS TABLE(org_id uuid,display_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $f$
 SELECT o.id::uuid,
 CASE WHEN EXISTS(
  SELECT 1 FROM p4_r7_ci.role_grants r
  WHERE r.organization_id=o.id AND
    r.actor_id::text=NULLIF(current_setting('app.actor_id',true),'')
    AND r.active AND r.role_code IN ('ORG_OWNER','ORG_ADMIN'))
 THEN o.display_name ELSE NULL::text END
 FROM p4_v1_ci.organizations o
 WHERE o.id::text=NULLIF(current_setting('app.tenant_id',true),'')
  AND p4_r14_ci.can_read(o.id::uuid,'organization')
 LIMIT 1
$f$;
REVOKE ALL ON FUNCTION p4_r14_ci.read_organization() FROM PUBLIC;

-- No member/actor identifiers, email/subject, grant creation dates or audit.
-- Org admin never enumerates reserved owner/security/platform roles.
-- Reviewer only sees policy role codes, with counts redacted to NULL.
CREATE FUNCTION p4_r14_ci.read_role_summaries()
RETURNS TABLE(org_id uuid,role_code text,active_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $f$
 SELECT r.organization_id::uuid,r.role_code,
 CASE WHEN EXISTS(
  SELECT 1 FROM p4_r7_ci.role_grants own
  WHERE own.organization_id=r.organization_id
    AND own.actor_id::text=NULLIF(current_setting('app.actor_id',true),'')
    AND own.active AND own.role_code IN ('ORG_OWNER','ORG_ADMIN'))
 THEN count(DISTINCT r.actor_id) ELSE NULL::bigint END
 FROM p4_r7_ci.role_grants r
 JOIN p4_r7_ci.memberships m ON
   m.organization_id=r.organization_id AND m.actor_id=r.actor_id
 WHERE r.organization_id::text=NULLIF(current_setting('app.tenant_id',true),'')
   AND r.active AND m.active
   AND p4_r14_ci.can_read(r.organization_id::uuid,'role_grants')
   AND (
      NOT EXISTS(
       SELECT 1 FROM p4_r7_ci.role_grants own
       WHERE own.organization_id=r.organization_id
         AND own.actor_id::text=NULLIF(current_setting('app.actor_id',true),'')
         AND own.active AND own.role_code='ORG_ADMIN'
      )
      OR r.role_code IN ('SALES_REP','SALES_MANAGER','ONBOARDING_MANAGER',
                         'ONBOARDING_COORDINATOR','AGENT_MANAGER','BILLING_ADMIN')
   )
 GROUP BY r.organization_id,r.role_code
 ORDER BY r.role_code
 LIMIT 21
$f$;
REVOKE ALL ON FUNCTION p4_r14_ci.read_role_summaries() FROM PUBLIC;
GRANT USAGE ON SCHEMA p4_r14_ci TO p4_v1_ci_runtime;
GRANT EXECUTE ON FUNCTION p4_r14_ci.read_organization() TO p4_v1_ci_runtime;
GRANT EXECUTE ON FUNCTION p4_r14_ci.read_role_summaries() TO p4_v1_ci_runtime;
-- No direct access to organizations, role tables, issuer mapping, tokens or writes.
COMMIT;
