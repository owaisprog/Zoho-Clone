-- Disposable CI only. Narrow explicit sales-rep/own-record slice; NOT production policy.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' OR current_user<>'demo_ci'
 OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
 OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='p4_r69_ci')
 OR to_regclass('p4_r40_ci.sales_roles') IS NULL
 THEN RAISE EXCEPTION 'P4_R69_CI_ONLY'; END IF;
END $$;
CREATE SCHEMA p4_r69_ci;
REVOKE ALL ON SCHEMA p4_r69_ci FROM PUBLIC;
GRANT USAGE ON SCHEMA p4_r69_ci TO p4_synthetic_ci_runtime;
CREATE TABLE p4_r69_ci.crm_entitlements(
 org_id uuid PRIMARY KEY REFERENCES p4_synthetic.organizations(id),
 active boolean NOT NULL DEFAULT false
);
CREATE TABLE p4_r69_ci.accounts(
 org_id uuid NOT NULL, id uuid NOT NULL, owner_user_id text NOT NULL,
 name text NOT NULL CHECK(name ~ '^Demo [A-Za-z][A-Za-z0-9 &.-]{2,148}$'),
 website_label text CHECK(website_label ~ '^https://[a-z0-9-]{1,63}[.]example[.]com$'),
 revision integer NOT NULL DEFAULT 0 CHECK(revision BETWEEN 0 AND 1000000),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(org_id,id),
 FOREIGN KEY(org_id,owner_user_id) REFERENCES p4_synthetic.memberships(org_id,user_id)
);
CREATE INDEX r69_accounts_owner ON p4_r69_ci.accounts(org_id,owner_user_id,id);
CREATE UNIQUE INDEX r69_own_name ON p4_r69_ci.accounts(org_id,owner_user_id,lower(name));
CREATE TABLE p4_r69_ci.account_events(
 org_id uuid NOT NULL, account_id uuid NOT NULL, revision integer NOT NULL,
 actor_user_id text NOT NULL, action text NOT NULL CHECK(action IN ('CREATED','UPDATED')),
 occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(org_id,account_id,revision),
 FOREIGN KEY(org_id,account_id) REFERENCES p4_r69_ci.accounts(org_id,id)
);
ALTER TABLE p4_r69_ci.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE p4_r69_ci.accounts FORCE ROW LEVEL SECURITY;
ALTER TABLE p4_r69_ci.account_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE p4_r69_ci.account_events FORCE ROW LEVEL SECURITY;
ALTER TABLE p4_r69_ci.crm_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE p4_r69_ci.crm_entitlements FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA p4_r69_ci FROM PUBLIC,p4_synthetic_ci_runtime;
CREATE FUNCTION p4_r69_ci.immutable_event() RETURNS trigger
 LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN RAISE EXCEPTION 'AUDIT_IMMUTABLE'; END $$;
CREATE TRIGGER account_event_immutable BEFORE UPDATE OR DELETE ON p4_r69_ci.account_events
 FOR EACH ROW EXECUTE FUNCTION p4_r69_ci.immutable_event();
CREATE FUNCTION p4_r69_ci.require_rep(p_org uuid) RETURNS text
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE who text:=nullif(current_setting('app.actor_id',true),'');
BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci'
 OR current_setting('role',true)<>'p4_synthetic_ci_runtime'
 OR p_org::text IS DISTINCT FROM nullif(current_setting('app.tenant_id',true),'')
 OR NOT EXISTS(SELECT 1 FROM p4_synthetic.memberships m
 JOIN p4_synthetic.identity_subjects s ON s.user_id=m.user_id AND s.email_verified
 JOIN p4_r40_ci.sales_roles r ON r.org_id=m.org_id AND r.user_id=m.user_id
 JOIN p4_r69_ci.crm_entitlements e ON e.org_id=m.org_id AND e.active
 WHERE m.org_id=p_org AND m.user_id=who AND m.active AND m.role='MEMBER'
 AND r.role_code='SALES_REP')
 THEN RAISE EXCEPTION USING ERRCODE='P4003',MESSAGE='ACCESS_DENIED'; END IF;
 RETURN who;
END $$;
CREATE FUNCTION p4_r69_ci.save_account(p_org uuid,p_id uuid,p_name text,p_website text,p_expected integer)
 RETURNS TABLE(id uuid,name text,website_label text,revision integer,created_at timestamptz)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE who text:=p4_r69_ci.require_rep(p_org);
BEGIN
 IF p_id IS NULL OR p_name IS NULL OR p_name !~ '^Demo [A-Za-z][A-Za-z0-9 &.-]{2,148}$'
 OR (p_website IS NOT NULL AND p_website !~ '^https://[a-z0-9-]{1,63}[.]example[.]com$')
 OR (p_expected IS NOT NULL AND (p_expected<0 OR p_expected>=1000000))
 THEN RAISE EXCEPTION USING ERRCODE='P6900',MESSAGE='INVALID_INPUT'; END IF;
 IF p_expected IS NULL THEN
  INSERT INTO p4_r69_ci.accounts(org_id,id,owner_user_id,name,website_label)
  VALUES(p_org,p_id,who,p_name,p_website);
 ELSE
  UPDATE p4_r69_ci.accounts a SET name=p_name,website_label=p_website,revision=a.revision+1
  WHERE a.org_id=p_org AND a.id=p_id AND a.owner_user_id=who AND a.revision=p_expected;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P4009',MESSAGE='CONFLICT'; END IF;
 END IF;
 INSERT INTO p4_r69_ci.account_events(org_id,account_id,revision,actor_user_id,action)
 VALUES(p_org,p_id,coalesce(p_expected+1,0),who,CASE WHEN p_expected IS NULL THEN 'CREATED' ELSE 'UPDATED' END);
 RETURN QUERY SELECT a.id,a.name,a.website_label,a.revision,a.created_at
 FROM p4_r69_ci.accounts a WHERE a.org_id=p_org AND a.id=p_id AND a.owner_user_id=who;
END $$;
CREATE FUNCTION p4_r69_ci.list_accounts(p_org uuid,p_after uuid)
 RETURNS TABLE(id uuid,name text,website_label text,revision integer,created_at timestamptz)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE who text:=p4_r69_ci.require_rep(p_org);
BEGIN
 RETURN QUERY SELECT a.id,a.name,a.website_label,a.revision,a.created_at
 FROM p4_r69_ci.accounts a WHERE a.org_id=p_org AND a.owner_user_id=who
 AND (p_after IS NULL OR a.id>p_after) ORDER BY a.id LIMIT 21;
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA p4_r69_ci FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p4_r69_ci.save_account(uuid,uuid,text,text,integer),p4_r69_ci.list_accounts(uuid,uuid) TO p4_synthetic_ci_runtime;
COMMIT;
