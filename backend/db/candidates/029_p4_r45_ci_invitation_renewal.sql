-- P4 R45: disposable CI-only renewal chain and append-only audit.
-- Not a Neon, staging or production migration.
\set ON_ERROR_STOP on
BEGIN;
DO $guard$
BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci'
 OR current_user<>'demo_ci'
 OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
 OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='p4_r45_ci')
 OR to_regprocedure('p4_r40_ci.require_current_owner(uuid)') IS NULL
 THEN RAISE EXCEPTION 'P4_R45_DISPOSABLE_CI_ONLY'; END IF;
END $guard$;
CREATE SCHEMA p4_r45_ci;
REVOKE ALL ON SCHEMA p4_r45_ci FROM PUBLIC;
GRANT USAGE ON SCHEMA p4_r45_ci TO p4_synthetic_ci_runtime;
CREATE TABLE p4_r45_ci.renewal_events(
 id uuid PRIMARY KEY,
 org_id uuid NOT NULL REFERENCES p4_synthetic.organizations(id),
 prior_invitation_id uuid NOT NULL UNIQUE REFERENCES p4_synthetic.invitations(id),
 renewed_invitation_id uuid NOT NULL UNIQUE REFERENCES p4_synthetic.invitations(id),
 actor_user_id text NOT NULL,
 occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK (prior_invitation_id<>renewed_invitation_id),
 FOREIGN KEY (org_id,actor_user_id)
  REFERENCES p4_synthetic.memberships(org_id,user_id) ON DELETE RESTRICT
);
ALTER TABLE p4_r45_ci.renewal_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE p4_r45_ci.renewal_events FORCE ROW LEVEL SECURITY;
CREATE POLICY r45_owner_append ON p4_r45_ci.renewal_events
 FOR INSERT TO p4_synthetic_ci_runtime WITH CHECK(
  org_id::text=nullif(current_setting('app.tenant_id',true),'')
  AND actor_user_id=nullif(current_setting('app.actor_id',true),'')
  AND EXISTS(SELECT 1 FROM p4_synthetic.memberships m
   WHERE m.org_id=renewal_events.org_id
    AND m.user_id=renewal_events.actor_user_id
    AND m.active=true AND m.role='OWNER')
  AND EXISTS(
   SELECT 1 FROM p4_synthetic.invitations old
   JOIN p4_synthetic.invitations fresh
    ON old.org_id=fresh.org_id
    AND old.recipient_email=fresh.recipient_email
   WHERE old.id=renewal_events.prior_invitation_id
    AND fresh.id=renewal_events.renewed_invitation_id
    AND old.org_id=renewal_events.org_id
    AND old.status IN ('expired','revoked')
    AND fresh.status='pending'
    AND fresh.invited_by=renewal_events.actor_user_id
    AND fresh.resend_count=old.resend_count+1)
 );
CREATE FUNCTION p4_r45_ci.forbid_audit_mutation() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $body$
BEGIN RAISE EXCEPTION 'P4_R45_IMMUTABLE_RENEWAL_AUDIT'; END $body$;
CREATE TRIGGER immutable_renewal_events BEFORE UPDATE OR DELETE
 ON p4_r45_ci.renewal_events FOR EACH ROW
 EXECUTE FUNCTION p4_r45_ci.forbid_audit_mutation();
REVOKE ALL ON p4_r45_ci.renewal_events FROM PUBLIC;
GRANT INSERT ON p4_r45_ci.renewal_events TO p4_synthetic_ci_runtime;

-- Without granting the CI runtime UPDATE on outbox ciphertext, invalidate
-- queued old deliveries after owner-checked renewal; never invalidate delivered
-- records or expose encrypted tokens in HTTP JSON.
CREATE FUNCTION p4_r45_ci.invalidate_queued_delivery(p_org uuid,p_prior uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog AS $body$
DECLARE count_changed integer;
BEGIN
 PERFORM p4_r40_ci.require_current_owner(p_org);
 IF NOT EXISTS(SELECT 1 FROM p4_synthetic.invitations i
  WHERE i.id=p_prior AND i.org_id=p_org
    AND i.status IN ('revoked','expired'))
 THEN RAISE EXCEPTION USING ERRCODE='P4009',MESSAGE='CONFLICT'; END IF;
 UPDATE p4_r32_ci.delivery_outbox d SET status='dead'
 WHERE d.org_id=p_org AND d.invitation_id=p_prior AND d.status='queued';
 GET DIAGNOSTICS count_changed=ROW_COUNT;
 RETURN count_changed;
END $body$;
REVOKE ALL ON FUNCTION p4_r45_ci.invalidate_queued_delivery(uuid,uuid)
 FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p4_r45_ci.invalidate_queued_delivery(uuid,uuid)
 TO p4_synthetic_ci_runtime;
COMMIT;
