-- P4 R32: disposable-CI-only encrypted invitation delivery outbox.
-- Not a production migration. No worker role, KMS, SMTP or Neon integration.
\set ON_ERROR_STOP on
BEGIN;
DO $$
BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci'
 OR current_user<>'demo_ci'
 OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='p4_synthetic_ci_runtime')
 THEN RAISE EXCEPTION 'P4_R32_DISPOSABLE_CI_ONLY'; END IF;
END $$;
CREATE SCHEMA p4_r32_ci;
REVOKE ALL ON SCHEMA p4_r32_ci FROM PUBLIC;
GRANT USAGE ON SCHEMA p4_r32_ci TO p4_synthetic_ci_runtime;
CREATE TABLE p4_r32_ci.delivery_outbox (
 id uuid PRIMARY KEY,
 invitation_id uuid NOT NULL UNIQUE REFERENCES p4_synthetic.invitations(id),
 org_id uuid NOT NULL REFERENCES p4_synthetic.organizations(id),
 recipient_email text NOT NULL CHECK (recipient_email ~ '^[a-z0-9._-]+@example[.]com$'),
 encrypted_token text NOT NULL CHECK (encrypted_token ~ '^[0-9a-f]{128}$'),
 nonce text NOT NULL CHECK (nonce ~ '^[0-9a-f]{24}$'),
 auth_tag text NOT NULL CHECK (auth_tag ~ '^[0-9a-f]{32}$'),
 status text NOT NULL DEFAULT 'queued'
  CHECK (status IN ('queued','delivered','dead')),
 attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 3),
 next_attempt_at timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL DEFAULT now(),
 delivered_at timestamptz,
 CHECK ((status='delivered')=(delivered_at IS NOT NULL))
);
CREATE INDEX r32_outbox_claim
 ON p4_r32_ci.delivery_outbox(next_attempt_at,created_at,id)
 WHERE status='queued';
ALTER TABLE p4_r32_ci.delivery_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE p4_r32_ci.delivery_outbox FORCE ROW LEVEL SECURITY;
CREATE POLICY r32_owner_insert ON p4_r32_ci.delivery_outbox
 FOR INSERT TO p4_synthetic_ci_runtime
 WITH CHECK (
  org_id::text=nullif(current_setting('app.tenant_id',true),'')
  AND EXISTS(SELECT 1 FROM p4_synthetic.memberships m
   WHERE m.org_id=delivery_outbox.org_id
    AND m.user_id=nullif(current_setting('app.actor_id',true),'')
    AND m.role='OWNER' AND m.active=true)
  AND EXISTS(SELECT 1 FROM p4_synthetic.invitations i
   WHERE i.id=delivery_outbox.invitation_id
    AND i.org_id=delivery_outbox.org_id
    AND i.recipient_email=delivery_outbox.recipient_email
    AND i.status='pending')
 );
-- Issuing runtime can INSERT only. Never read ciphertext or inspect the queue.
GRANT INSERT ON p4_r32_ci.delivery_outbox TO p4_synthetic_ci_runtime;
COMMIT;
