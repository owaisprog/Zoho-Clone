-- R72 separate sales-authorized lead lifecycle and atomic conversion. Disposable CI only.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' OR current_user<>'demo_ci'
 OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
 OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='p4_r72_ci')
 OR to_regclass('p4_r71_ci.deals') IS NULL
 THEN RAISE EXCEPTION 'P4_R72_CI_ONLY'; END IF;
END $$;
CREATE SCHEMA p4_r72_ci;
REVOKE ALL ON SCHEMA p4_r72_ci FROM PUBLIC;
GRANT USAGE ON SCHEMA p4_r72_ci TO p4_synthetic_ci_runtime;
CREATE TABLE p4_r72_ci.leads(
 org_id uuid NOT NULL,id uuid NOT NULL,owner_user_id text NOT NULL,
 company_name text NOT NULL CHECK(company_name ~ '^Demo [A-Za-z][A-Za-z0-9 &.-]{2,48}$'),
 contact_name text NOT NULL CHECK(contact_name ~ '^Demo [A-Za-z][A-Za-z0-9 .-]{2,48}$'),
 email text NOT NULL CHECK(email ~ '^[a-z][a-z0-9._-]{1,40}@example[.]com$'),
 status text NOT NULL DEFAULT 'NEW' CHECK(status IN ('NEW','CONTACTED','QUALIFIED','LOST','CONVERTED')),
 revision integer NOT NULL DEFAULT 0 CHECK(revision BETWEEN 0 AND 1000000),
 account_id uuid,contact_id uuid,deal_id uuid,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(org_id,id),UNIQUE(org_id,owner_user_id,email),
 FOREIGN KEY(org_id,owner_user_id) REFERENCES p4_synthetic.memberships(org_id,user_id),
 FOREIGN KEY(org_id,account_id) REFERENCES p4_r69_ci.accounts(org_id,id),
 FOREIGN KEY(org_id,contact_id) REFERENCES p4_r70_ci.contacts(org_id,id),
 FOREIGN KEY(org_id,deal_id) REFERENCES p4_r71_ci.deals(org_id,id),
 CHECK((status='CONVERTED' AND account_id IS NOT NULL AND contact_id IS NOT NULL AND deal_id IS NOT NULL)
 OR(status<>'CONVERTED' AND account_id IS NULL AND contact_id IS NULL AND deal_id IS NULL))
);
CREATE INDEX r72_lead_owner ON p4_r72_ci.leads(org_id,owner_user_id,id);
CREATE TABLE p4_r72_ci.lead_events(
 org_id uuid NOT NULL,lead_id uuid NOT NULL,revision integer NOT NULL,
 actor_user_id text NOT NULL,before_status text,after_status text NOT NULL,
 occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(org_id,lead_id,revision),
 FOREIGN KEY(org_id,lead_id) REFERENCES p4_r72_ci.leads(org_id,id)
);
ALTER TABLE p4_r72_ci.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE p4_r72_ci.leads FORCE ROW LEVEL SECURITY;
ALTER TABLE p4_r72_ci.lead_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE p4_r72_ci.lead_events FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA p4_r72_ci FROM PUBLIC,p4_synthetic_ci_runtime;
CREATE TRIGGER lead_event_immutable BEFORE UPDATE OR DELETE ON p4_r72_ci.lead_events
 FOR EACH ROW EXECUTE FUNCTION p4_r69_ci.immutable_event();
CREATE FUNCTION p4_r72_ci.create_lead(p_org uuid,p_id uuid,p_company text,p_contact text,p_email text)
 RETURNS SETOF p4_r72_ci.leads LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE who text:=p4_r69_ci.require_rep(p_org);
BEGIN
 IF p_id IS NULL OR p_company IS NULL OR p_company !~ '^Demo [A-Za-z][A-Za-z0-9 &.-]{2,48}$'
 OR p_contact IS NULL OR p_contact !~ '^Demo [A-Za-z][A-Za-z0-9 .-]{2,48}$'
 OR p_email IS NULL OR p_email !~ '^[a-z][a-z0-9._-]{1,40}@example[.]com$'
 THEN RAISE EXCEPTION USING ERRCODE='P7200',MESSAGE='INVALID_INPUT'; END IF;
 INSERT INTO p4_r72_ci.leads(org_id,id,owner_user_id,company_name,contact_name,email)
 VALUES(p_org,p_id,who,p_company,p_contact,p_email);
 INSERT INTO p4_r72_ci.lead_events(org_id,lead_id,revision,actor_user_id,before_status,after_status)
 VALUES(p_org,p_id,0,who,NULL,'NEW');
 RETURN QUERY SELECT l.* FROM p4_r72_ci.leads l WHERE l.org_id=p_org AND l.id=p_id AND l.owner_user_id=who;
END $$;
CREATE FUNCTION p4_r72_ci.list_leads(p_org uuid,p_after uuid)
 RETURNS SETOF p4_r72_ci.leads LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE who text:=p4_r69_ci.require_rep(p_org);
BEGIN
 RETURN QUERY SELECT l.* FROM p4_r72_ci.leads l WHERE l.org_id=p_org AND l.owner_user_id=who
 AND (p_after IS NULL OR l.id>p_after) ORDER BY l.id LIMIT 21;
END $$;
CREATE FUNCTION p4_r72_ci.change_stage(p_org uuid,p_id uuid,p_next text,p_expected integer)
 RETURNS SETOF p4_r72_ci.leads LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE who text:=p4_r69_ci.require_rep(p_org); prior text; ver integer;
BEGIN
 IF p_id IS NULL OR p_next IS NULL OR p_next NOT IN ('CONTACTED','QUALIFIED','LOST')
 OR p_expected IS NULL OR p_expected<0 OR p_expected>=1000000
 THEN RAISE EXCEPTION USING ERRCODE='P7200',MESSAGE='INVALID_INPUT'; END IF;
 SELECT l.status,l.revision INTO prior,ver FROM p4_r72_ci.leads l
 WHERE l.org_id=p_org AND l.id=p_id AND l.owner_user_id=who FOR UPDATE;
 IF prior IS NULL OR ver<>p_expected OR NOT ((prior='NEW' AND p_next IN ('CONTACTED','LOST'))
 OR(prior='CONTACTED' AND p_next IN ('QUALIFIED','LOST')) OR(prior='QUALIFIED' AND p_next='LOST'))
 THEN RAISE EXCEPTION USING ERRCODE='P4009',MESSAGE='CONFLICT'; END IF;
 UPDATE p4_r72_ci.leads l SET status=p_next,revision=l.revision+1
 WHERE l.org_id=p_org AND l.id=p_id AND l.owner_user_id=who;
 INSERT INTO p4_r72_ci.lead_events(org_id,lead_id,revision,actor_user_id,before_status,after_status)
 VALUES(p_org,p_id,p_expected+1,who,prior,p_next);
 RETURN QUERY SELECT l.* FROM p4_r72_ci.leads l WHERE l.org_id=p_org AND l.id=p_id AND l.owner_user_id=who;
END $$;
CREATE FUNCTION p4_r72_ci.convert_lead(p_org uuid,p_id uuid,p_expected integer,p_account uuid,p_contact uuid,p_deal uuid,p_title text)
 RETURNS SETOF p4_r72_ci.leads LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE who text:=p4_r69_ci.require_rep(p_org); rec p4_r72_ci.leads%ROWTYPE;
BEGIN
 IF p_id IS NULL OR p_expected IS NULL OR p_expected<0 OR p_expected>=1000000
 OR p_account IS NULL OR p_contact IS NULL OR p_deal IS NULL
 OR p_title IS NULL OR p_title !~ '^Demo [A-Za-z][A-Za-z0-9 &.-]{2,148}$'
 THEN RAISE EXCEPTION USING ERRCODE='P7200',MESSAGE='INVALID_INPUT'; END IF;
 SELECT l.* INTO rec FROM p4_r72_ci.leads l
 WHERE l.org_id=p_org AND l.id=p_id AND l.owner_user_id=who FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P4009',MESSAGE='CONFLICT'; END IF;
 -- An identical replay after a committed conversion returns the original receipt.
 IF rec.status='CONVERTED' AND rec.revision=p_expected+1 AND EXISTS(
 SELECT 1 FROM p4_r71_ci.deals d WHERE d.org_id=p_org AND d.id=rec.deal_id AND d.title=p_title AND d.owner_user_id=who)
 THEN RETURN NEXT rec; RETURN; END IF;
 IF rec.status<>'QUALIFIED' OR rec.revision<>p_expected
 THEN RAISE EXCEPTION USING ERRCODE='P4009',MESSAGE='CONFLICT'; END IF;
 PERFORM p4_r69_ci.save_account(p_org,p_account,rec.company_name,NULL,NULL);
 PERFORM p4_r70_ci.save_contact(p_org,p_contact,rec.contact_name,rec.email,p_account,NULL);
 PERFORM p4_r71_ci.create_deal(p_org,p_deal,p_title,p_account,p_contact);
 UPDATE p4_r72_ci.leads l SET status='CONVERTED',revision=l.revision+1,
 account_id=p_account,contact_id=p_contact,deal_id=p_deal
 WHERE l.org_id=p_org AND l.id=p_id AND l.owner_user_id=who;
 INSERT INTO p4_r72_ci.lead_events(org_id,lead_id,revision,actor_user_id,before_status,after_status)
 VALUES(p_org,p_id,p_expected+1,who,'QUALIFIED','CONVERTED');
 RETURN QUERY SELECT l.* FROM p4_r72_ci.leads l WHERE l.org_id=p_org AND l.id=p_id AND l.owner_user_id=who;
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA p4_r72_ci FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p4_r72_ci.create_lead(uuid,uuid,text,text,text),p4_r72_ci.list_leads(uuid,uuid),
 p4_r72_ci.change_stage(uuid,uuid,text,integer),p4_r72_ci.convert_lead(uuid,uuid,integer,uuid,uuid,uuid,text) TO p4_synthetic_ci_runtime;
COMMIT;
