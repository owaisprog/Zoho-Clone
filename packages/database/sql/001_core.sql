-- PostgreSQL 16+; run with a dedicated migration role, not the runtime role.
-- No card data, payment credentials or real merchant data belongs in this schema.
BEGIN;

CREATE SCHEMA IF NOT EXISTS business_os;

-- UUIDv4 is available natively through gen_random_uuid() in supported PostgreSQL versions.
CREATE TABLE business_os.organizations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 160),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- This is a profile reference, not an authentication system.
CREATE TABLE business_os.users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text NOT NULL UNIQUE CHECK (email = lower(email) AND position('@' IN email) > 1),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE business_os.memberships (
    tenant_id uuid NOT NULL REFERENCES business_os.organizations(id) ON DELETE RESTRICT,
    user_id uuid NOT NULL REFERENCES business_os.users(id) ON DELETE RESTRICT,
    role text NOT NULL CHECK (role IN ('owner', 'admin', 'manager', 'agent', 'viewer')),
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, user_id)
);

CREATE TABLE business_os.crm_accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES business_os.organizations(id) ON DELETE RESTRICT,
    name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 200),
    status text NOT NULL DEFAULT 'lead' CHECK (status IN ('lead', 'qualified', 'onboarding', 'active', 'inactive')),
    owner_user_id uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT crm_accounts_tenant_id_id_unique UNIQUE (tenant_id, id),
    CONSTRAINT crm_accounts_owner_membership_fk
        FOREIGN KEY (tenant_id, owner_user_id)
        REFERENCES business_os.memberships(tenant_id, user_id)
        ON DELETE RESTRICT
);

CREATE INDEX crm_accounts_by_tenant_status ON business_os.crm_accounts(tenant_id, status);
CREATE INDEX crm_accounts_by_tenant_owner ON business_os.crm_accounts(tenant_id, owner_user_id);

CREATE TABLE business_os.crm_contacts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES business_os.organizations(id) ON DELETE RESTRICT,
    account_id uuid NOT NULL,
    full_name text NOT NULL CHECK (length(trim(full_name)) BETWEEN 1 AND 200),
    email text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT crm_contacts_tenant_id_id_unique UNIQUE (tenant_id, id),
    CONSTRAINT crm_contacts_account_fk
        FOREIGN KEY (tenant_id, account_id)
        REFERENCES business_os.crm_accounts(tenant_id, id)
        ON DELETE RESTRICT
);

CREATE INDEX crm_contacts_by_tenant_account ON business_os.crm_contacts(tenant_id, account_id);

-- Missing or empty context resolves to NULL and grants no tenant rows.
-- The API must set the tenant context *inside a transaction* using SET LOCAL,
-- only AFTER verifying authenticated membership and permission.
CREATE OR REPLACE FUNCTION business_os.current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $func$
    SELECT NULLIF(current_setting('business_os.tenant_id', true), '')::uuid
$func$;

ALTER TABLE business_os.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_os.organizations FORCE ROW LEVEL SECURITY;
CREATE POLICY organization_tenant_select ON business_os.organizations
    FOR SELECT USING (id = business_os.current_tenant_id());

ALTER TABLE business_os.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_os.memberships FORCE ROW LEVEL SECURITY;
CREATE POLICY membership_tenant_select ON business_os.memberships
    FOR SELECT USING (tenant_id = business_os.current_tenant_id());

ALTER TABLE business_os.crm_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_os.crm_accounts FORCE ROW LEVEL SECURITY;
CREATE POLICY account_tenant_scope ON business_os.crm_accounts
    FOR ALL
    USING (tenant_id = business_os.current_tenant_id())
    WITH CHECK (tenant_id = business_os.current_tenant_id());

ALTER TABLE business_os.crm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_os.crm_contacts FORCE ROW LEVEL SECURITY;
CREATE POLICY contact_tenant_scope ON business_os.crm_contacts
    FOR ALL
    USING (tenant_id = business_os.current_tenant_id())
    WITH CHECK (tenant_id = business_os.current_tenant_id());

-- The global users table is not directly accessible to the application role.
-- A separate authenticated identity adapter will be required before CRUD endpoints exist.

COMMIT;
