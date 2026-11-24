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

-- CI-only extension of R30 recipient-bound redemption to revoked MEMBERs.
-- No live activation, owner Neon migration, or unrestricted membership writes.
CREATE OR REPLACE FUNCTION p4_r30_ci.redeem_fictional_invitation(
 supplied_hash text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog AS $r43_redeem$
DECLARE
 actor text;
 invite record;
 changed integer;
 prior_active boolean;
 prior_role text;
 had_member boolean;
BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci'
  OR current_setting('role',true)<>'p4_synthetic_ci_runtime'
  OR supplied_hash !~ '^[0-9a-f]{64}$'
 THEN RETURN false; END IF;
 actor:=nullif(current_setting('app.actor_id',true),'');
 IF actor IS NULL OR actor !~ '^user_demo_[a-z]{2,16}$'
 THEN RETURN false; END IF;
 SELECT i.id,i.org_id,i.recipient_email,i.status,i.expires_at
 INTO invite
 FROM p4_synthetic.invitations i
 JOIN p4_synthetic.identity_subjects s
  ON s.canonical_email=i.recipient_email
  AND s.user_id=actor AND s.email_verified=true
 WHERE i.token_hash=supplied_hash AND i.status='pending'
 FOR UPDATE OF i;
 IF NOT FOUND OR invite.expires_at<=clock_timestamp() THEN RETURN false; END IF;
 SELECT m.active,m.role INTO prior_active,prior_role
 FROM p4_synthetic.memberships m
 WHERE m.org_id=invite.org_id AND m.user_id=actor FOR UPDATE;
 had_member:=FOUND;
 -- Never grant another active membership or elevate a previous owner.
 IF had_member AND (prior_active IS DISTINCT FROM false
  OR prior_role<>'MEMBER') THEN RETURN false; END IF;
 UPDATE p4_synthetic.invitations
 SET status='accepted',version=version+1
 WHERE id=invite.id AND status='pending'
  AND expires_at>clock_timestamp();
 GET DIAGNOSTICS changed=ROW_COUNT;
 IF changed<>1 THEN RETURN false; END IF;
 IF had_member THEN
  UPDATE p4_synthetic.memberships SET active=true
  WHERE org_id=invite.org_id AND user_id=actor
   AND role='MEMBER' AND active=false;
  GET DIAGNOSTICS changed=ROW_COUNT;
  -- Trigger resets sales role, increments its revision and appends audit.
  IF changed<>1 THEN
   RAISE EXCEPTION 'P4_R43_REACTIVATION_CONFLICT';
  END IF;
 ELSE
  INSERT INTO p4_synthetic.memberships(org_id,user_id,role,active)
  VALUES(invite.org_id,actor,'MEMBER',true);
 END IF;
 RETURN true;
END $r43_redeem$;

REVOKE ALL ON FUNCTION p4_r43_ci.revoke_member(uuid,text,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION p4_r43_ci.reset_after_member_reactivation() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p4_r43_ci.revoke_member(uuid,text,uuid)
 TO p4_synthetic_ci_runtime;
-- No direct table grants and no API for reactivation. A valid recipient-bound
-- single-use invitation acceptance is the only planned reactivation path.
COMMIT;
