-- P4 Batch 13: disposable-only live-team metadata reader.
-- WARNING: SECURITY DEFINER is CI bootstrap proof, not production privilege design.
-- Depends on P4 R11 candidate 016. No Neon, live tenant, Auth0 or mutation.
\set ON_ERROR_STOP on
BEGIN;
DO $guard$
BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' OR current_user<>'demo_ci'
   OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
   OR NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='p4_r11_ci')
   OR EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='p4_r13_ci') THEN
  RAISE EXCEPTION 'P4 R13 only on fresh disposable GitHub CI schema';
 END IF;
END $guard$;
CREATE SCHEMA p4_r13_ci;
REVOKE ALL ON SCHEMA p4_r13_ci FROM PUBLIC;

-- This helper examines current business grants, not legacy OWNER/MEMBER or JWT roles.
-- Organization managers can see only teams they CURRENTLY manage.
CREATE FUNCTION p4_r13_ci.read_team_summaries()
RETURNS TABLE(org_id uuid,team_id uuid,team_name text,member_count bigint,is_manager boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $fn$
 SELECT t.organization_id::uuid,t.id::uuid,t.title,
  (SELECT count(*) FROM p4_r7_ci.team_grants g
   JOIN p4_r7_ci.memberships gm
     ON gm.organization_id=g.organization_id AND gm.actor_id=g.actor_id
   WHERE g.organization_id=t.organization_id AND g.team_id=t.id
     AND g.active AND gm.active),
  EXISTS(SELECT 1 FROM p4_r7_ci.team_grants mine
   WHERE mine.organization_id=t.organization_id AND mine.team_id=t.id
     AND mine.actor_id::text=NULLIF(current_setting('app.actor_id',true),'')
     AND mine.active AND mine.managed)
 FROM p4_v1_ci.teams t
 WHERE t.organization_id::text=NULLIF(current_setting('app.tenant_id',true),'')
   AND EXISTS(SELECT 1 FROM p4_r7_ci.memberships m
     JOIN p4_r7_ci.role_grants r
       ON r.organization_id=m.organization_id AND r.actor_id=m.actor_id
     JOIN p4_r7_ci.app_grants a
       ON a.organization_id=m.organization_id AND a.app_code='platform'
     WHERE m.organization_id=t.organization_id
       AND m.actor_id::text=NULLIF(current_setting('app.actor_id',true),'')
       AND m.active AND r.active AND a.active
       AND (r.role_code IN ('ORG_OWNER','ORG_ADMIN','SECURITY_REVIEWER')
         OR (r.role_code='SALES_MANAGER'
           AND EXISTS(SELECT 1 FROM p4_r7_ci.team_grants own
             WHERE own.organization_id=t.organization_id AND own.team_id=t.id
               AND own.actor_id=m.actor_id AND own.active AND own.managed))))
 ORDER BY t.id
 LIMIT 21
$fn$;
REVOKE ALL ON FUNCTION p4_r13_ci.read_team_summaries() FROM PUBLIC;
GRANT USAGE ON SCHEMA p4_r13_ci TO p4_v1_ci_runtime;
GRANT EXECUTE ON FUNCTION p4_r13_ci.read_team_summaries() TO p4_v1_ci_runtime;

-- Direct table reading remains denied. Zero grants to the runtime for teams,
-- membership identifiers other than existing R7 self-grants, or invite secrets.
COMMIT;
