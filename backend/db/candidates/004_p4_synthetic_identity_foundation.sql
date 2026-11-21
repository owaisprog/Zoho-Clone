-- P4.01-P4.05 CANDIDATE SCHEMA. CI-DISPOSABLE PostgreSQL ONLY.
-- This is NOT a migration for the owner's Neon development DB, staging or
-- production. OPEN-001/002/003 tenant keys/permissions remain unapproved.
BEGIN;
DO $guard$
BEGIN
  IF current_database() <> 'zoho_clone_synthetic_ci' THEN
    RAISE EXCEPTION 'P4 synthetic candidate SQL must run ONLY in disposable CI';
  END IF;
END
$guard$;

CREATE SCHEMA p4_synthetic;
REVOKE ALL ON SCHEMA p4_synthetic FROM PUBLIC;

CREATE TABLE p4_synthetic.users (
  id text PRIMARY KEY CHECK (id ~ '^user_demo_[a-z]{2,16}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE p4_synthetic.identity_subjects (
  issuer text NOT NULL CHECK (issuer ~ '^https://[a-z0-9.-]+[.]auth0[.]com/$'),
  external_subject text NOT NULL CHECK (length(external_subject) BETWEEN 3 AND 200),
  user_id text NOT NULL REFERENCES p4_synthetic.users(id) ON DELETE RESTRICT,
  canonical_email text NOT NULL CHECK (canonical_email ~ '^[a-z0-9.+_-]+@example[.]com$'),
  email_verified boolean NOT NULL DEFAULT false,
  PRIMARY KEY (issuer, external_subject)
);
CREATE INDEX p4_identity_subjects_user_idx ON p4_synthetic.identity_subjects(user_id);

CREATE TABLE p4_synthetic.global_profiles (
  user_id text PRIMARY KEY REFERENCES p4_synthetic.users(id) ON DELETE RESTRICT,
  display_name text NOT NULL CHECK (display_name LIKE 'Demo %'),
  locale text NOT NULL CHECK (locale ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  time_zone text NOT NULL,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0)
);
CREATE TABLE p4_synthetic.organizations (
  id uuid PRIMARY KEY,
  slug text NOT NULL UNIQUE CHECK (slug ~ '^demo-[a-z0-9]+(-[a-z0-9]+)*$'),
  display_name text NOT NULL CHECK (display_name LIKE 'Demo %'),
  created_by text NOT NULL REFERENCES p4_synthetic.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE p4_synthetic.memberships (
  org_id uuid NOT NULL REFERENCES p4_synthetic.organizations(id) ON DELETE RESTRICT,
  user_id text NOT NULL REFERENCES p4_synthetic.users(id) ON DELETE RESTRICT,
  role text NOT NULL CHECK (role IN ('OWNER', 'MEMBER')),
  active boolean NOT NULL DEFAULT true,
  PRIMARY KEY (org_id, user_id)
);
CREATE TABLE p4_synthetic.session_metadata (
  session_id text PRIMARY KEY CHECK (session_id ~ '^session_demo_[a-z]{2,16}$'),
  user_id text NOT NULL REFERENCES p4_synthetic.users(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('active','revoked','expired')),
  expires_at timestamptz NOT NULL
);
CREATE TABLE p4_synthetic.auth_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id text NOT NULL REFERENCES p4_synthetic.users(id) ON DELETE RESTRICT,
  event_kind text NOT NULL CHECK (event_kind IN ('signed_in','signed_out','mfa_challenge','recovery_requested')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- All policies are only test fixtures. Client-chosen GUCs are not trusted:
-- a future API must set them ONLY after cryptographic IdP verification.
ALTER TABLE p4_synthetic.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE p4_synthetic.users FORCE ROW LEVEL SECURITY;
ALTER TABLE p4_synthetic.identity_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE p4_synthetic.identity_subjects FORCE ROW LEVEL SECURITY;
ALTER TABLE p4_synthetic.global_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE p4_synthetic.global_profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE p4_synthetic.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE p4_synthetic.organizations FORCE ROW LEVEL SECURITY;
ALTER TABLE p4_synthetic.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE p4_synthetic.memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE p4_synthetic.session_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE p4_synthetic.session_metadata FORCE ROW LEVEL SECURITY;
ALTER TABLE p4_synthetic.auth_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE p4_synthetic.auth_events FORCE ROW LEVEL SECURITY;

CREATE POLICY p4_user_self ON p4_synthetic.users FOR ALL
  USING (id = nullif(current_setting('app.actor_id',true),''))
  WITH CHECK (id = nullif(current_setting('app.actor_id',true),''));
CREATE POLICY p4_subject_self ON p4_synthetic.identity_subjects FOR ALL
  USING (user_id = nullif(current_setting('app.actor_id',true),''))
  WITH CHECK (user_id = nullif(current_setting('app.actor_id',true),''));
CREATE POLICY p4_profile_self ON p4_synthetic.global_profiles FOR ALL
  USING (user_id = nullif(current_setting('app.actor_id',true),''))
  WITH CHECK (user_id = nullif(current_setting('app.actor_id',true),''));
CREATE POLICY p4_org_owner ON p4_synthetic.organizations FOR ALL
  USING (
    created_by = nullif(current_setting('app.actor_id',true),'')
    AND id::text = nullif(current_setting('app.tenant_id',true),'')
  )
  WITH CHECK (
    created_by = nullif(current_setting('app.actor_id',true),'')
    AND id::text = nullif(current_setting('app.tenant_id',true),'')
    AND EXISTS (
      SELECT 1 FROM p4_synthetic.identity_subjects ids
      WHERE ids.user_id = nullif(current_setting('app.actor_id',true),'')
        AND ids.email_verified = true
    )
  );
CREATE POLICY p4_owner_membership ON p4_synthetic.memberships FOR ALL
  USING (
    user_id = nullif(current_setting('app.actor_id',true),'')
    AND org_id::text = nullif(current_setting('app.tenant_id',true),'')
  )
  WITH CHECK (
    user_id = nullif(current_setting('app.actor_id',true),'')
    AND org_id::text = nullif(current_setting('app.tenant_id',true),'')
    AND role = 'OWNER'
    AND EXISTS (
      SELECT 1 FROM p4_synthetic.organizations o
      WHERE o.id = org_id AND o.created_by = nullif(current_setting('app.actor_id',true),'')
    )
  );
CREATE POLICY p4_session_self ON p4_synthetic.session_metadata FOR ALL
  USING (user_id = nullif(current_setting('app.actor_id',true),''))
  WITH CHECK (user_id = nullif(current_setting('app.actor_id',true),''));
CREATE POLICY p4_event_self ON p4_synthetic.auth_events FOR ALL
  USING (user_id = nullif(current_setting('app.actor_id',true),''))
  WITH CHECK (user_id = nullif(current_setting('app.actor_id',true),''));

-- Exercise RLS using a NON-OWNER, NON-SUPERUSER effective runtime role.
-- GitHub CI's POSTGRES_USER is the cluster setup superuser and bypasses RLS,
-- even FORCE ROW LEVEL SECURITY. Tests MUST use SET ROLE below.
CREATE ROLE p4_synthetic_ci_runtime NOLOGIN
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
GRANT USAGE ON SCHEMA p4_synthetic TO p4_synthetic_ci_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA p4_synthetic
  TO p4_synthetic_ci_runtime;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA p4_synthetic
  TO p4_synthetic_ci_runtime;

COMMIT;
