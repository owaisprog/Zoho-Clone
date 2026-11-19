-- P4.06–P4.10 CANDIDATE. ISOLATED CI-ONLY PostgreSQL, NOT a Neon migration.
-- Never run against the owner's real development DB or commercial services.
\set ON_ERROR_STOP on
BEGIN;

DO $guard$
BEGIN
  IF current_database() <> 'zoho_clone_synthetic_ci' OR
      NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'p4_synthetic') OR
      NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'p4_synthetic_ci_runtime') THEN
    RAISE EXCEPTION 'P4 invitation SQL requires disposable CI foundation and non-owner role';
  END IF;
END
$guard$;

-- This index supports checking a current actor's active membership on EACH request.
-- The real user mapping and row/field policy will require separate P4.11 review.
CREATE INDEX p4_memberships_active_user_lookup
  ON p4_synthetic.memberships(user_id, org_id)
  WHERE active = true;

CREATE TABLE p4_synthetic.invitations (
  id uuid PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES p4_synthetic.organizations(id) ON DELETE RESTRICT,
  invited_by text NOT NULL,
  recipient_email text NOT NULL
    CHECK (recipient_email ~ '^[a-z0-9._+%-]+@example[.]com$' AND length(recipient_email) <= 180),
  granted_role text NOT NULL DEFAULT 'MEMBER' CHECK (granted_role = 'MEMBER'),
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  issued_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  resend_count integer NOT NULL DEFAULT 0 CHECK (resend_count BETWEEN 0 AND 3),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  FOREIGN KEY (org_id, invited_by)
    REFERENCES p4_synthetic.memberships(org_id, user_id) ON DELETE RESTRICT,
  CHECK (expires_at > issued_at AND expires_at <= issued_at + interval '48 hours')
);
-- Must mark an expired pending row 'expired' in the same transaction before
-- inserting a replacement. Owner's API cannot rely on a preflight SELECT.
CREATE UNIQUE INDEX p4_invitation_pending_org_email
  ON p4_synthetic.invitations(org_id, recipient_email)
  WHERE status = 'pending';

ALTER TABLE p4_synthetic.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE p4_synthetic.invitations FORCE ROW LEVEL SECURITY;

-- Only a current active OWNER of the specific tenant can manage invitation rows.
-- Recipients get NO generic invitation SELECT; a future token-consumption
-- service must be narrowly scoped and verify exact provider email+token hash.
CREATE POLICY p4_invitation_owner_policy ON p4_synthetic.invitations
  FOR ALL
  USING (
    org_id::text = nullif(current_setting('app.tenant_id', true), '')
    AND EXISTS (
      SELECT 1 FROM p4_synthetic.memberships m
      WHERE m.org_id = invitations.org_id
        AND m.user_id = nullif(current_setting('app.actor_id', true), '')
        AND m.role = 'OWNER'
        AND m.active = true
    )
  )
  WITH CHECK (
    org_id::text = nullif(current_setting('app.tenant_id', true), '')
    AND invited_by = nullif(current_setting('app.actor_id', true), '')
    AND EXISTS (
      SELECT 1 FROM p4_synthetic.memberships m
      WHERE m.org_id = invitations.org_id
        AND m.user_id = nullif(current_setting('app.actor_id', true), '')
        AND m.role = 'OWNER'
        AND m.active = true
    )
    AND EXISTS (
      SELECT 1 FROM p4_synthetic.identity_subjects s
      WHERE s.user_id = nullif(current_setting('app.actor_id', true), '')
        AND s.email_verified = true
    )
  );

-- CI role is intentionally NOT a superuser, table owner, or BYPASSRLS role.
-- DELETE is deliberately unavailable; use audited revoke/expiry updates.
GRANT SELECT, INSERT, UPDATE ON p4_synthetic.invitations TO p4_synthetic_ci_runtime;

COMMIT;
