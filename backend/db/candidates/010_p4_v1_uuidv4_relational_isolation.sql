-- Architecture v1.0 / ADR 0007; P3.05-P3.06 and P4.10-P4.11.
-- DISPOSABLE GitHub CI ONLY. This file is not a Prisma/Neon migration.
-- DO NOT execute in zoho_clone_synthetic, staging, production or any owner Neon DB.
\set ON_ERROR_STOP on
BEGIN;
DO $guard$
BEGIN
 IF current_database() <> 'zoho_clone_synthetic_ci' OR current_user <> 'demo_ci' OR
    NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user) OR
    EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='p4_v1_ci') THEN
  RAISE EXCEPTION 'P4 UUIDv4 candidate is disposable bootstrap CI only';
 END IF;
END $guard$;

CREATE SCHEMA p4_v1_ci;
REVOKE ALL ON SCHEMA p4_v1_ci FROM PUBLIC;
-- Requiring canonical UUIDv4 IDs at the type boundary prevents accidental
-- use of a signed Auth0 subject, arbitrary legacy text ID, UUIDv1 or UUIDv7.
CREATE DOMAIN p4_v1_ci.internal_id AS uuid
  CHECK (substring(value::text from 15 for 1) = '4'
      AND substring(value::text from 20 for 1) IN ('8','9','a','b'));

-- Users are GLOBAL, never duplicated on each tenant. External OIDC
-- subjects retain their string issuer+subject, uniquely bound to one user.
CREATE TABLE p4_v1_ci.users (
 id p4_v1_ci.internal_id PRIMARY KEY,
 display_name text NOT NULL CHECK(display_name LIKE 'Demo %'),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE p4_v1_ci.identity_subjects (
 issuer text NOT NULL CHECK (issuer ~ '^https://[a-z0-9.-]+[.]auth0[.]com/$'),
 external_subject text NOT NULL CHECK(length(external_subject) BETWEEN 3 AND 200),
 user_id p4_v1_ci.internal_id NOT NULL REFERENCES p4_v1_ci.users(id) ON DELETE RESTRICT,
 email_verified boolean NOT NULL DEFAULT false,
 PRIMARY KEY (issuer,external_subject)
);
CREATE INDEX p4_v1_identities_user_idx ON p4_v1_ci.identity_subjects(user_id);

CREATE TABLE p4_v1_ci.organizations (
 id p4_v1_ci.internal_id PRIMARY KEY,
 slug text NOT NULL UNIQUE CHECK (slug ~ '^demo-[a-z0-9]+(-[a-z0-9]+)*$'),
 display_name text NOT NULL CHECK (display_name LIKE 'Demo %'),
 created_by p4_v1_ci.internal_id NOT NULL REFERENCES p4_v1_ci.users(id) ON DELETE RESTRICT
);
CREATE TABLE p4_v1_ci.memberships (
 organization_id p4_v1_ci.internal_id NOT NULL REFERENCES p4_v1_ci.organizations(id) ON DELETE RESTRICT,
 user_id p4_v1_ci.internal_id NOT NULL REFERENCES p4_v1_ci.users(id) ON DELETE RESTRICT,
 role text NOT NULL CHECK(role IN ('OWNER','MEMBER')),
 active boolean NOT NULL DEFAULT true,
 PRIMARY KEY (organization_id,user_id)
);
CREATE INDEX p4_v1_active_member_idx
 ON p4_v1_ci.memberships(user_id,organization_id) WHERE active;

-- Teams and links must carry BOTH tenant and referenced IDs. FK to just
-- team.id or lead.id would allow cross-tenant attachment in a shared DB.
CREATE TABLE p4_v1_ci.teams (
 organization_id p4_v1_ci.internal_id NOT NULL REFERENCES p4_v1_ci.organizations(id) ON DELETE RESTRICT,
 id p4_v1_ci.internal_id NOT NULL,
 manager_user_id p4_v1_ci.internal_id NOT NULL,
 title text NOT NULL CHECK(title LIKE 'Demo %'),
 PRIMARY KEY (organization_id,id),
 FOREIGN KEY (organization_id,manager_user_id)
  REFERENCES p4_v1_ci.memberships(organization_id,user_id) ON DELETE RESTRICT
);
CREATE TABLE p4_v1_ci.team_memberships (
 organization_id p4_v1_ci.internal_id NOT NULL,
 team_id p4_v1_ci.internal_id NOT NULL,
 user_id p4_v1_ci.internal_id NOT NULL,
 PRIMARY KEY (organization_id,team_id,user_id),
 FOREIGN KEY (organization_id,team_id) REFERENCES p4_v1_ci.teams(organization_id,id) ON DELETE RESTRICT,
 FOREIGN KEY (organization_id,user_id) REFERENCES p4_v1_ci.memberships(organization_id,user_id) ON DELETE RESTRICT
);
CREATE INDEX p4_v1_team_user_idx ON p4_v1_ci.team_memberships(organization_id,user_id,team_id);

CREATE TABLE p4_v1_ci.crm_leads (
 organization_id p4_v1_ci.internal_id NOT NULL REFERENCES p4_v1_ci.organizations(id) ON DELETE RESTRICT,
 id p4_v1_ci.internal_id NOT NULL,
 owner_user_id p4_v1_ci.internal_id NOT NULL,
 team_id p4_v1_ci.internal_id NOT NULL,
 display_name text NOT NULL CHECK(display_name LIKE 'Demo %'),
 version integer NOT NULL DEFAULT 1 CHECK(version >= 1),
 PRIMARY KEY (organization_id,id),
 UNIQUE (organization_id,id,owner_user_id),
 FOREIGN KEY (organization_id,owner_user_id)
  REFERENCES p4_v1_ci.memberships(organization_id,user_id) ON DELETE RESTRICT,
 FOREIGN KEY (organization_id,team_id)
  REFERENCES p4_v1_ci.teams(organization_id,id) ON DELETE RESTRICT
);
CREATE INDEX p4_v1_leads_actor_idx
 ON p4_v1_ci.crm_leads(organization_id,owner_user_id,id);
CREATE INDEX p4_v1_leads_team_idx
 ON p4_v1_ci.crm_leads(organization_id,team_id,id);

-- Metadata only: no object key, upload bytes, signed grant or provider.
CREATE TABLE p4_v1_ci.file_metadata (
 organization_id p4_v1_ci.internal_id NOT NULL,
 id p4_v1_ci.internal_id NOT NULL,
 lead_id p4_v1_ci.internal_id NOT NULL,
 owner_user_id p4_v1_ci.internal_id NOT NULL,
 scan_state text NOT NULL DEFAULT 'quarantined'
  CHECK(scan_state IN ('quarantined','scan_clean','rejected','soft_deleted')),
 revision integer NOT NULL DEFAULT 1 CHECK(revision > 0),
 PRIMARY KEY (organization_id,id),
 FOREIGN KEY (organization_id,lead_id,owner_user_id)
  REFERENCES p4_v1_ci.crm_leads(organization_id,id,owner_user_id) ON DELETE RESTRICT
);
CREATE INDEX p4_v1_files_lead_idx
 ON p4_v1_ci.file_metadata(organization_id,lead_id,id);

-- Outbox is server-writer-only and deliberately has no runtime SELECT
-- policy. Future worker authorization is a separate, still OPEN gate.
CREATE TABLE p4_v1_ci.outbox_events (
 organization_id p4_v1_ci.internal_id NOT NULL,
 id p4_v1_ci.internal_id NOT NULL,
 actor_user_id p4_v1_ci.internal_id NOT NULL,
 lead_id p4_v1_ci.internal_id NOT NULL,
 event_name text NOT NULL CHECK(event_name IN ('file.scan.requested','membership.revocation.requested')),
 idempotency_key text NOT NULL CHECK(idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9_-]{7,63}$'),
 delivery_status text NOT NULL DEFAULT 'not_scheduled'
  CHECK(delivery_status = 'not_scheduled'),
 PRIMARY KEY(organization_id,id),
 UNIQUE(organization_id,idempotency_key),
 FOREIGN KEY (organization_id,actor_user_id)
  REFERENCES p4_v1_ci.memberships(organization_id,user_id) ON DELETE RESTRICT,
 FOREIGN KEY (organization_id,lead_id)
  REFERENCES p4_v1_ci.crm_leads(organization_id,id) ON DELETE RESTRICT
);
CREATE TABLE p4_v1_ci.audit_logs (
 organization_id p4_v1_ci.internal_id NOT NULL REFERENCES p4_v1_ci.organizations(id) ON DELETE RESTRICT,
 id p4_v1_ci.internal_id NOT NULL,
 actor_user_id p4_v1_ci.internal_id NOT NULL,
 event_name text NOT NULL CHECK(event_name IN ('membership.revoked','file.scan.requested')),
 redacted boolean NOT NULL DEFAULT true CHECK(redacted),
 PRIMARY KEY(organization_id,id),
 FOREIGN KEY (organization_id,actor_user_id)
  REFERENCES p4_v1_ci.memberships(organization_id,user_id) ON DELETE RESTRICT
);

-- Two independent fictional orgs. One global owner may join both, but
-- cannot query both from a single tenant transaction.
INSERT INTO p4_v1_ci.users(id,display_name) VALUES
 ('10000000-0000-4000-8000-0000000000a1','Demo Alice'),
 ('10000000-0000-4000-8000-0000000000b1','Demo Bob');
INSERT INTO p4_v1_ci.identity_subjects(issuer,external_subject,user_id,email_verified) VALUES
 ('https://demo.us.auth0.com/','auth0|demo-alice','10000000-0000-4000-8000-0000000000a1',true),
 ('https://demo.us.auth0.com/','auth0|demo-bob','10000000-0000-4000-8000-0000000000b1',true);
INSERT INTO p4_v1_ci.organizations(id,slug,display_name,created_by) VALUES
 ('20000000-0000-4000-8000-000000000001','demo-orchid','Demo Orchid','10000000-0000-4000-8000-0000000000a1'),
 ('20000000-0000-4000-8000-000000000002','demo-cedar','Demo Cedar','10000000-0000-4000-8000-0000000000a1');
INSERT INTO p4_v1_ci.memberships(organization_id,user_id,role,active) VALUES
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-0000000000a1','OWNER',true),
 ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-0000000000a1','OWNER',true),
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-0000000000b1','MEMBER',true);
INSERT INTO p4_v1_ci.teams(organization_id,id,manager_user_id,title) VALUES
 ('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-0000000000a1','Demo Orchid Team'),
 ('20000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-0000000000a1','Demo Cedar Team');
INSERT INTO p4_v1_ci.team_memberships(organization_id,team_id,user_id) VALUES
 ('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-0000000000b1');
INSERT INTO p4_v1_ci.crm_leads(organization_id,id,owner_user_id,team_id,display_name) VALUES
 ('20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-0000000000a1','30000000-0000-4000-8000-000000000001','Demo Orchid Lead'),
 ('20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-0000000000b1','30000000-0000-4000-8000-000000000001','Demo Bob Lead'),
 ('20000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-0000000000a1','30000000-0000-4000-8000-000000000002','Demo Cedar Lead');
INSERT INTO p4_v1_ci.file_metadata(organization_id,id,lead_id,owner_user_id) VALUES
 ('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-0000000000a1'),
 ('20000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-0000000000a1');
INSERT INTO p4_v1_ci.outbox_events(organization_id,id,actor_user_id,lead_id,event_name,idempotency_key) VALUES
 ('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-0000000000a1','40000000-0000-4000-8000-000000000001','file.scan.requested','demo_scan_001');
INSERT INTO p4_v1_ci.audit_logs(organization_id,id,actor_user_id,event_name) VALUES
 ('20000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-0000000000a1','file.scan.requested');

-- RLS is a second layer. Provider auth, live role matrix and ABAC still
-- require actual approved server enforcement; these are CI-only policies.
ALTER TABLE p4_v1_ci.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE p4_v1_ci.users FORCE ROW LEVEL SECURITY;
ALTER TABLE p4_v1_ci.identity_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE p4_v1_ci.identity_subjects FORCE ROW LEVEL SECURITY;
ALTER TABLE p4_v1_ci.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE p4_v1_ci.organizations FORCE ROW LEVEL SECURITY;
ALTER TABLE p4_v1_ci.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE p4_v1_ci.memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE p4_v1_ci.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE p4_v1_ci.teams FORCE ROW LEVEL SECURITY;
ALTER TABLE p4_v1_ci.team_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE p4_v1_ci.team_memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE p4_v1_ci.crm_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE p4_v1_ci.crm_leads FORCE ROW LEVEL SECURITY;
ALTER TABLE p4_v1_ci.file_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE p4_v1_ci.file_metadata FORCE ROW LEVEL SECURITY;
ALTER TABLE p4_v1_ci.outbox_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE p4_v1_ci.outbox_events FORCE ROW LEVEL SECURITY;
ALTER TABLE p4_v1_ci.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE p4_v1_ci.audit_logs FORCE ROW LEVEL SECURITY;

-- Membership policy is nonrecursive and is used as the base by business RLS.
CREATE POLICY membership_self ON p4_v1_ci.memberships FOR SELECT USING (
 organization_id::text = nullif(current_setting('app.tenant_id',true),'')
 AND user_id::text = nullif(current_setting('app.actor_id',true),'')
 AND active = true
);
CREATE POLICY org_member ON p4_v1_ci.organizations FOR SELECT USING (
 id::text = nullif(current_setting('app.tenant_id',true),'')
 AND EXISTS(SELECT 1 FROM p4_v1_ci.memberships m
    WHERE m.organization_id=organizations.id AND m.active)
);
CREATE POLICY lead_record_access ON p4_v1_ci.crm_leads FOR SELECT USING (
 organization_id::text = nullif(current_setting('app.tenant_id',true),'')
 AND EXISTS(SELECT 1 FROM p4_v1_ci.memberships m
   WHERE m.organization_id=crm_leads.organization_id AND m.active
     AND (m.role='OWNER' OR crm_leads.owner_user_id=m.user_id))
);
CREATE POLICY file_record_access ON p4_v1_ci.file_metadata FOR SELECT USING (
 organization_id::text = nullif(current_setting('app.tenant_id',true),'')
 AND EXISTS(SELECT 1 FROM p4_v1_ci.crm_leads l
   WHERE l.organization_id=file_metadata.organization_id AND l.id=file_metadata.lead_id)
 AND EXISTS(SELECT 1 FROM p4_v1_ci.memberships m
   WHERE m.organization_id=file_metadata.organization_id AND m.active
     AND (m.role='OWNER' OR file_metadata.owner_user_id=m.user_id))
);
CREATE POLICY audit_owner_access ON p4_v1_ci.audit_logs FOR SELECT USING (
 organization_id::text = nullif(current_setting('app.tenant_id',true),'')
 AND EXISTS(SELECT 1 FROM p4_v1_ci.memberships m
   WHERE m.organization_id=audit_logs.organization_id
     AND m.role='OWNER' AND m.active)
);
-- No SELECT/INSERT/UPDATE/DELETE policy for outbox, identity or global users.
-- No tenant runtime grant for teams or outbox; explicit denial is intentional.
CREATE ROLE p4_v1_ci_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
 NOREPLICATION NOBYPASSRLS;
GRANT USAGE ON SCHEMA p4_v1_ci TO p4_v1_ci_runtime;
GRANT SELECT ON p4_v1_ci.organizations,p4_v1_ci.memberships,
 p4_v1_ci.crm_leads,p4_v1_ci.file_metadata,p4_v1_ci.audit_logs
 TO p4_v1_ci_runtime;
COMMIT;
