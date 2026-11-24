-- P4 R46: append-only cancellation evidence, disposable CI only.
\set ON_ERROR_STOP on
BEGIN;
DO $guard$
BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci'
 OR current_user<>'demo_ci'
 OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
 OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='p4_r46_ci')
 OR to_regprocedure('p4_r45_ci.invalidate_queued_delivery(uuid,uuid)') IS NULL
 THEN RAISE EXCEPTION 'P4_R46_DISPOSABLE_CI_ONLY'; END IF;
END $guard$;
CREATE SCHEMA p4_r46_ci;
REVOKE ALL ON SCHEMA p4_r46_ci FROM PUBLIC;
GRANT USAGE ON SCHEMA p4_r46_ci TO p4_synthetic_ci_runtime;
CREATE TABLE p4_r46_ci.cancellation_events(
 id uuid PRIMARY KEY,
 org_id uuid NOT NULL REFERENCES p4_synthetic.organizations(id),
 invitation_id uuid NOT NULL UNIQUE REFERENCES p4_synthetic.invitations(id),
 actor_user_id text NOT NULL,
 canceled_version integer NOT NULL CHECK(canceled_version>=2),
 occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY (org_id,actor_user_id)
  REFERENCES p4_synthetic.memberships(org_id,user_id)
);
ALTER TABLE p4_r46_ci.cancellation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE p4_r46_ci.cancellation_events FORCE ROW LEVEL SECURITY;
CREATE POLICY ci_owner_cancel_insert ON p4_r46_ci.cancellation_events
 FOR INSERT TO p4_synthetic_ci_runtime WITH CHECK(
  org_id::text=nullif(current_setting('app.tenant_id',true),'')
  AND actor_user_id=nullif(current_setting('app.actor_id',true),'')
  AND EXISTS(SELECT 1 FROM p4_synthetic.memberships m
   WHERE m.org_id=cancellation_events.org_id
    AND m.user_id=cancellation_events.actor_user_id
    AND m.role='OWNER' AND m.active=true)
  AND EXISTS(SELECT 1 FROM p4_synthetic.invitations i
   WHERE i.id=cancellation_events.invitation_id
    AND i.org_id=cancellation_events.org_id
    AND i.invited_by=cancellation_events.actor_user_id
    AND i.status='revoked'
    AND i.version=cancellation_events.canceled_version)
 );
CREATE FUNCTION p4_r46_ci.deny_cancellation_edits() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $body$
BEGIN RAISE EXCEPTION 'P4_R46_APPEND_ONLY'; END $body$;
CREATE TRIGGER immutable_cancellation_events BEFORE UPDATE OR DELETE
 ON p4_r46_ci.cancellation_events FOR EACH ROW
 EXECUTE FUNCTION p4_r46_ci.deny_cancellation_edits();
REVOKE ALL ON p4_r46_ci.cancellation_events FROM PUBLIC;
GRANT INSERT ON p4_r46_ci.cancellation_events TO p4_synthetic_ci_runtime;
COMMIT;
