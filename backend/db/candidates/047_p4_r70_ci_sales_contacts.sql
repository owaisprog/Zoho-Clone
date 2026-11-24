-- R70 own-record Contacts, same-tenant permitted Account links, disposable CI only.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' OR current_user<>'demo_ci'
 OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
 OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='p4_r70_ci')
 OR to_regprocedure('p4_r69_ci.require_rep(uuid)') IS NULL
 THEN RAISE EXCEPTION 'P4_R70_CI_ONLY'; END IF;
END $$;
CREATE SCHEMA p4_r70_ci;
REVOKE ALL ON SCHEMA p4_r70_ci FROM PUBLIC;
GRANT USAGE ON SCHEMA p4_r70_ci TO p4_synthetic_ci_runtime;
CREATE TABLE p4_r70_ci.contacts(
 org_id uuid NOT NULL,id uuid NOT NULL,owner_user_id text NOT NULL,
 display_name text NOT NULL CHECK(display_name ~ '^Demo [A-Za-z][A-Za-z0-9 .-]{2,148}$'),
 email text NOT NULL CHECK(email ~ '^[a-z][a-z0-9._-]{1,40}@example[.]com$'),
 account_id uuid,
 revision integer NOT NULL DEFAULT 0 CHECK(revision BETWEEN 0 AND 1000000),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(org_id,id),
 FOREIGN KEY(org_id,owner_user_id) REFERENCES p4_synthetic.memberships(org_id,user_id),
 FOREIGN KEY(org_id,account_id) REFERENCES p4_r69_ci.accounts(org_id,id) ON DELETE RESTRICT
);
CREATE INDEX r70_contacts_owner ON p4_r70_ci.contacts(org_id,owner_user_id,id);
CREATE UNIQUE INDEX r70_own_email ON p4_r70_ci.contacts(org_id,owner_user_id,email);
CREATE TABLE p4_r70_ci.contact_events(
 org_id uuid NOT NULL,contact_id uuid NOT NULL,revision integer NOT NULL,
 actor_user_id text NOT NULL,action text NOT NULL CHECK(action IN ('CREATED','UPDATED')),
 occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(org_id,contact_id,revision),
 FOREIGN KEY(org_id,contact_id) REFERENCES p4_r70_ci.contacts(org_id,id)
);
ALTER TABLE p4_r70_ci.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE p4_r70_ci.contacts FORCE ROW LEVEL SECURITY;
ALTER TABLE p4_r70_ci.contact_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE p4_r70_ci.contact_events FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA p4_r70_ci FROM PUBLIC,p4_synthetic_ci_runtime;
CREATE TRIGGER contact_event_immutable BEFORE UPDATE OR DELETE ON p4_r70_ci.contact_events
 FOR EACH ROW EXECUTE FUNCTION p4_r69_ci.immutable_event();
CREATE FUNCTION p4_r70_ci.save_contact(p_org uuid,p_id uuid,p_name text,p_email text,p_account uuid,p_expected integer)
 RETURNS TABLE(id uuid,display_name text,email text,account_id uuid,revision integer,created_at timestamptz)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE who text:=p4_r69_ci.require_rep(p_org);
BEGIN
 IF p_id IS NULL OR p_name IS NULL OR p_name !~ '^Demo [A-Za-z][A-Za-z0-9 .-]{2,148}$'
 OR p_email IS NULL OR p_email !~ '^[a-z][a-z0-9._-]{1,40}@example[.]com$'
 OR (p_expected IS NOT NULL AND (p_expected<0 OR p_expected>=1000000))
 THEN RAISE EXCEPTION USING ERRCODE='P7000',MESSAGE='INVALID_INPUT'; END IF;
 IF p_account IS NOT NULL AND NOT EXISTS(SELECT 1 FROM p4_r69_ci.accounts a
 WHERE a.org_id=p_org AND a.id=p_account AND a.owner_user_id=who)
 THEN RAISE EXCEPTION USING ERRCODE='P4009',MESSAGE='CONFLICT'; END IF;
 IF p_expected IS NULL THEN
  INSERT INTO p4_r70_ci.contacts(org_id,id,owner_user_id,display_name,email,account_id)
  VALUES(p_org,p_id,who,p_name,p_email,p_account);
 ELSE
  UPDATE p4_r70_ci.contacts c SET display_name=p_name,email=p_email,account_id=p_account,revision=c.revision+1
  WHERE c.org_id=p_org AND c.id=p_id AND c.owner_user_id=who AND c.revision=p_expected;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P4009',MESSAGE='CONFLICT'; END IF;
 END IF;
 INSERT INTO p4_r70_ci.contact_events(org_id,contact_id,revision,actor_user_id,action)
 VALUES(p_org,p_id,coalesce(p_expected+1,0),who,CASE WHEN p_expected IS NULL THEN 'CREATED' ELSE 'UPDATED' END);
 RETURN QUERY SELECT c.id,c.display_name,c.email,c.account_id,c.revision,c.created_at
 FROM p4_r70_ci.contacts c WHERE c.org_id=p_org AND c.id=p_id AND c.owner_user_id=who;
END $$;
CREATE FUNCTION p4_r70_ci.list_contacts(p_org uuid,p_after uuid)
 RETURNS TABLE(id uuid,display_name text,email text,account_id uuid,revision integer,created_at timestamptz)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE who text:=p4_r69_ci.require_rep(p_org);
BEGIN
 RETURN QUERY SELECT c.id,c.display_name,c.email,c.account_id,c.revision,c.created_at
 FROM p4_r70_ci.contacts c WHERE c.org_id=p_org AND c.owner_user_id=who
 AND (p_after IS NULL OR c.id>p_after) ORDER BY c.id LIMIT 21;
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA p4_r70_ci FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p4_r70_ci.save_contact(uuid,uuid,text,text,uuid,integer),p4_r70_ci.list_contacts(uuid,uuid) TO p4_synthetic_ci_runtime;
COMMIT;
