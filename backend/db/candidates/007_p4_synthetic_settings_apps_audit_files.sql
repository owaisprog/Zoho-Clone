-- P4.16-P4.20 candidate. DISPOSABLE CI ONLY; not a Neon migration.
-- The verified actor + tenant GUC MUST only be set by a trusted server.
\set ON_ERROR_STOP on
BEGIN;
DO $guard$
BEGIN
  IF current_database() <> 'zoho_clone_synthetic_ci' OR
     NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='p4_synthetic_ci_runtime') OR
     NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='p4_synthetic') THEN
    RAISE EXCEPTION 'P4.16-20 candidate restricted to disposable CI';
  END IF;
END
$guard$;

CREATE TABLE p4_synthetic.organization_settings(
 org_id uuid PRIMARY KEY REFERENCES p4_synthetic.organizations(id) ON DELETE RESTRICT,
 display_name text NOT NULL CHECK (display_name LIKE 'Demo %'),
 locale text NOT NULL CHECK (locale IN ('en-US','en-GB','en-PK')),
 time_zone text NOT NULL CHECK (time_zone IN ('Asia/Karachi','America/New_York','Europe/London','UTC')),
 display_currency text NOT NULL CHECK (display_currency IN ('USD','PKR','EUR')),
 revision integer NOT NULL DEFAULT 1 CHECK (revision>=1)
);
INSERT INTO p4_synthetic.organization_settings(org_id,display_name,locale,time_zone,display_currency)
VALUES
('10000000-0000-4000-8000-000000000001','Demo Orchid Payments','en-PK','Asia/Karachi','PKR'),
('10000000-0000-4000-8000-000000000002','Demo Cedar Payments','en-US','America/New_York','USD');

CREATE TABLE p4_synthetic.applications(
 code text PRIMARY KEY CHECK (code IN ('crm','teams','finance','files')),
 display_name text NOT NULL,
 required_permission text REFERENCES p4_synthetic.permission_codes(code)
);
INSERT INTO p4_synthetic.applications(code,display_name,required_permission) VALUES
('crm','Sales CRM','crm.leads.read.own'),
('teams','Teams','teams.read.assigned'),
('finance','Finance',NULL),
('files','Files',NULL);
CREATE TABLE p4_synthetic.app_grants(
 org_id uuid NOT NULL REFERENCES p4_synthetic.organizations(id) ON DELETE RESTRICT,
 app_code text NOT NULL REFERENCES p4_synthetic.applications(code) ON DELETE RESTRICT,
 active boolean NOT NULL DEFAULT false,
 PRIMARY KEY(org_id,app_code)
);
INSERT INTO p4_synthetic.app_grants(org_id,app_code,active) VALUES
('10000000-0000-4000-8000-000000000001','crm',true),
('10000000-0000-4000-8000-000000000001','teams',false),
('10000000-0000-4000-8000-000000000002','crm',false);

-- The code contract redacts all old/new values before writing.
CREATE TABLE p4_synthetic.audit_logs(
 event_id uuid PRIMARY KEY,
 org_id uuid NOT NULL,
 actor_user_id text NOT NULL,
 action text NOT NULL CHECK (action IN
  ('membership.revoked','org.preferences.changed','app.grant.changed',
   'team.created','file.upload.requested')),
 object_type text NOT NULL CHECK (object_type IN ('membership','organization','application','team','file')),
 object_ref text NOT NULL CHECK (length(object_ref) BETWEEN 3 AND 96),
 before_redacted text NOT NULL DEFAULT '[REDACTED]' CHECK (before_redacted='[REDACTED]'),
 after_redacted text NOT NULL DEFAULT '[REDACTED]' CHECK (after_redacted='[REDACTED]'),
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(org_id,actor_user_id) REFERENCES p4_synthetic.memberships(org_id,user_id) ON DELETE RESTRICT
);
CREATE INDEX p4_audit_org_created_idx ON p4_synthetic.audit_logs(org_id,created_at DESC);

-- Metadata ONLY. No credential, signed URL or real uploaded object exists.
CREATE TABLE p4_synthetic.files (
 id uuid NOT NULL,
 org_id uuid NOT NULL,
 record_type text NOT NULL CHECK (record_type IN ('lead','task')),
 record_id text NOT NULL CHECK (record_id ~ '^(LEAD|TASK)-DEMO-[0-9]{2,6}$'),
 owner_user_id text NOT NULL,
 display_name text NOT NULL CHECK (length(display_name) BETWEEN 1 AND 120),
 mime text NOT NULL CHECK (mime IN ('application/pdf','image/jpeg','image/png','text/plain')),
 size_bytes integer NOT NULL CHECK (size_bytes BETWEEN 1 AND 10485760),
 sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
 lifecycle text NOT NULL CHECK (lifecycle IN ('quarantined','scan_clean','rejected')),
 PRIMARY KEY(org_id,id),
 FOREIGN KEY(org_id,owner_user_id) REFERENCES p4_synthetic.memberships(org_id,user_id) ON DELETE RESTRICT
);
CREATE TABLE p4_synthetic.file_versions (
 org_id uuid NOT NULL,
 file_id uuid NOT NULL,
 version integer NOT NULL CHECK (version>0),
 private_object_key text NOT NULL CHECK (private_object_key LIKE 'private/p4-demo/%'),
 scan_state text NOT NULL CHECK (scan_state IN ('quarantined','scan_clean','rejected')),
 PRIMARY KEY(org_id,file_id,version),
 FOREIGN KEY(org_id,file_id) REFERENCES p4_synthetic.files(org_id,id) ON DELETE RESTRICT
);

INSERT INTO p4_synthetic.files(id,org_id,record_type,record_id,owner_user_id,display_name,mime,size_bytes,sha256,lifecycle)
VALUES
('10000000-0000-4000-8000-000000000031','10000000-0000-4000-8000-000000000001','lead','LEAD-DEMO-201','user_demo_alice','Demo file.pdf','application/pdf',128,repeat('a',64),'quarantined'),
('10000000-0000-4000-8000-000000000032','10000000-0000-4000-8000-000000000002','lead','LEAD-DEMO-202','user_demo_alice','Demo file.pdf','application/pdf',128,repeat('b',64),'quarantined');
INSERT INTO p4_synthetic.file_versions(org_id,file_id,version,private_object_key,scan_state)
VALUES
('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000031',1,'private/p4-demo/quarantine-1','quarantined'),
('10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000032',1,'private/p4-demo/quarantine-2','quarantined');

ALTER TABLE p4_synthetic.organization_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE p4_synthetic.organization_settings FORCE ROW LEVEL SECURITY;
ALTER TABLE p4_synthetic.app_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE p4_synthetic.app_grants FORCE ROW LEVEL SECURITY;
ALTER TABLE p4_synthetic.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE p4_synthetic.audit_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE p4_synthetic.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE p4_synthetic.files FORCE ROW LEVEL SECURITY;
ALTER TABLE p4_synthetic.file_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE p4_synthetic.file_versions FORCE ROW LEVEL SECURITY;

-- RLS read helpers use the actor's *current* active membership, in addition
-- to org matching. An owner in one org gets no cross-org record via query.
CREATE POLICY p4_settings_active_member_read ON p4_synthetic.organization_settings
FOR SELECT USING (
 org_id::text=nullif(current_setting('app.tenant_id',true),'')
 AND EXISTS (SELECT 1 FROM p4_synthetic.memberships m WHERE m.org_id=organization_settings.org_id
 AND m.user_id=nullif(current_setting('app.actor_id',true),'') AND m.active)
);
CREATE POLICY p4_app_grants_active_member_read ON p4_synthetic.app_grants
FOR SELECT USING (
 org_id::text=nullif(current_setting('app.tenant_id',true),'')
 AND EXISTS (SELECT 1 FROM p4_synthetic.memberships m WHERE m.org_id=app_grants.org_id
 AND m.user_id=nullif(current_setting('app.actor_id',true),'') AND m.active)
);
CREATE POLICY p4_audit_owner_read ON p4_synthetic.audit_logs
FOR SELECT USING (
 org_id::text=nullif(current_setting('app.tenant_id',true),'')
 AND EXISTS (SELECT 1 FROM p4_synthetic.memberships m WHERE m.org_id=audit_logs.org_id
 AND m.user_id=nullif(current_setting('app.actor_id',true),'')
 AND m.role='OWNER' AND m.active)
);
CREATE POLICY p4_file_record_owner_read ON p4_synthetic.files
FOR SELECT USING (
 org_id::text=nullif(current_setting('app.tenant_id',true),'')
 AND owner_user_id=nullif(current_setting('app.actor_id',true),'')
 AND EXISTS (SELECT 1 FROM p4_synthetic.memberships m WHERE m.org_id=files.org_id
 AND m.user_id=files.owner_user_id AND m.active)
);
CREATE POLICY p4_file_version_owner_read ON p4_synthetic.file_versions
FOR SELECT USING (
 org_id::text=nullif(current_setting('app.tenant_id',true),'')
 AND EXISTS (SELECT 1 FROM p4_synthetic.files f WHERE f.org_id=file_versions.org_id
 AND f.id=file_versions.file_id AND f.owner_user_id=nullif(current_setting('app.actor_id',true),''))
);

-- Separate future AUDIT-WRITER role: INSERT ONLY; cannot mutate an event.
-- This CI role is NOLOGIN/non-superuser and no BYPASSRLS. Service credential
-- management, identity mapping and durable retention are still unapproved.
CREATE ROLE p4_synthetic_ci_audit_writer NOLOGIN
 NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
GRANT USAGE ON SCHEMA p4_synthetic TO p4_synthetic_ci_audit_writer;
GRANT SELECT ON p4_synthetic.memberships TO p4_synthetic_ci_audit_writer;
GRANT INSERT ON p4_synthetic.audit_logs TO p4_synthetic_ci_audit_writer;
CREATE POLICY p4_audit_writer_insert ON p4_synthetic.audit_logs FOR INSERT
WITH CHECK (
 org_id::text=nullif(current_setting('app.tenant_id',true),'')
 AND actor_user_id=nullif(current_setting('app.actor_id',true),'')
 AND EXISTS (SELECT 1 FROM p4_synthetic.memberships m WHERE m.org_id=audit_logs.org_id
 AND m.user_id=audit_logs.actor_user_id AND m.active)
);

GRANT SELECT ON p4_synthetic.organization_settings,p4_synthetic.applications,
 p4_synthetic.app_grants,p4_synthetic.audit_logs,p4_synthetic.files,
 p4_synthetic.file_versions TO p4_synthetic_ci_runtime;
-- Deliberately no UPDATE/DELETE/INSERT grants to runtime role here.
COMMIT;
