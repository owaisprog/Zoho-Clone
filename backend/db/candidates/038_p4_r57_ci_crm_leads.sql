-- P4 R57 fictional persisted CRM lead lifecycle; CI database only.
-- SECURITY DEFINER owned only by disposable demo_ci, never owner Neon.
\set ON_ERROR_STOP on
BEGIN;
DO $guard$ BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci'
 OR current_user<>'demo_ci'
 OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
 OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='p4_r57_ci')
 OR to_regprocedure('p4_r40_ci.require_current_owner(uuid)') IS NULL
 THEN RAISE EXCEPTION 'P4_R57_CI_ONLY'; END IF;
END $guard$;
CREATE SCHEMA p4_r57_ci;
REVOKE ALL ON SCHEMA p4_r57_ci FROM PUBLIC;
GRANT USAGE ON SCHEMA p4_r57_ci TO p4_synthetic_ci_runtime;

CREATE TABLE p4_r57_ci.leads(
 org_id uuid NOT NULL REFERENCES p4_synthetic.organizations(id) ON DELETE RESTRICT,
 lead_id uuid NOT NULL,
 request_id uuid NOT NULL,
 company_name text NOT NULL CHECK(company_name ~ '^Demo [A-Za-z][A-Za-z0-9 &.-]{2,48}$'),
 contact_email text NOT NULL CHECK(contact_email ~ '^[a-z][a-z0-9._-]{1,40}@example[.]com$'),
 source text NOT NULL CHECK(source IN ('WEBSITE','REFERRAL','EVENT')),
 status text NOT NULL DEFAULT 'NEW' CHECK(status IN ('NEW','CONTACTED','QUALIFIED','LOST')),
 revision integer NOT NULL DEFAULT 0 CHECK(revision BETWEEN 0 AND 1000000),
 created_by text NOT NULL CHECK(created_by ~ '^user_demo_[a-z]{2,16}$'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(org_id,lead_id),UNIQUE(org_id,request_id)
);
CREATE TABLE p4_r57_ci.lead_events(
 org_id uuid NOT NULL,
 event_id uuid NOT NULL,
 lead_id uuid NOT NULL,
 actor_user_id text NOT NULL,
 event_kind text NOT NULL CHECK(event_kind IN ('CREATED','STATUS_CHANGED')),
 before_status text,
 after_status text NOT NULL,
 revision integer NOT NULL,
 occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(org_id,event_id),
 FOREIGN KEY(org_id,lead_id) REFERENCES p4_r57_ci.leads(org_id,lead_id)
  ON DELETE RESTRICT,
 CHECK((event_kind='CREATED' AND before_status IS NULL AND revision=0
   AND after_status='NEW')
  OR(event_kind='STATUS_CHANGED' AND before_status IS NOT NULL
    AND before_status<>after_status AND revision>0))
);
ALTER TABLE p4_r57_ci.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE p4_r57_ci.leads FORCE ROW LEVEL SECURITY;
ALTER TABLE p4_r57_ci.lead_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE p4_r57_ci.lead_events FORCE ROW LEVEL SECURITY;
REVOKE ALL ON p4_r57_ci.leads,p4_r57_ci.lead_events FROM PUBLIC;
CREATE FUNCTION p4_r57_ci.immutable_event() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $body$
BEGIN RAISE EXCEPTION 'P4_R57_AUDIT_IMMUTABLE'; END $body$;
CREATE TRIGGER r57_event_immutable BEFORE UPDATE OR DELETE
 ON p4_r57_ci.lead_events FOR EACH ROW
 EXECUTE FUNCTION p4_r57_ci.immutable_event();

CREATE FUNCTION p4_r57_ci.create_lead(
 p_org uuid,p_lead uuid,p_request uuid,p_company text,p_email text,p_source text
) RETURNS TABLE(
 lead_id uuid,company_name text,contact_email text,source text,
 status text,revision integer,created_at timestamptz
) LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $body$
DECLARE who text;
BEGIN
 PERFORM p4_r40_ci.require_current_owner(p_org);
 who:=nullif(current_setting('app.actor_id',true),'');
 IF p_lead IS NULL OR p_request IS NULL
 OR p_company IS NULL OR p_company !~ '^Demo [A-Za-z][A-Za-z0-9 &.-]{2,48}$'
 OR p_email IS NULL OR p_email !~ '^[a-z][a-z0-9._-]{1,40}@example[.]com$'
 OR p_source IS NULL OR p_source NOT IN ('WEBSITE','REFERRAL','EVENT')
 THEN RAISE EXCEPTION USING ERRCODE='P5700',MESSAGE='INVALID_LEAD'; END IF;
 IF EXISTS(SELECT 1 FROM p4_r57_ci.leads l
  WHERE l.org_id=p_org AND l.contact_email=p_email)
 THEN RAISE EXCEPTION USING ERRCODE='P4009',MESSAGE='DUPLICATE_LEAD'; END IF;
 INSERT INTO p4_r57_ci.leads(org_id,lead_id,request_id,
  company_name,contact_email,source,created_by)
 VALUES(p_org,p_lead,p_request,p_company,p_email,p_source,who);
 INSERT INTO p4_r57_ci.lead_events(org_id,event_id,lead_id,
  actor_user_id,event_kind,before_status,after_status,revision)
 VALUES(p_org,p_request,p_lead,who,'CREATED',NULL,'NEW',0);
 RETURN QUERY
 SELECT l.lead_id,l.company_name,l.contact_email,l.source,
  l.status,l.revision,l.created_at
 FROM p4_r57_ci.leads l WHERE l.org_id=p_org AND l.lead_id=p_lead;
END $body$;

CREATE FUNCTION p4_r57_ci.list_leads(p_org uuid)
RETURNS TABLE(
 lead_id uuid,company_name text,contact_email text,source text,
 status text,revision integer,created_at timestamptz
) LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $body$
BEGIN
 PERFORM p4_r40_ci.require_current_owner(p_org);
 RETURN QUERY
 SELECT l.lead_id,l.company_name,l.contact_email,l.source,
  l.status,l.revision,l.created_at
 FROM p4_r57_ci.leads l WHERE l.org_id=p_org
 ORDER BY l.created_at DESC,l.lead_id DESC LIMIT 21;
END $body$;
REVOKE ALL ON FUNCTION
 p4_r57_ci.create_lead(uuid,uuid,uuid,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION p4_r57_ci.list_leads(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION
 p4_r57_ci.create_lead(uuid,uuid,uuid,text,text,text)
 TO p4_synthetic_ci_runtime;
GRANT EXECUTE ON FUNCTION p4_r57_ci.list_leads(uuid)
 TO p4_synthetic_ci_runtime;
COMMIT;
