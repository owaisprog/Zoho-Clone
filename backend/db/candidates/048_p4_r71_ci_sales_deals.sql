-- R71 disposable CI sales Deals. Fixed fictional pipeline; no processor state.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' OR current_user<>'demo_ci'
 OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
 OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='p4_r71_ci')
 OR to_regclass('p4_r70_ci.contacts') IS NULL
 THEN RAISE EXCEPTION 'P4_R71_CI_ONLY'; END IF;
END $$;
CREATE SCHEMA p4_r71_ci;
REVOKE ALL ON SCHEMA p4_r71_ci FROM PUBLIC;
GRANT USAGE ON SCHEMA p4_r71_ci TO p4_synthetic_ci_runtime;
CREATE TABLE p4_r71_ci.pipelines(
 org_id uuid NOT NULL REFERENCES p4_synthetic.organizations(id),
 id uuid NOT NULL, code text NOT NULL CHECK(code='DEMO_SALES'),
 active boolean NOT NULL DEFAULT true,
 PRIMARY KEY(org_id,id),UNIQUE(org_id,code)
);
CREATE TABLE p4_r71_ci.stages(
 org_id uuid NOT NULL,pipeline_id uuid NOT NULL,id uuid NOT NULL,
 code text NOT NULL CHECK(code IN ('OPEN','DISCOVERY','PROPOSAL','NEGOTIATION','WON','LOST')),
 PRIMARY KEY(org_id,pipeline_id,id),UNIQUE(org_id,pipeline_id,code),
 FOREIGN KEY(org_id,pipeline_id) REFERENCES p4_r71_ci.pipelines(org_id,id)
);
CREATE TABLE p4_r71_ci.deals(
 org_id uuid NOT NULL,id uuid NOT NULL,owner_user_id text NOT NULL,
 title text NOT NULL CHECK(title ~ '^Demo [A-Za-z][A-Za-z0-9 &.-]{2,148}$'),
 account_id uuid NOT NULL,contact_id uuid NOT NULL,
 pipeline_id uuid NOT NULL,stage_id uuid NOT NULL,
 revision integer NOT NULL DEFAULT 0 CHECK(revision BETWEEN 0 AND 1000000),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(org_id,id),
 FOREIGN KEY(org_id,owner_user_id) REFERENCES p4_synthetic.memberships(org_id,user_id),
 FOREIGN KEY(org_id,account_id) REFERENCES p4_r69_ci.accounts(org_id,id),
 FOREIGN KEY(org_id,contact_id) REFERENCES p4_r70_ci.contacts(org_id,id),
 FOREIGN KEY(org_id,pipeline_id,stage_id) REFERENCES p4_r71_ci.stages(org_id,pipeline_id,id)
);
CREATE INDEX r71_deals_owner ON p4_r71_ci.deals(org_id,owner_user_id,id);
CREATE TABLE p4_r71_ci.deal_events(
 org_id uuid NOT NULL,deal_id uuid NOT NULL,revision integer NOT NULL,
 actor_user_id text NOT NULL,before_stage text,after_stage text NOT NULL,
 occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(org_id,deal_id,revision),
 FOREIGN KEY(org_id,deal_id) REFERENCES p4_r71_ci.deals(org_id,id),
 CHECK(after_stage IN ('OPEN','DISCOVERY','PROPOSAL','NEGOTIATION','WON','LOST')),
 CHECK((revision=0 AND before_stage IS NULL AND after_stage='OPEN') OR
 (revision>0 AND before_stage IS NOT NULL AND before_stage<>after_stage))
);
ALTER TABLE p4_r71_ci.pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE p4_r71_ci.pipelines FORCE ROW LEVEL SECURITY;
ALTER TABLE p4_r71_ci.stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE p4_r71_ci.stages FORCE ROW LEVEL SECURITY;
ALTER TABLE p4_r71_ci.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE p4_r71_ci.deals FORCE ROW LEVEL SECURITY;
ALTER TABLE p4_r71_ci.deal_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE p4_r71_ci.deal_events FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA p4_r71_ci FROM PUBLIC,p4_synthetic_ci_runtime;
CREATE TRIGGER deal_event_immutable BEFORE UPDATE OR DELETE ON p4_r71_ci.deal_events
 FOR EACH ROW EXECUTE FUNCTION p4_r69_ci.immutable_event();

-- Shared result projection: callers must enforce org and owner before calling.
CREATE FUNCTION p4_r71_ci.owned_deal(p_org uuid,p_id uuid,p_who text)
 RETURNS TABLE(id uuid,title text,account_id uuid,contact_id uuid,pipeline_id uuid,stage_id uuid,
 stage text,revision integer,created_at timestamptz)
 LANGUAGE sql SET search_path=pg_catalog AS $$
 SELECT d.id,d.title,d.account_id,d.contact_id,d.pipeline_id,d.stage_id,s.code,d.revision,d.created_at
 FROM p4_r71_ci.deals d JOIN p4_r71_ci.stages s
 ON s.org_id=d.org_id AND s.pipeline_id=d.pipeline_id AND s.id=d.stage_id
 WHERE d.org_id=p_org AND d.id=p_id AND d.owner_user_id=p_who;
$$;
CREATE FUNCTION p4_r71_ci.create_deal(p_org uuid,p_id uuid,p_title text,p_account uuid,p_contact uuid)
 RETURNS TABLE(id uuid,title text,account_id uuid,contact_id uuid,pipeline_id uuid,stage_id uuid,
 stage text,revision integer,created_at timestamptz)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE who text:=p4_r69_ci.require_rep(p_org); pipe uuid; initial uuid;
BEGIN
 IF p_id IS NULL OR p_title IS NULL OR p_title !~ '^Demo [A-Za-z][A-Za-z0-9 &.-]{2,148}$'
 OR p_account IS NULL OR p_contact IS NULL
 THEN RAISE EXCEPTION USING ERRCODE='P7100',MESSAGE='INVALID_INPUT'; END IF;
 IF NOT EXISTS(SELECT 1 FROM p4_r69_ci.accounts a JOIN p4_r70_ci.contacts c
 ON c.org_id=a.org_id AND c.account_id=a.id
 WHERE a.org_id=p_org AND a.id=p_account AND c.id=p_contact AND a.owner_user_id=who AND c.owner_user_id=who)
 THEN RAISE EXCEPTION USING ERRCODE='P4009',MESSAGE='CONFLICT'; END IF;
 SELECT p.id,s.id INTO pipe,initial FROM p4_r71_ci.pipelines p JOIN p4_r71_ci.stages s
 ON s.org_id=p.org_id AND s.pipeline_id=p.id
 WHERE p.org_id=p_org AND p.code='DEMO_SALES' AND p.active AND s.code='OPEN';
 IF pipe IS NULL OR initial IS NULL THEN RAISE EXCEPTION USING ERRCODE='P4009',MESSAGE='CONFLICT'; END IF;
 INSERT INTO p4_r71_ci.deals(org_id,id,owner_user_id,title,account_id,contact_id,pipeline_id,stage_id)
 VALUES(p_org,p_id,who,p_title,p_account,p_contact,pipe,initial);
 INSERT INTO p4_r71_ci.deal_events(org_id,deal_id,revision,actor_user_id,before_stage,after_stage)
 VALUES(p_org,p_id,0,who,NULL,'OPEN');
 RETURN QUERY SELECT * FROM p4_r71_ci.owned_deal(p_org,p_id,who);
END $$;
CREATE FUNCTION p4_r71_ci.change_stage(p_org uuid,p_id uuid,p_next text,p_expected integer)
 RETURNS TABLE(id uuid,title text,account_id uuid,contact_id uuid,pipeline_id uuid,stage_id uuid,
 stage text,revision integer,created_at timestamptz)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE who text:=p4_r69_ci.require_rep(p_org); prior text; pipe uuid; next_id uuid; ver integer;
BEGIN
 IF p_id IS NULL OR p_next IS NULL OR p_next NOT IN ('DISCOVERY','PROPOSAL','NEGOTIATION','WON','LOST')
 OR p_expected IS NULL OR p_expected<0 OR p_expected>=1000000
 THEN RAISE EXCEPTION USING ERRCODE='P7100',MESSAGE='INVALID_INPUT'; END IF;
 SELECT s.code,d.pipeline_id,d.revision INTO prior,pipe,ver FROM p4_r71_ci.deals d
 JOIN p4_r71_ci.stages s ON s.org_id=d.org_id AND s.pipeline_id=d.pipeline_id AND s.id=d.stage_id
 JOIN p4_r71_ci.pipelines p ON p.org_id=d.org_id AND p.id=d.pipeline_id AND p.active
 WHERE d.org_id=p_org AND d.id=p_id AND d.owner_user_id=who FOR UPDATE OF d;
 IF prior IS NULL OR ver<>p_expected OR NOT (
 (prior='OPEN' AND p_next IN ('DISCOVERY','LOST')) OR
 (prior='DISCOVERY' AND p_next IN ('PROPOSAL','LOST')) OR
 (prior='PROPOSAL' AND p_next IN ('NEGOTIATION','LOST')) OR
 (prior='NEGOTIATION' AND p_next IN ('WON','LOST')))
 THEN RAISE EXCEPTION USING ERRCODE='P4009',MESSAGE='CONFLICT'; END IF;
 SELECT s.id INTO next_id FROM p4_r71_ci.stages s WHERE s.org_id=p_org AND s.pipeline_id=pipe AND s.code=p_next;
 IF next_id IS NULL THEN RAISE EXCEPTION USING ERRCODE='P4009',MESSAGE='CONFLICT'; END IF;
 UPDATE p4_r71_ci.deals d SET stage_id=next_id,revision=d.revision+1
 WHERE d.org_id=p_org AND d.id=p_id AND d.owner_user_id=who AND d.revision=p_expected;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P4009',MESSAGE='CONFLICT'; END IF;
 INSERT INTO p4_r71_ci.deal_events(org_id,deal_id,revision,actor_user_id,before_stage,after_stage)
 VALUES(p_org,p_id,p_expected+1,who,prior,p_next);
 RETURN QUERY SELECT * FROM p4_r71_ci.owned_deal(p_org,p_id,who);
END $$;
CREATE FUNCTION p4_r71_ci.list_deals(p_org uuid,p_after uuid)
 RETURNS TABLE(id uuid,title text,account_id uuid,contact_id uuid,pipeline_id uuid,stage_id uuid,
 stage text,revision integer,created_at timestamptz)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE who text:=p4_r69_ci.require_rep(p_org);
BEGIN
 RETURN QUERY SELECT d.id,d.title,d.account_id,d.contact_id,d.pipeline_id,d.stage_id,s.code,d.revision,d.created_at
 FROM p4_r71_ci.deals d JOIN p4_r71_ci.stages s
 ON s.org_id=d.org_id AND s.pipeline_id=d.pipeline_id AND s.id=d.stage_id
 WHERE d.org_id=p_org AND d.owner_user_id=who AND (p_after IS NULL OR d.id>p_after)
 ORDER BY d.id LIMIT 21;
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA p4_r71_ci FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p4_r71_ci.create_deal(uuid,uuid,text,uuid,uuid),
 p4_r71_ci.change_stage(uuid,uuid,text,integer),p4_r71_ci.list_deals(uuid,uuid)
 TO p4_synthetic_ci_runtime;
COMMIT;
