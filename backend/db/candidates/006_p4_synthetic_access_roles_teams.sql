-- P4.11–P4.15 CANDIDATE: disposable CI-only Postgres, not a Neon migration.
-- Not production ACL/RLS acceptance. Real Auth0 -> internal subject mapping and
-- owner-approved permissions matrix are still blocked.
\set ON_ERROR_STOP on
BEGIN;
DO $guard$
BEGIN
 IF current_database() <> 'zoho_clone_synthetic_ci' OR
    NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='p4_synthetic_ci_runtime') THEN
   RAISE EXCEPTION 'P4 access foundation requires disposable CI database';
 END IF;
END
$guard$;

-- Explicit allowlisted permissions, not a global superuser wildcard.
CREATE TABLE p4_synthetic.permission_codes (
 code text PRIMARY KEY CHECK (code IN (
  'org.members.read','org.members.manage','crm.leads.read.own',
  'crm.leads.read.all','crm.leads.edit.own','teams.read.assigned',
  'teams.manage.assigned'
 ))
);
INSERT INTO p4_synthetic.permission_codes(code) VALUES
('org.members.read'),('org.members.manage'),('crm.leads.read.own'),
('crm.leads.read.all'),('crm.leads.edit.own'),('teams.read.assigned'),
('teams.manage.assigned');

CREATE TABLE p4_synthetic.roles (
 org_id uuid NOT NULL REFERENCES p4_synthetic.organizations(id) ON DELETE RESTRICT,
 code text NOT NULL CHECK (code IN ('OWNER','MEMBER') OR code ~ '^demo_[a-z][a-z0-9_]{2,30}$'),
 label text NOT NULL,
 reserved boolean NOT NULL DEFAULT false,
 PRIMARY KEY(org_id,code),
 CONSTRAINT p4_reserved_codes CHECK ((code IN ('OWNER','MEMBER')) = reserved)
);
CREATE TABLE p4_synthetic.role_permissions (
 org_id uuid NOT NULL,
 role_code text NOT NULL,
 permission_code text NOT NULL REFERENCES p4_synthetic.permission_codes(code),
 PRIMARY KEY(org_id,role_code,permission_code),
 FOREIGN KEY(org_id,role_code) REFERENCES p4_synthetic.roles(org_id,code) ON DELETE RESTRICT
);
CREATE TABLE p4_synthetic.role_assignments (
 org_id uuid NOT NULL,
 user_id text NOT NULL,
 role_code text NOT NULL,
 active boolean NOT NULL DEFAULT true,
 PRIMARY KEY(org_id,user_id,role_code),
 FOREIGN KEY(org_id,user_id) REFERENCES p4_synthetic.memberships(org_id,user_id) ON DELETE RESTRICT,
 FOREIGN KEY(org_id,role_code) REFERENCES p4_synthetic.roles(org_id,code) ON DELETE RESTRICT
);

-- Reserved templates are provisioned only as migration data; runtime role
-- cannot INSERT/UPDATE/DELETE role or grant tables.
INSERT INTO p4_synthetic.roles(org_id,code,label,reserved)
SELECT id,'OWNER','Demo Owner',true FROM p4_synthetic.organizations;
INSERT INTO p4_synthetic.roles(org_id,code,label,reserved)
SELECT id,'MEMBER','Demo Member',true FROM p4_synthetic.organizations;
INSERT INTO p4_synthetic.role_permissions(org_id,role_code,permission_code)
SELECT r.org_id, r.code, p.code FROM p4_synthetic.roles r
CROSS JOIN p4_synthetic.permission_codes p
WHERE r.code='OWNER';
INSERT INTO p4_synthetic.role_permissions(org_id,role_code,permission_code)
SELECT r.org_id,r.code,p.code FROM p4_synthetic.roles r
CROSS JOIN p4_synthetic.permission_codes p
WHERE r.code='MEMBER'
AND p.code IN ('crm.leads.read.own','teams.read.assigned');

-- Synthetic department/team foundation.
CREATE TABLE p4_synthetic.departments (
 org_id uuid NOT NULL REFERENCES p4_synthetic.organizations(id) ON DELETE RESTRICT,
 id text NOT NULL CHECK (id ~ '^dept_demo_[a-z]{2,24}$'),
 name text NOT NULL CHECK (name LIKE 'Demo %'),
 active boolean NOT NULL DEFAULT true,
 PRIMARY KEY(org_id,id)
);
CREATE TABLE p4_synthetic.teams (
 org_id uuid NOT NULL,
 id text NOT NULL CHECK (id ~ '^team_demo_[a-z]{2,24}$'),
 department_id text NOT NULL,
 name text NOT NULL CHECK (name LIKE 'Demo %'),
 manager_user_id text NOT NULL,
 active boolean NOT NULL DEFAULT true,
 PRIMARY KEY(org_id,id),
 FOREIGN KEY(org_id,department_id) REFERENCES p4_synthetic.departments(org_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(org_id,manager_user_id) REFERENCES p4_synthetic.memberships(org_id,user_id) ON DELETE RESTRICT
);
CREATE TABLE p4_synthetic.team_memberships (
 org_id uuid NOT NULL,
 team_id text NOT NULL,
 user_id text NOT NULL,
 active boolean NOT NULL DEFAULT true,
 PRIMARY KEY(org_id,team_id,user_id),
 FOREIGN KEY(org_id,team_id) REFERENCES p4_synthetic.teams(org_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(org_id,user_id) REFERENCES p4_synthetic.memberships(org_id,user_id) ON DELETE RESTRICT
);
CREATE TABLE p4_synthetic.authorization_revisions (
 org_id uuid NOT NULL,
 user_id text NOT NULL,
 revision integer NOT NULL DEFAULT 1 CHECK (revision >= 1),
 PRIMARY KEY(org_id,user_id),
 FOREIGN KEY(org_id,user_id) REFERENCES p4_synthetic.memberships(org_id,user_id) ON DELETE RESTRICT
);
CREATE TABLE p4_synthetic.revocation_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 org_id uuid NOT NULL,
 actor_user_id text NOT NULL,
 target_user_id text NOT NULL,
 event_kind text NOT NULL CHECK (event_kind='membership.revoked'),
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(org_id,actor_user_id) REFERENCES p4_synthetic.memberships(org_id,user_id) ON DELETE RESTRICT,
 FOREIGN KEY(org_id,target_user_id) REFERENCES p4_synthetic.memberships(org_id,user_id) ON DELETE RESTRICT
);

-- Seed fictional Bob membership directly in setup (no public membership
-- write API); Bob is a MEMBER in org1, never an OWNER.
INSERT INTO p4_synthetic.memberships(org_id,user_id,role,active) VALUES
('10000000-0000-4000-8000-000000000001','user_demo_bob','MEMBER',true);

INSERT INTO p4_synthetic.role_assignments(org_id,user_id,role_code)
SELECT org_id,user_id,role FROM p4_synthetic.memberships
WHERE org_id IN (
 '10000000-0000-4000-8000-000000000001',
 '10000000-0000-4000-8000-000000000002'
);
INSERT INTO p4_synthetic.departments(org_id,id,name) VALUES
('10000000-0000-4000-8000-000000000001','dept_demo_sales','Demo Sales'),
('10000000-0000-4000-8000-000000000001','dept_demo_support','Demo Support'),
('10000000-0000-4000-8000-000000000002','dept_demo_sales','Demo Cedar Sales');
INSERT INTO p4_synthetic.teams(org_id,id,department_id,name,manager_user_id) VALUES
('10000000-0000-4000-8000-000000000001','team_demo_sales','dept_demo_sales','Demo Sales Team','user_demo_bob'),
('10000000-0000-4000-8000-000000000001','team_demo_support','dept_demo_support','Demo Support Team','user_demo_alice'),
('10000000-0000-4000-8000-000000000002','team_demo_cedar','dept_demo_sales','Demo Cedar Team','user_demo_alice');
INSERT INTO p4_synthetic.team_memberships(org_id,team_id,user_id) VALUES
('10000000-0000-4000-8000-000000000001','team_demo_sales','user_demo_bob'),
('10000000-0000-4000-8000-000000000001','team_demo_support','user_demo_alice');

-- All tenant-owned tables enforce RLS; only an active member can read.
ALTER TABLE p4_synthetic.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE p4_synthetic.roles FORCE ROW LEVEL SECURITY;
ALTER TABLE p4_synthetic.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE p4_synthetic.role_permissions FORCE ROW LEVEL SECURITY;
ALTER TABLE p4_synthetic.role_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE p4_synthetic.role_assignments FORCE ROW LEVEL SECURITY;
ALTER TABLE p4_synthetic.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE p4_synthetic.departments FORCE ROW LEVEL SECURITY;
ALTER TABLE p4_synthetic.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE p4_synthetic.teams FORCE ROW LEVEL SECURITY;
ALTER TABLE p4_synthetic.team_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE p4_synthetic.team_memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE p4_synthetic.authorization_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE p4_synthetic.authorization_revisions FORCE ROW LEVEL SECURITY;
ALTER TABLE p4_synthetic.revocation_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE p4_synthetic.revocation_audit FORCE ROW LEVEL SECURITY;

CREATE POLICY p4_role_member_read ON p4_synthetic.roles FOR SELECT USING (
 org_id::text = nullif(current_setting('app.tenant_id',true),'')
 AND EXISTS (SELECT 1 FROM p4_synthetic.memberships m
   WHERE m.org_id=roles.org_id AND m.user_id=nullif(current_setting('app.actor_id',true),'')
     AND m.active=true)
);
CREATE POLICY p4_role_grants_member_read ON p4_synthetic.role_permissions FOR SELECT USING (
 org_id::text = nullif(current_setting('app.tenant_id',true),'')
 AND EXISTS (SELECT 1 FROM p4_synthetic.memberships m
  WHERE m.org_id=role_permissions.org_id
    AND m.user_id=nullif(current_setting('app.actor_id',true),'') AND m.active)
);
CREATE POLICY p4_assignment_member_read ON p4_synthetic.role_assignments FOR SELECT USING (
 org_id::text=nullif(current_setting('app.tenant_id',true),'')
 AND user_id=nullif(current_setting('app.actor_id',true),'')
 AND EXISTS (SELECT 1 FROM p4_synthetic.memberships m
  WHERE m.org_id=role_assignments.org_id AND m.user_id=role_assignments.user_id AND m.active)
);
CREATE POLICY p4_department_member_read ON p4_synthetic.departments FOR SELECT USING (
 org_id::text=nullif(current_setting('app.tenant_id',true),'')
 AND EXISTS (SELECT 1 FROM p4_synthetic.memberships m
  WHERE m.org_id=departments.org_id AND m.user_id=nullif(current_setting('app.actor_id',true),'') AND m.active)
);
CREATE POLICY p4_team_owner_manager_read ON p4_synthetic.teams FOR SELECT USING (
 org_id::text=nullif(current_setting('app.tenant_id',true),'')
 AND EXISTS (SELECT 1 FROM p4_synthetic.memberships m
  WHERE m.org_id=teams.org_id AND m.user_id=nullif(current_setting('app.actor_id',true),'')
    AND m.active AND (m.role='OWNER' OR teams.manager_user_id=m.user_id))
);
CREATE POLICY p4_team_member_self_read ON p4_synthetic.team_memberships FOR SELECT USING (
 org_id::text=nullif(current_setting('app.tenant_id',true),'')
 AND user_id=nullif(current_setting('app.actor_id',true),'')
 AND EXISTS (SELECT 1 FROM p4_synthetic.memberships m
  WHERE m.org_id=team_memberships.org_id AND m.user_id=team_memberships.user_id AND m.active)
);
CREATE POLICY p4_authorization_revision_self ON p4_synthetic.authorization_revisions FOR SELECT USING (
 org_id::text=nullif(current_setting('app.tenant_id',true),'')
 AND user_id=nullif(current_setting('app.actor_id',true),'')
 AND EXISTS (SELECT 1 FROM p4_synthetic.memberships m
  WHERE m.org_id=authorization_revisions.org_id AND m.user_id=authorization_revisions.user_id AND m.active)
);
-- Revocation audit is future server-only; default deny for CI runtime role.

GRANT SELECT ON p4_synthetic.permission_codes TO p4_synthetic_ci_runtime;
GRANT SELECT ON p4_synthetic.roles,p4_synthetic.role_permissions,
 p4_synthetic.role_assignments,p4_synthetic.departments,p4_synthetic.teams,
 p4_synthetic.team_memberships,p4_synthetic.authorization_revisions
 TO p4_synthetic_ci_runtime;
-- Runtime has NO mutations on reserved roles, grants, departments,
-- teams, revisions, audit or sessions until separate owner security approval.
COMMIT;
