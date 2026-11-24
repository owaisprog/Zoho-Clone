-- P4 R43: atomic CI-only membership revocation and least-privilege reactivation.
-- NOT an owner Neon migration, staging deployment or approved live IAM grant.
\set ON_ERROR_STOP on
BEGIN;
DO $$
BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci'
 OR current_user<>'demo_ci'
 OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
 OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='p4_r43_ci')
 OR to_regprocedure('p4_r40_ci.require_current_owner(uuid)') IS NULL
 THEN RAISE EXCEPTION 'P4_R43_DISPOSABLE_CI_ONLY'; END IF;
END $$;
CREATE SCHEMA p4_r43_ci;
REVOKE ALL ON SCHEMA p4_r43_ci FROM PUBLIC;
GRANT USAGE ON SCHEMA p4_r43_ci TO p4_synthetic_ci_runtime;
CREATE TABLE p4_r43_ci.membership_events (
 org_id uuid NOT NULL,
 request_id uuid NOT NULL,
 actor_user_id text,
 target_user_id text NOT NULL,
 event_kind text NOT NULL CHECK(event_kind IN (
  'member.revoked','member.reactivated')),
 previous_active boolean NOT NULL,
 next_active boolean NOT NULL,
 occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY (org_id,request_id),
 FOREIGN KEY (org_id,target_user_id)
  REFERENCES p4_synthetic.memberships(org_id,user_id) ON DELETE RESTRICT,
 FOREIGN KEY (org_id,actor_user_id)
  REFERENCES p4_synthetic.memberships(org_id,user_id) ON DELETE RESTRICT,
 CHECK (
  (event_kind='member.revoked' AND previous_active=true
   AND next_active=false AND actor_user_id IS NOT NULL)
  OR
  (event_kind='member.reactivated' AND previous_active=false
   AND next_active=true AND actor_user_id IS NULL)
 )
);
ALTER TABLE p4_r43_ci.membership_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE p4_r43_ci.membership_events FORCE ROW LEVEL SECURITY;
REVOKE ALL ON p4_r43_ci.membership_events FROM PUBLIC;
CREATE FUNCTION p4_r43_ci.prevent_event_edits() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN RAISE EXCEPTION 'P4_R43_APPEND_ONLY_AUDIT'; END $$;
CREATE TRIGGER r43_append_only BEFORE UPDATE OR DELETE
 ON p4_r43_ci.membership_events FOR EACH ROW
 EXECUTE FUNCTION p4_r43_ci.prevent_event_edits();

-- Fresh DB owner + verified email check is delegated to R40.
-- No owner transfer, no self-revocation, no bulk operations.
CREATE FUNCTION p4_r43_ci.revoke_member(
 p_org uuid,p_target text,p_request uuid
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog AS $$
DECLARE who text;
BEGIN
 PERFORM p4_r40_ci.require_current_owner(p_org);
 who:=nullif(current_setting('app.actor_id',true),'');
 IF p_target IS NULL OR p_target !~ '^user_demo_[a-z]{2,16}$'
 OR p_target=who OR p_request IS NULL
 OR NOT EXISTS(
  SELECT 1 FROM p4_synthetic.memberships m
  WHERE m.org_id=p_org AND m.user_id=p_target AND m.role='MEMBER')
 THEN RAISE EXCEPTION USING ERRCODE='P4003',MESSAGE='ACCESS_DENIED'; END IF;
 UPDATE p4_synthetic.memberships m SET active=false
 WHERE m.org_id=p_org AND m.user_id=p_target
  AND m.role='MEMBER' AND m.active=true;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P4009',MESSAGE='CONFLICT'; END IF;
 INSERT INTO p4_r43_ci.membership_events(
  org_id,request_id,actor_user_id,target_user_id,
  event_kind,previous_active,next_active
 ) VALUES (p_org,p_request,who,p_target,'member.revoked',true,false);
 RETURN true;
END $$;

-- A real single-use recipient acceptance from R30 may reactivate MEMBER.
-- That transaction MUST reset previously elevated business roles, increment
-- revision to invalidate stale role-update snapshots, and append safe event.
CREATE FUNCTION p4_r43_ci.reset_after_member_reactivation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog AS $$
BEGIN
 IF TG_OP<>'UPDATE' OR OLD.active IS DISTINCT FROM false
  OR NEW.active IS DISTINCT FROM true OR NEW.role<>'MEMBER'
 THEN RETURN NEW; END IF;
 UPDATE p4_r40_ci.sales_roles r
  SET role_code='SALES_REP',revision=revision+1
 WHERE r.org_id=NEW.org_id AND r.user_id=NEW.user_id;
 INSERT INTO p4_r43_ci.membership_events(
  org_id,request_id,actor_user_id,target_user_id,event_kind,
  previous_active,next_active
 ) VALUES (
  NEW.org_id,gen_random_uuid(),NULL,NEW.user_id,
  'member.reactivated',false,true
 );
 RETURN NEW;
END $$;
CREATE TRIGGER r43_reset_on_member_reactivation
 AFTER UPDATE OF active ON p4_synthetic.memberships
 FOR EACH ROW
 WHEN (OLD.active=false AND NEW.active=true AND NEW.role='MEMBER')
 EXECUTE FUNCTION p4_r43_ci.reset_after_member_reactivation();

REVOKE ALL ON FUNCTION p4_r43_ci.revoke_member(uuid,text,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION p4_r43_ci.reset_after_member_reactivation() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p4_r43_ci.revoke_member(uuid,text,uuid)
 TO p4_synthetic_ci_runtime;
-- No direct table grants and no API for reactivation. A valid recipient-bound
-- single-use invitation acceptance is the only planned reactivation path.
COMMIT;
