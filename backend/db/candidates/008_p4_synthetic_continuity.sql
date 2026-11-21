-- P4.21-P4.25 SYNTHETIC CI ONLY: never run on Neon or with customer data.
\set ON_ERROR_STOP on
BEGIN;
DO $guard$
BEGIN
 IF current_database() <> 'zoho_clone_synthetic_ci' OR
    NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='p4_synthetic_ci_runtime') OR
    NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='p4_synthetic') THEN
   RAISE EXCEPTION 'P4.21-25 candidate restricted to disposable CI';
 END IF;
END
$guard$;

-- No storage object key, blob or signed URL. File-link metadata only.
CREATE TABLE p4_synthetic.file_links(
 org_id uuid NOT NULL, file_id uuid NOT NULL, link_id uuid NOT NULL,
 record_type text NOT NULL CHECK (record_type IN ('lead','task')),
 record_ref text NOT NULL CHECK (record_ref ~ '^(LEAD|TASK)-DEMO-[0-9]{2,6}$'),
 state text NOT NULL CHECK (state IN ('active','deleted')),
 PRIMARY KEY(org_id,link_id),
 FOREIGN KEY(org_id,file_id) REFERENCES p4_synthetic.files(org_id,id) ON DELETE RESTRICT
);
INSERT INTO p4_synthetic.file_links(org_id,file_id,link_id,record_type,record_ref,state) VALUES
('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000031','10000000-0000-4000-8000-000000000051','lead','LEAD-DEMO-201','active'),
('10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000032','10000000-0000-4000-8000-000000000052','lead','LEAD-DEMO-202','active');

CREATE TABLE p4_synthetic.notifications(
 org_id uuid NOT NULL, id uuid NOT NULL,
 recipient_user_id text NOT NULL, kind text NOT NULL CHECK (kind IN ('membership','task','system')),
 read_at timestamptz, link_code text NOT NULL CHECK (link_code IN ('memberships','tasks','settings')),
 PRIMARY KEY(org_id,id),
 FOREIGN KEY(org_id,recipient_user_id) REFERENCES p4_synthetic.memberships(org_id,user_id) ON DELETE RESTRICT
);
CREATE TABLE p4_synthetic.notification_preferences(
 org_id uuid NOT NULL, user_id text NOT NULL, kind text NOT NULL CHECK (kind IN ('membership','task','system')),
 in_app boolean NOT NULL DEFAULT true,
 PRIMARY KEY(org_id,user_id,kind),
 FOREIGN KEY(org_id,user_id) REFERENCES p4_synthetic.memberships(org_id,user_id) ON DELETE RESTRICT
);
INSERT INTO p4_synthetic.notifications(org_id,id,recipient_user_id,kind,link_code) VALUES
('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000061','user_demo_alice','task','tasks'),
('10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000062','user_demo_alice','system','settings');
INSERT INTO p4_synthetic.notification_preferences(org_id,user_id,kind,in_app) VALUES
('10000000-0000-4000-8000-000000000001','user_demo_alice','task',true),
('10000000-0000-4000-8000-000000000002','user_demo_alice','system',false);

-- Platform grants live outside normal tenant roles; NO tenant runtime grants.
CREATE TABLE p4_synthetic.platform_admin_grants(
 user_id text NOT NULL PRIMARY KEY CHECK (user_id ~ '^user_demo_[a-z]{2,16}$'),
 platform_role text NOT NULL CHECK (platform_role IN ('PLATFORM_ADMIN','PLATFORM_AUDITOR')),
 expires_at timestamptz NOT NULL
);
CREATE TABLE p4_synthetic.support_access_grants(
 id uuid PRIMARY KEY, org_id uuid NOT NULL REFERENCES p4_synthetic.organizations(id) ON DELETE RESTRICT,
 support_user_id text NOT NULL, consenting_owner_id text NOT NULL,
 scope text NOT NULL CHECK (scope='tenant.metadata.read'),
 approved_at timestamptz NOT NULL, expires_at timestamptz NOT NULL,
 CHECK (expires_at > approved_at AND expires_at <= approved_at + interval '30 minutes'),
 FOREIGN KEY(org_id,consenting_owner_id) REFERENCES p4_synthetic.memberships(org_id,user_id) ON DELETE RESTRICT
);

-- Requested closure/export is only a candidate draft, never an executable queue.
CREATE TABLE p4_synthetic.export_jobs(
 id uuid NOT NULL, org_id uuid NOT NULL, owner_user_id text NOT NULL,
 status text NOT NULL CHECK (status='draft_only'), retention_days int NOT NULL CHECK (retention_days BETWEEN 30 AND 365),
 PRIMARY KEY(org_id,id),
 FOREIGN KEY(org_id,owner_user_id) REFERENCES p4_synthetic.memberships(org_id,user_id) ON DELETE RESTRICT
);
CREATE TABLE p4_synthetic.deletion_jobs(
 id uuid NOT NULL, org_id uuid NOT NULL, owner_user_id text NOT NULL,
 status text NOT NULL CHECK (status='draft_only'), recovery_runbook_required boolean NOT NULL DEFAULT true,
 PRIMARY KEY(org_id,id),
 FOREIGN KEY(org_id,owner_user_id) REFERENCES p4_synthetic.memberships(org_id,user_id) ON DELETE RESTRICT
);
INSERT INTO p4_synthetic.export_jobs(id,org_id,owner_user_id,status,retention_days) VALUES
('10000000-0000-4000-8000-000000000071','10000000-0000-4000-8000-000000000001','user_demo_alice','draft_only',30);
INSERT INTO p4_synthetic.deletion_jobs(id,org_id,owner_user_id,status,recovery_runbook_required) VALUES
('10000000-0000-4000-8000-000000000072','10000000-0000-4000-8000-000000000002','user_demo_alice','draft_only',true);

ALTER TABLE p4_synthetic.file_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE p4_synthetic.file_links FORCE ROW LEVEL SECURITY;
ALTER TABLE p4_synthetic.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE p4_synthetic.notifications FORCE ROW LEVEL SECURITY;
ALTER TABLE p4_synthetic.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE p4_synthetic.notification_preferences FORCE ROW LEVEL SECURITY;
ALTER TABLE p4_synthetic.platform_admin_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE p4_synthetic.platform_admin_grants FORCE ROW LEVEL SECURITY;
ALTER TABLE p4_synthetic.support_access_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE p4_synthetic.support_access_grants FORCE ROW LEVEL SECURITY;
ALTER TABLE p4_synthetic.export_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE p4_synthetic.export_jobs FORCE ROW LEVEL SECURITY;
ALTER TABLE p4_synthetic.deletion_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE p4_synthetic.deletion_jobs FORCE ROW LEVEL SECURITY;

CREATE POLICY p4_file_links_owner_read ON p4_synthetic.file_links FOR SELECT USING(
 org_id::text=nullif(current_setting('app.tenant_id',true),'') AND state='active'
 AND EXISTS(SELECT 1 FROM p4_synthetic.files f WHERE f.org_id=file_links.org_id
   AND f.id=file_links.file_id AND f.owner_user_id=nullif(current_setting('app.actor_id',true),''))
);
CREATE POLICY p4_notices_recipient_read ON p4_synthetic.notifications FOR SELECT USING(
 org_id::text=nullif(current_setting('app.tenant_id',true),'')
 AND recipient_user_id=nullif(current_setting('app.actor_id',true),'')
 AND EXISTS(SELECT 1 FROM p4_synthetic.memberships m
   WHERE m.org_id=notifications.org_id AND m.user_id=notifications.recipient_user_id AND m.active)
);
CREATE POLICY p4_notice_preferences_recipient_read ON p4_synthetic.notification_preferences FOR SELECT USING(
 org_id::text=nullif(current_setting('app.tenant_id',true),'')
 AND user_id=nullif(current_setting('app.actor_id',true),'')
 AND EXISTS(SELECT 1 FROM p4_synthetic.memberships m
   WHERE m.org_id=notification_preferences.org_id AND m.user_id=notification_preferences.user_id AND m.active)
);
CREATE POLICY p4_exports_owner_read ON p4_synthetic.export_jobs FOR SELECT USING(
 org_id::text=nullif(current_setting('app.tenant_id',true),'')
 AND owner_user_id=nullif(current_setting('app.actor_id',true),'')
 AND EXISTS(SELECT 1 FROM p4_synthetic.memberships m
   WHERE m.org_id=export_jobs.org_id AND m.user_id=export_jobs.owner_user_id AND m.role='OWNER' AND m.active)
);
CREATE POLICY p4_deletions_owner_read ON p4_synthetic.deletion_jobs FOR SELECT USING(
 org_id::text=nullif(current_setting('app.tenant_id',true),'')
 AND owner_user_id=nullif(current_setting('app.actor_id',true),'')
 AND EXISTS(SELECT 1 FROM p4_synthetic.memberships m
   WHERE m.org_id=deletion_jobs.org_id AND m.user_id=deletion_jobs.owner_user_id AND m.role='OWNER' AND m.active)
);

-- Platform grants and support access have NO SELECT policies nor any runtime privileges.
GRANT SELECT ON p4_synthetic.file_links,p4_synthetic.notifications,
 p4_synthetic.notification_preferences,p4_synthetic.export_jobs,
 p4_synthetic.deletion_jobs TO p4_synthetic_ci_runtime;
-- Explicitly NO INSERT/UPDATE/DELETE grants, platform support permissions, or public storage.
COMMIT;
