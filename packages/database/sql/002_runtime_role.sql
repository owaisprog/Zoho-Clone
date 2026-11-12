-- Bootstrap runtime privileges as an administrator/role manager.
-- Never set a hard-coded password here. Runtime LOGIN credentials are supplied
-- securely out-of-band; this NOLOGIN privilege role is granted to that account.
BEGIN;

DO $create$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'business_os_app') THEN
        CREATE ROLE business_os_app NOLOGIN NOBYPASSRLS;
    END IF;
END
$create$;

GRANT USAGE ON SCHEMA business_os TO business_os_app;
GRANT EXECUTE ON FUNCTION business_os.current_tenant_id() TO business_os_app;
GRANT SELECT ON business_os.organizations, business_os.memberships TO business_os_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON business_os.crm_accounts, business_os.crm_contacts TO business_os_app;

-- The runtime role must not own tables, run migrations, bypass RLS, or access
-- business_os.users until a permission-scoped identity contract is implemented.

COMMIT;
