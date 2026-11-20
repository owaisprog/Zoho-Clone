-- Phase 4 Batch 09: fictional audited role/team toggle rehearsal.
-- NEVER execute on Neon/staging/production. This is NOT a deployed write API.
-- Only CI bootstrap fixture mutations (demo_ci) are allowed, after a
-- transaction-local verified organization and ORG_OWNER actor context.
\set ON_ERROR_STOP on
BEGIN;
DO $guard$
BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' OR current_user<>'demo_ci'
   OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
   OR NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='p4_r7_ci')
   OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='p4_r9_ci') THEN
  RAISE EXCEPTION 'P4 R9 candidate 014 is disposable GitHub CI only';
 END IF;
END $guard$;
CREATE SCHEMA p4_r9_ci;
REVOKE ALL ON SCHEMA p4_r9_ci FROM PUBLIC;
CREATE TABLE p4_r9_ci.change_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id p4_v1_ci.internal_id NOT NULL,
  actor_id p4_v1_ci.internal_id NOT NULL,
  target_actor_id p4_v1_ci.internal_id NOT NULL,
  entity_code text NOT NULL CHECK(entity_code IN ('role_grant','team_grant')),
  target_ref text NOT NULL CHECK(length(target_ref) BETWEEN 2 AND 90),
  before_active boolean NOT NULL,
  after_active boolean NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK(before_active<>after_active),
  FOREIGN KEY(organization_id,actor_id)
   REFERENCES p4_r7_ci.memberships(organization_id,actor_id),
  FOREIGN KEY(organization_id,target_actor_id)
   REFERENCES p4_r7_ci.memberships(organization_id,actor_id)
);
CREATE INDEX p4_r9_audit_org_time_idx
 ON p4_r9_ci.change_audit(organization_id,occurred_at,id);
ALTER TABLE p4_r9_ci.change_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE p4_r9_ci.change_audit FORCE ROW LEVEL SECURITY;
-- No select or DML grants to application RLS runtime or identity role.
REVOKE ALL ON p4_r9_ci.change_audit FROM PUBLIC;
CREATE FUNCTION p4_r9_ci.rehearsal_guard_and_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=pg_catalog AS $fn$
DECLARE
 v_org uuid;
 v_actor uuid;
 v_kind text;
 v_ref text;
BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci'
   OR session_user<>'demo_ci' THEN
   RAISE EXCEPTION 'CI_ONLY_ROLE_TEAM_CHANGE_DENIED';
 END IF;
 IF TG_OP<>'UPDATE' THEN
   RAISE EXCEPTION 'CI_ONLY_ROLE_TEAM_CHANGE_DENIED';
 END IF;
 IF TG_TABLE_NAME='role_grants' THEN
   IF OLD.organization_id<>NEW.organization_id OR
      OLD.actor_id<>NEW.actor_id OR OLD.role_code<>NEW.role_code OR
      OLD.role_code NOT IN ('SALES_REP','SALES_MANAGER') THEN
      RAISE EXCEPTION 'CI_ONLY_ROLE_TEAM_CHANGE_DENIED';
   END IF;
   v_kind:='role_grant'; v_ref:=OLD.role_code;
 ELSIF TG_TABLE_NAME='team_grants' THEN
   IF OLD.organization_id<>NEW.organization_id OR
      OLD.actor_id<>NEW.actor_id OR OLD.team_id<>NEW.team_id OR
      OLD.managed<>NEW.managed THEN
      RAISE EXCEPTION 'CI_ONLY_ROLE_TEAM_CHANGE_DENIED';
   END IF;
   v_kind:='team_grant'; v_ref:=OLD.team_id::text;
 ELSE
   RAISE EXCEPTION 'CI_ONLY_ROLE_TEAM_CHANGE_DENIED';
 END IF;
 IF OLD.active IS NOT DISTINCT FROM NEW.active THEN
   RETURN NEW;
 END IF;
 BEGIN
   v_org:=nullif(current_setting('app.tenant_id',true),'')::uuid;
   v_actor:=nullif(current_setting('app.actor_id',true),'')::uuid;
 EXCEPTION WHEN OTHERS THEN
   RAISE EXCEPTION 'CI_ONLY_ROLE_TEAM_CHANGE_DENIED';
 END;
 IF v_org IS NULL OR v_actor IS NULL OR v_org<>OLD.organization_id
   OR NOT EXISTS(SELECT 1 FROM p4_r7_ci.memberships m
      WHERE m.organization_id=v_org AND m.actor_id=v_actor AND m.active)
   OR NOT EXISTS(SELECT 1 FROM p4_r7_ci.role_grants r
      WHERE r.organization_id=v_org AND r.actor_id=v_actor
        AND r.role_code='ORG_OWNER' AND r.active)
   OR NOT EXISTS(SELECT 1 FROM p4_r7_ci.memberships t
      WHERE t.organization_id=OLD.organization_id
        AND t.actor_id=OLD.actor_id AND t.active) THEN
   RAISE EXCEPTION 'CI_ONLY_ROLE_TEAM_CHANGE_DENIED';
 END IF;
 INSERT INTO p4_r9_ci.change_audit(
   organization_id,actor_id,target_actor_id,entity_code,target_ref,
   before_active,after_active
 ) VALUES (
   OLD.organization_id,v_actor,OLD.actor_id,v_kind,v_ref,
   OLD.active,NEW.active
 );
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION p4_r9_ci.rehearsal_guard_and_audit() FROM PUBLIC;
CREATE TRIGGER p4_r9_role_change_rehearsal
 BEFORE UPDATE ON p4_r7_ci.role_grants
 FOR EACH ROW EXECUTE FUNCTION p4_r9_ci.rehearsal_guard_and_audit();
CREATE TRIGGER p4_r9_team_change_rehearsal
 BEFORE UPDATE ON p4_r7_ci.team_grants
 FOR EACH ROW EXECUTE FUNCTION p4_r9_ci.rehearsal_guard_and_audit();
CREATE FUNCTION p4_r9_ci.audit_immutable()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $imm$
BEGIN
 RAISE EXCEPTION 'P4_R9_CI_AUDIT_IMMUTABLE';
END $imm$;
REVOKE ALL ON FUNCTION p4_r9_ci.audit_immutable() FROM PUBLIC;
CREATE TRIGGER p4_r9_audit_immutable
 BEFORE UPDATE OR DELETE ON p4_r9_ci.change_audit
 FOR EACH ROW EXECUTE FUNCTION p4_r9_ci.audit_immutable();
COMMIT;
