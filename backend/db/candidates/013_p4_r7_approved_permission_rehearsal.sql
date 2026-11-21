-- P4 Batch 07: owner-approved P1.06 designed access semantics, CI-only.
-- This candidate is a NEW disposable proof, NOT a Neon/Prisma migration.
-- ORG_OWNER intentionally DOES NOT have a CRM lead view. The earlier P4 v1
-- synthetic OWNER/MEMBER prototype is NOT the approved business-role model.
\set ON_ERROR_STOP on
BEGIN;
DO $guard$
BEGIN
 IF current_database() <> 'zoho_clone_synthetic_ci' OR current_user <> 'demo_ci'
    OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
    OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='p4_r7_ci') THEN
   RAISE EXCEPTION 'P4 R7 permitted ONLY for fresh disposable CI database';
 END IF;
END $guard$;
CREATE SCHEMA p4_r7_ci;
REVOKE ALL ON SCHEMA p4_r7_ci FROM PUBLIC;

CREATE TABLE p4_r7_ci.memberships(
  organization_id p4_v1_ci.internal_id NOT NULL
    REFERENCES p4_v1_ci.organizations(id) ON DELETE RESTRICT,
  actor_id p4_v1_ci.internal_id NOT NULL
    REFERENCES p4_v1_ci.users(id) ON DELETE RESTRICT,
  active boolean NOT NULL DEFAULT false,
  PRIMARY KEY(organization_id,actor_id)
);
CREATE TABLE p4_r7_ci.role_grants(
  organization_id p4_v1_ci.internal_id NOT NULL,
  actor_id p4_v1_ci.internal_id NOT NULL,
  role_code text NOT NULL CHECK(role_code IN (
    'ORG_OWNER','ORG_ADMIN','SALES_MANAGER','SALES_REP',
    'ONBOARDING_MANAGER','ONBOARDING_COORDINATOR',
    'AGENT_MANAGER','BILLING_ADMIN','SECURITY_REVIEWER',
    'PLATFORM_SUPPORT','EXTERNAL_AGENT','EXTERNAL_MERCHANT','SYSTEM_WORKER'
  )),
  active boolean NOT NULL DEFAULT false,
  PRIMARY KEY(organization_id,actor_id,role_code),
  FOREIGN KEY (organization_id,actor_id)
    REFERENCES p4_r7_ci.memberships(organization_id,actor_id) ON DELETE RESTRICT
);
CREATE TABLE p4_r7_ci.app_grants(
  organization_id p4_v1_ci.internal_id NOT NULL
    REFERENCES p4_v1_ci.organizations(id) ON DELETE RESTRICT,
  app_code text NOT NULL CHECK(app_code IN ('crm','platform')),
  active boolean NOT NULL DEFAULT false,
  PRIMARY KEY(organization_id,app_code)
);
CREATE TABLE p4_r7_ci.team_grants(
  organization_id p4_v1_ci.internal_id NOT NULL,
  team_id p4_v1_ci.internal_id NOT NULL,
  actor_id p4_v1_ci.internal_id NOT NULL,
  active boolean NOT NULL DEFAULT false,
  managed boolean NOT NULL DEFAULT false,
  PRIMARY KEY(organization_id,team_id,actor_id),
  FOREIGN KEY (organization_id,team_id)
    REFERENCES p4_v1_ci.teams(organization_id,id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id,actor_id)
    REFERENCES p4_r7_ci.memberships(organization_id,actor_id) ON DELETE RESTRICT
);
CREATE TABLE p4_r7_ci.leads(
  organization_id p4_v1_ci.internal_id NOT NULL,
  id p4_v1_ci.internal_id NOT NULL,
  owner_user_id p4_v1_ci.internal_id NOT NULL,
  team_id p4_v1_ci.internal_id NOT NULL,
  assigned_user_id p4_v1_ci.internal_id,
  display_name text NOT NULL CHECK(display_name LIKE 'Demo %'),
  share_state text NOT NULL DEFAULT 'private'
    CHECK(share_state IN ('private','explicit_team')),
  confidential_note text NOT NULL DEFAULT 'Demo PRIVATE placeholder',
  PRIMARY KEY(organization_id,id),
  FOREIGN KEY(organization_id,owner_user_id)
    REFERENCES p4_r7_ci.memberships(organization_id,actor_id) ON DELETE RESTRICT,
  FOREIGN KEY(organization_id,assigned_user_id)
    REFERENCES p4_r7_ci.memberships(organization_id,actor_id) ON DELETE RESTRICT,
  FOREIGN KEY(organization_id,team_id)
    REFERENCES p4_v1_ci.teams(organization_id,id) ON DELETE RESTRICT
);
CREATE INDEX p4_r7_lead_tenant_owner_idx
  ON p4_r7_ci.leads(organization_id,owner_user_id,id);
CREATE INDEX p4_r7_lead_tenant_assignee_idx
  ON p4_r7_ci.leads(organization_id,assigned_user_id,id);
CREATE INDEX p4_r7_lead_tenant_team_idx
  ON p4_r7_ci.leads(organization_id,team_id,id);

-- Two sample companies. "ORG_OWNER" is purposefully independent from the
-- user managing sales records. Fictional users are linked globally via P4 v1.
INSERT INTO p4_v1_ci.users(id,display_name)
 VALUES ('10000000-0000-4000-8000-0000000000d1','Demo Dana');
INSERT INTO p4_r7_ci.memberships(organization_id,actor_id,active) VALUES
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-0000000000a1',true),
 ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-0000000000a1',true),
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-0000000000c1',true),
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-0000000000d1',true);
INSERT INTO p4_r7_ci.role_grants(organization_id,actor_id,role_code,active) VALUES
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-0000000000a1','ORG_OWNER',true),
 ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-0000000000a1','ORG_OWNER',true),
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-0000000000c1','SALES_REP',true),
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-0000000000d1','SALES_MANAGER',true);
INSERT INTO p4_r7_ci.app_grants(organization_id,app_code,active) VALUES
 ('20000000-0000-4000-8000-000000000001','crm',true),
 ('20000000-0000-4000-8000-000000000002','crm',true);
INSERT INTO p4_r7_ci.team_grants(organization_id,team_id,actor_id,active,managed) VALUES
 ('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',
   '10000000-0000-4000-8000-0000000000c1',true,false),
 ('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',
   '10000000-0000-4000-8000-0000000000d1',true,true);
INSERT INTO p4_r7_ci.leads
 (organization_id,id,owner_user_id,team_id,assigned_user_id,display_name,share_state)
 VALUES
 ('20000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-0000000000a1','30000000-0000-4000-8000-000000000001',
  NULL,'Demo Shared Orchid Lead','explicit_team'),
 ('20000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-0000000000a1','30000000-0000-4000-8000-000000000001',
  NULL,'Demo Private Orchid Lead','private'),
 ('20000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-0000000000c1','30000000-0000-4000-8000-000000000001',
  NULL,'Demo Rep Owned Lead','private'),
 ('20000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000004',
  '10000000-0000-4000-8000-0000000000a1','30000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-0000000000c1','Demo Explicitly Assigned Lead','private'),
 ('20000000-0000-4000-8000-000000000002','80000000-0000-4000-8000-000000000005',
  '10000000-0000-4000-8000-0000000000a1','30000000-0000-4000-8000-000000000002',
  NULL,'Demo Cedar Private Lead','private');

DO $force$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['memberships','role_grants','app_grants','team_grants','leads'] LOOP
  EXECUTE format('ALTER TABLE p4_r7_ci.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE p4_r7_ci.%I FORCE ROW LEVEL SECURITY',t);
 END LOOP;
END $force$;

CREATE POLICY member_current ON p4_r7_ci.memberships FOR SELECT USING (
  organization_id::text=nullif(current_setting('app.tenant_id',true),'')
  AND actor_id::text=nullif(current_setting('app.actor_id',true),'')
  AND active
);
CREATE POLICY roles_current ON p4_r7_ci.role_grants FOR SELECT USING (
  organization_id::text=nullif(current_setting('app.tenant_id',true),'')
  AND actor_id::text=nullif(current_setting('app.actor_id',true),'')
  AND active
  AND EXISTS(SELECT 1 FROM p4_r7_ci.memberships m
   WHERE m.organization_id=role_grants.organization_id AND m.active)
);
CREATE POLICY entitled_current ON p4_r7_ci.app_grants FOR SELECT USING (
  organization_id::text=nullif(current_setting('app.tenant_id',true),'')
  AND EXISTS(SELECT 1 FROM p4_r7_ci.memberships m
   WHERE m.organization_id=app_grants.organization_id AND m.active)
);
CREATE POLICY team_current ON p4_r7_ci.team_grants FOR SELECT USING (
  organization_id::text=nullif(current_setting('app.tenant_id',true),'')
  AND actor_id::text=nullif(current_setting('app.actor_id',true),'')
  AND active AND EXISTS(SELECT 1 FROM p4_r7_ci.memberships m
   WHERE m.organization_id=team_grants.organization_id AND m.active)
);
CREATE POLICY leads_p106_sales_scope ON p4_r7_ci.leads FOR SELECT USING (
  organization_id::text=nullif(current_setting('app.tenant_id',true),'')
  AND EXISTS (SELECT 1 FROM p4_r7_ci.memberships m
      WHERE m.organization_id=leads.organization_id AND m.active)
  AND EXISTS (SELECT 1 FROM p4_r7_ci.app_grants a
      WHERE a.organization_id=leads.organization_id
        AND a.app_code='crm' AND a.active)
  AND EXISTS (SELECT 1 FROM p4_r7_ci.role_grants r
      WHERE r.organization_id=leads.organization_id AND r.active
        AND (
          (r.role_code='SALES_REP' AND (
            leads.owner_user_id=r.actor_id OR leads.assigned_user_id=r.actor_id OR
            (leads.share_state='explicit_team' AND EXISTS (
              SELECT 1 FROM p4_r7_ci.team_grants tg
              WHERE tg.organization_id=leads.organization_id
                AND tg.team_id=leads.team_id AND tg.active))))
          OR (r.role_code='SALES_MANAGER' AND
            leads.share_state='explicit_team' AND EXISTS (
              SELECT 1 FROM p4_r7_ci.team_grants tg
              WHERE tg.organization_id=leads.organization_id
                AND tg.team_id=leads.team_id
                AND tg.active AND tg.managed))
        ))
);
-- Database role for normal tenant reads is still NOLOGIN and NOBYPASSRLS.
-- Only safe columns can be read. NEVER grant direct note/body access.
GRANT USAGE ON SCHEMA p4_r7_ci TO p4_v1_ci_runtime;
GRANT SELECT (organization_id,actor_id,active)
 ON p4_r7_ci.memberships TO p4_v1_ci_runtime;
GRANT SELECT (organization_id,actor_id,role_code,active)
 ON p4_r7_ci.role_grants TO p4_v1_ci_runtime;
GRANT SELECT (organization_id,app_code,active)
 ON p4_r7_ci.app_grants TO p4_v1_ci_runtime;
GRANT SELECT (organization_id,team_id,actor_id,active,managed)
 ON p4_r7_ci.team_grants TO p4_v1_ci_runtime;
GRANT SELECT (organization_id,id,owner_user_id,team_id,assigned_user_id,
  display_name,share_state)
 ON p4_r7_ci.leads TO p4_v1_ci_runtime;
-- No INSERT/UPDATE/DELETE grants. No public application routes.
COMMIT;
