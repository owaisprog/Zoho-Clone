-- P3.18-P3.22 PROVISIONAL synthetic-only PostgreSQL schema.
-- OPEN-001/002/003 remain unresolved. NEVER apply to real customer data.
-- This SQL is exercised against an isolated throwaway CI database only.
BEGIN;

CREATE SCHEMA IF NOT EXISTS synthetic;

CREATE TABLE synthetic.organizations (
  id text PRIMARY KEY CHECK (id ~ '^org_demo_[a-z]{2,16}$'),
  display_name text NOT NULL CHECK (display_name LIKE 'Demo %'),
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE synthetic.memberships (
  org_id text NOT NULL REFERENCES synthetic.organizations(id) ON DELETE RESTRICT,
  user_id text NOT NULL CHECK (user_id ~ '^user_demo_[a-z]{2,16}$'),
  role text NOT NULL CHECK (role IN ('SALES_READER','SALES_EDITOR','ORG_ADMIN')),
  record_scope text NOT NULL CHECK (record_scope IN ('all','owned')),
  active boolean NOT NULL DEFAULT true,
  PRIMARY KEY (org_id,user_id)
);

CREATE TABLE synthetic.leads (
  org_id text NOT NULL REFERENCES synthetic.organizations(id) ON DELETE RESTRICT,
  id text NOT NULL CHECK (id ~ '^LEAD-DEMO-[0-9]{3}$'),
  owner_id text NOT NULL,
  organization text NOT NULL CHECK (organization LIKE 'Demo %' OR organization LIKE '% Demo'),
  contact text NOT NULL CHECK (contact LIKE 'Example %'),
  email text NOT NULL CHECK (email ~ '^[a-z0-9][a-z0-9.-]{0,45}@example[.]com$'),
  stage text NOT NULL DEFAULT 'new' CHECK (stage IN ('new','contacted','qualified')),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  PRIMARY KEY (org_id,id),
  CONSTRAINT lead_owner_same_org FOREIGN KEY (org_id,owner_id)
    REFERENCES synthetic.memberships(org_id,user_id) ON DELETE RESTRICT
);

CREATE INDEX synthetic_leads_owner_lookup ON synthetic.leads (org_id,owner_id,stage);

CREATE TABLE synthetic.idempotency_records (
  org_id text NOT NULL,
  actor_id text NOT NULL,
  operation text NOT NULL CHECK (operation IN ('lead.create','lead.advance')),
  request_key text NOT NULL CHECK (request_key ~ '^DEMO-[a-zA-Z0-9-]{6,60}$'),
  fingerprint text NOT NULL,
  response_data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id,actor_id,operation,request_key),
  CONSTRAINT idempotency_actor_same_org FOREIGN KEY (org_id,actor_id)
    REFERENCES synthetic.memberships(org_id,user_id) ON DELETE RESTRICT
);

-- Optional defense in depth, not a substitute for verified session+record ACL.
-- Setting app.tenant_id/app.actor_id is permitted ONLY on a server-managed,
-- transaction-scoped connection after successful identity verification.
-- Never accept these values directly from caller headers/URLs.
ALTER TABLE synthetic.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE synthetic.organizations FORCE ROW LEVEL SECURITY;
ALTER TABLE synthetic.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE synthetic.memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE synthetic.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE synthetic.leads FORCE ROW LEVEL SECURITY;
ALTER TABLE synthetic.idempotency_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE synthetic.idempotency_records FORCE ROW LEVEL SECURITY;

CREATE POLICY synthetic_org_context ON synthetic.organizations
  USING (id = nullif(current_setting('app.tenant_id',true),''))
  WITH CHECK (id = nullif(current_setting('app.tenant_id',true),''));

CREATE POLICY synthetic_membership_context ON synthetic.memberships
  USING (org_id = nullif(current_setting('app.tenant_id',true),'')
    AND user_id = nullif(current_setting('app.actor_id',true),''))
  WITH CHECK (org_id = nullif(current_setting('app.tenant_id',true),'')
    AND user_id = nullif(current_setting('app.actor_id',true),''));

-- DB policy is TENANT isolation; approved role+record scopes must still be
-- verified by the application on EVERY read/write with scoped SQL predicates.
CREATE POLICY synthetic_lead_tenant ON synthetic.leads
  USING (org_id = nullif(current_setting('app.tenant_id',true),'')
    AND EXISTS (
      SELECT 1 FROM synthetic.memberships m
      WHERE m.org_id = nullif(current_setting('app.tenant_id',true),'')
        AND m.user_id = nullif(current_setting('app.actor_id',true),'')
        AND m.active = true
    ))
  WITH CHECK (org_id = nullif(current_setting('app.tenant_id',true),'')
    AND EXISTS (
      SELECT 1 FROM synthetic.memberships m
      WHERE m.org_id = nullif(current_setting('app.tenant_id',true),'')
        AND m.user_id = nullif(current_setting('app.actor_id',true),'')
        AND m.active = true
    ));

CREATE POLICY synthetic_replay_context ON synthetic.idempotency_records
  USING (org_id = nullif(current_setting('app.tenant_id',true),'')
    AND actor_id = nullif(current_setting('app.actor_id',true),''))
  WITH CHECK (org_id = nullif(current_setting('app.tenant_id',true),'')
    AND actor_id = nullif(current_setting('app.actor_id',true),''));

COMMIT;
