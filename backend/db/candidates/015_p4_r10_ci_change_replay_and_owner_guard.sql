-- P4 Batch 10: REHEARSAL ONLY, CI bootstrap fake role + fake data.
-- NEVER execute on Neon, staging, production, or with real user records.
-- Owner has NOT approved any live role/team/membership mutation endpoint.
\set ON_ERROR_STOP on
BEGIN;
DO $guard$
BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' OR current_user<>'demo_ci'
   OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
   OR NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='p4_r9_ci')
   OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='p4_r10_ci') THEN
   RAISE EXCEPTION 'P4 R10 candidate 015 is disposable CI only';
 END IF;
END $guard$;
CREATE SCHEMA p4_r10_ci;
REVOKE ALL ON SCHEMA p4_r10_ci FROM PUBLIC;

-- Demonstration of optimistic versions on existing fictional grants only.
ALTER TABLE p4_r7_ci.role_grants
 ADD COLUMN revision bigint NOT NULL DEFAULT 0 CHECK (revision>=0);
ALTER TABLE p4_r7_ci.team_grants
 ADD COLUMN revision bigint NOT NULL DEFAULT 0 CHECK (revision>=0);

-- Every successful command has exactly one durable idempotency marker in
-- the same DB transaction as the grant toggle and audit trigger in 014.
CREATE TABLE p4_r10_ci.command_log (
 organization_id p4_v1_ci.internal_id NOT NULL,
 request_id p4_v1_ci.internal_id NOT NULL,
 actor_id p4_v1_ci.internal_id NOT NULL,
 target_actor_id p4_v1_ci.internal_id NOT NULL,
 kind text NOT NULL CHECK(kind IN ('role_grant','team_grant')),
 target_ref text NOT NULL,
 before_active boolean NOT NULL,
 after_active boolean NOT NULL,
 previous_revision bigint NOT NULL CHECK(previous_revision>=0),
 applied_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(organization_id,request_id),
 CHECK(before_active<>after_active)
);
ALTER TABLE p4_r10_ci.command_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE p4_r10_ci.command_log FORCE ROW LEVEL SECURITY;
REVOKE ALL ON p4_r10_ci.command_log FROM PUBLIC;

CREATE FUNCTION p4_r10_ci.prevent_owner_transfer()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $body$
BEGIN
 -- Until last-owner ownership transfer flow is separately approved, NEVER
 -- modify an existing ORG_OWNER grant or deactivate an active owner member.
 IF TG_TABLE_NAME='role_grants' AND OLD.role_code='ORG_OWNER' THEN
   IF TG_OP='DELETE' THEN
     RAISE EXCEPTION 'P4_R10_OWNER_TRANSFER_NOT_APPROVED';
   END IF;
   IF NEW.active IS DISTINCT FROM OLD.active OR
      NEW.role_code IS DISTINCT FROM OLD.role_code OR
      NEW.actor_id IS DISTINCT FROM OLD.actor_id OR
      NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
     RAISE EXCEPTION 'P4_R10_OWNER_TRANSFER_NOT_APPROVED';
   END IF;
 ELSIF TG_TABLE_NAME='memberships' AND OLD.active AND
   EXISTS(SELECT 1 FROM p4_r7_ci.role_grants r
     WHERE r.organization_id=OLD.organization_id AND r.actor_id=OLD.actor_id
       AND r.role_code='ORG_OWNER' AND r.active) THEN
   IF TG_OP='DELETE' THEN
     RAISE EXCEPTION 'P4_R10_OWNER_TRANSFER_NOT_APPROVED';
   END IF;
   IF NEW.active IS DISTINCT FROM OLD.active OR
      NEW.actor_id IS DISTINCT FROM OLD.actor_id OR
      NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
     RAISE EXCEPTION 'P4_R10_OWNER_TRANSFER_NOT_APPROVED';
   END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $body$;
REVOKE ALL ON FUNCTION p4_r10_ci.prevent_owner_transfer() FROM PUBLIC;
CREATE TRIGGER p4_r10_ci_no_owner_grant_mutation
 BEFORE UPDATE OR DELETE ON p4_r7_ci.role_grants
 FOR EACH ROW EXECUTE FUNCTION p4_r10_ci.prevent_owner_transfer();
CREATE TRIGGER p4_r10_ci_no_owner_membership_deactivation
 BEFORE UPDATE OR DELETE ON p4_r7_ci.memberships
 FOR EACH ROW EXECUTE FUNCTION p4_r10_ci.prevent_owner_transfer();

CREATE FUNCTION p4_r10_ci.command_log_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $immutable$
BEGIN
 RAISE EXCEPTION 'P4_R10_COMMAND_LOG_IMMUTABLE';
END $immutable$;
REVOKE ALL ON FUNCTION p4_r10_ci.command_log_immutable() FROM PUBLIC;
CREATE TRIGGER p4_r10_ci_log_immutable
 BEFORE UPDATE OR DELETE ON p4_r10_ci.command_log
 FOR EACH ROW EXECUTE FUNCTION p4_r10_ci.command_log_immutable();

-- Single restricted conceptual command path in disposable CI. This function
-- uses fixture bootstrap privileges and is NOT executable by tenant runtime.
-- It deliberately cannot grant roles, change managed flags, invite anyone,
-- remove owners, perform arbitrary ACL writes or touch real data.
CREATE FUNCTION p4_r10_ci.apply_fixture_toggle(
 p_org uuid,p_actor uuid,p_target uuid,p_kind text,p_ref text,
 p_expected_active boolean,p_next_active boolean,p_expected_revision bigint,
 p_request uuid
) RETURNS text LANGUAGE plpgsql SET search_path=pg_catalog AS $command$
DECLARE
 prior p4_r10_ci.command_log%ROWTYPE;
 actual_active boolean;
 actual_revision bigint;
 team_uuid uuid;
BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci'
   OR current_user<>'demo_ci' OR session_user<>'demo_ci'
   OR nullif(current_setting('app.tenant_id',true),'') IS DISTINCT FROM p_org::text
   OR nullif(current_setting('app.actor_id',true),'') IS DISTINCT FROM p_actor::text
   OR p_actor=p_target
   OR p_expected_active IS NOT DISTINCT FROM p_next_active
   OR p_expected_revision IS NULL OR p_expected_revision<0
   OR substring(p_request::text from 15 for 1)<>'4'
   OR p_kind NOT IN ('role_grant','team_grant') THEN
   RAISE EXCEPTION 'P4_R10_CHANGE_DENIED';
 END IF;
 -- This org-level row lock serializes requests so replay checks and version
 -- changes do not race in the synthetic setup.
 PERFORM id FROM p4_v1_ci.organizations WHERE id=p_org FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM p4_r7_ci.memberships m
     JOIN p4_r7_ci.role_grants r
       ON r.organization_id=m.organization_id AND r.actor_id=m.actor_id
     WHERE m.organization_id=p_org AND m.actor_id=p_actor AND m.active
       AND r.role_code='ORG_OWNER' AND r.active)
   OR NOT EXISTS(SELECT 1 FROM p4_r7_ci.memberships m
     WHERE m.organization_id=p_org AND m.actor_id=p_target AND m.active) THEN
   RAISE EXCEPTION 'P4_R10_CHANGE_DENIED';
 END IF;
 SELECT * INTO prior FROM p4_r10_ci.command_log
  WHERE organization_id=p_org AND request_id=p_request FOR UPDATE;
 IF FOUND THEN
   IF prior.actor_id=p_actor AND prior.target_actor_id=p_target
     AND prior.kind=p_kind AND prior.target_ref=p_ref
     AND prior.before_active=p_expected_active
     AND prior.after_active=p_next_active
     AND prior.previous_revision=p_expected_revision THEN
     RETURN 'REPLAY_NO_CHANGE';
   END IF;
   RAISE EXCEPTION 'P4_R10_REPLAY_CONFLICT';
 END IF;
 IF p_kind='role_grant' THEN
   IF p_ref NOT IN ('SALES_REP','SALES_MANAGER') THEN
     RAISE EXCEPTION 'P4_R10_CHANGE_DENIED';
   END IF;
   SELECT active,revision INTO actual_active,actual_revision
    FROM p4_r7_ci.role_grants
    WHERE organization_id=p_org AND actor_id=p_target AND role_code=p_ref
    FOR UPDATE;
 ELSIF p_kind='team_grant' THEN
   BEGIN team_uuid:=p_ref::uuid;
   EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'P4_R10_CHANGE_DENIED'; END;
   SELECT active,revision INTO actual_active,actual_revision
    FROM p4_r7_ci.team_grants
    WHERE organization_id=p_org AND actor_id=p_target
      AND team_id=team_uuid AND managed=false
    FOR UPDATE;
 END IF;
 IF NOT FOUND OR actual_active IS DISTINCT FROM p_expected_active
   OR actual_revision IS DISTINCT FROM p_expected_revision THEN
   RAISE EXCEPTION 'P4_R10_VERSION_CONFLICT';
 END IF;
 -- Candidate 014 trigger writes audit atomically in THIS transaction.
 IF p_kind='role_grant' THEN
   UPDATE p4_r7_ci.role_grants
    SET active=p_next_active,revision=revision+1
    WHERE organization_id=p_org AND actor_id=p_target AND role_code=p_ref;
 ELSE
   UPDATE p4_r7_ci.team_grants
    SET active=p_next_active,revision=revision+1
    WHERE organization_id=p_org AND actor_id=p_target AND team_id=team_uuid;
 END IF;
 INSERT INTO p4_r10_ci.command_log(
   organization_id,request_id,actor_id,target_actor_id,kind,target_ref,
   before_active,after_active,previous_revision
 ) VALUES (p_org,p_request,p_actor,p_target,p_kind,p_ref,
   p_expected_active,p_next_active,p_expected_revision);
 RETURN 'APPLIED';
END $command$;
REVOKE ALL ON FUNCTION p4_r10_ci.apply_fixture_toggle(
 uuid,uuid,uuid,text,text,boolean,boolean,bigint,uuid) FROM PUBLIC;
-- No GRANT EXECUTE to p4_v1_ci_runtime/identity roles, no public HTTP API.
COMMIT;
