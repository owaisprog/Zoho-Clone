-- R76 explicit record-level team sharing in disposable CI. No broad team mutation privileges.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' OR current_user<>'demo_ci'
 OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
 OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='p4_r76_ci')
 OR to_regclass('p4_r74_ci.deal_team_assignments') IS NULL
 THEN RAISE EXCEPTION 'P4_R76_CI_ONLY'; END IF;
END $$;
CREATE SCHEMA p4_r76_ci;
REVOKE ALL ON SCHEMA p4_r76_ci FROM PUBLIC;
GRANT USAGE ON SCHEMA p4_r76_ci TO p4_synthetic_ci_runtime;
ALTER TABLE p4_r74_ci.deal_team_assignments ADD COLUMN revision integer NOT NULL DEFAULT 0 CHECK(revision BETWEEN 0 AND 1000000);
CREATE TABLE p4_r76_ci.record_assignments(
 org_id uuid NOT NULL,kind text NOT NULL CHECK(kind IN ('LEAD','ACCOUNT','CONTACT')),record_id uuid NOT NULL,
 lead_id uuid GENERATED ALWAYS AS (CASE WHEN kind='LEAD' THEN record_id END) STORED,
 account_id uuid GENERATED ALWAYS AS (CASE WHEN kind='ACCOUNT' THEN record_id END) STORED,
 contact_id uuid GENERATED ALWAYS AS (CASE WHEN kind='CONTACT' THEN record_id END) STORED,
 team_id text NOT NULL,active boolean NOT NULL,revision integer NOT NULL CHECK(revision BETWEEN 0 AND 1000000),
 PRIMARY KEY(org_id,kind,record_id),
 FOREIGN KEY(org_id,lead_id) REFERENCES p4_r72_ci.leads(org_id,id),
 FOREIGN KEY(org_id,account_id) REFERENCES p4_r69_ci.accounts(org_id,id),
 FOREIGN KEY(org_id,contact_id) REFERENCES p4_r70_ci.contacts(org_id,id),
 FOREIGN KEY(org_id,team_id) REFERENCES p4_synthetic.teams(org_id,id)
);
CREATE TABLE p4_r76_ci.share_events(
 org_id uuid NOT NULL,kind text NOT NULL CHECK(kind IN ('LEAD','ACCOUNT','CONTACT','DEAL')),record_id uuid NOT NULL,
 revision integer NOT NULL,actor_user_id text NOT NULL,team_id text NOT NULL,active boolean NOT NULL,
 occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(org_id,kind,record_id,revision),
 FOREIGN KEY(org_id,actor_user_id) REFERENCES p4_synthetic.memberships(org_id,user_id),
 FOREIGN KEY(org_id,team_id) REFERENCES p4_synthetic.teams(org_id,id)
);
ALTER TABLE p4_r76_ci.record_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE p4_r76_ci.record_assignments FORCE ROW LEVEL SECURITY;
ALTER TABLE p4_r76_ci.share_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE p4_r76_ci.share_events FORCE ROW LEVEL SECURITY;
CREATE TRIGGER r76_event_immutable BEFORE UPDATE OR DELETE ON p4_r76_ci.share_events FOR EACH ROW EXECUTE FUNCTION p4_r69_ci.immutable_event();
CREATE VIEW p4_r76_ci.records AS
 SELECT l.org_id,'LEAD'::text AS kind,l.id,l.owner_user_id,l.company_name AS label,l.status FROM p4_r72_ci.leads l
 UNION ALL SELECT a.org_id,'ACCOUNT',a.id,a.owner_user_id,a.name,NULL::text FROM p4_r69_ci.accounts a
 UNION ALL SELECT c.org_id,'CONTACT',c.id,c.owner_user_id,c.display_name,NULL::text FROM p4_r70_ci.contacts c
 UNION ALL SELECT d.org_id,'DEAL',d.id,d.owner_user_id,d.title,s.code FROM p4_r71_ci.deals d
 JOIN p4_r71_ci.stages s ON s.org_id=d.org_id AND s.pipeline_id=d.pipeline_id AND s.id=d.stage_id;
CREATE VIEW p4_r76_ci.assignments AS
 SELECT a.org_id,a.kind,a.record_id,a.team_id,a.active,a.revision FROM p4_r76_ci.record_assignments a
 UNION ALL SELECT a.org_id,'DEAL',a.deal_id,a.team_id,a.active,a.revision FROM p4_r74_ci.deal_team_assignments a;
REVOKE ALL ON ALL TABLES IN SCHEMA p4_r76_ci FROM PUBLIC,p4_synthetic_ci_runtime;
CREATE FUNCTION p4_r76_ci.require_sales(p_org uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE who text:=nullif(current_setting('app.actor_id',true),''); role_code text;
BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' OR current_setting('role',true)<>'p4_synthetic_ci_runtime'
 OR p_org::text IS DISTINCT FROM nullif(current_setting('app.tenant_id',true),'')
 THEN RAISE EXCEPTION USING ERRCODE='P4003',MESSAGE='ACCESS_DENIED'; END IF;
 SELECT r.role_code INTO role_code FROM p4_synthetic.memberships m
 JOIN p4_r40_ci.sales_roles r ON r.org_id=m.org_id AND r.user_id=m.user_id
 JOIN p4_r69_ci.crm_entitlements e ON e.org_id=m.org_id AND e.active
 WHERE m.org_id=p_org AND m.user_id=who AND m.active AND m.role='MEMBER'
 AND EXISTS(SELECT 1 FROM p4_synthetic.identity_subjects s WHERE s.user_id=who AND s.email_verified);
 IF role_code IS NULL OR role_code NOT IN ('SALES_REP','SALES_MANAGER')
 THEN RAISE EXCEPTION USING ERRCODE='P4003',MESSAGE='ACCESS_DENIED'; END IF;
 RETURN role_code;
END $$;
CREATE FUNCTION p4_r76_ci.teams(p_org uuid) RETURNS TABLE(id text,name text)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE r text:=p4_r76_ci.require_sales(p_org); who text:=nullif(current_setting('app.actor_id',true),'');
BEGIN
 RETURN QUERY SELECT t.id,t.name FROM p4_synthetic.teams t
 JOIN p4_synthetic.team_memberships m ON m.org_id=t.org_id AND m.team_id=t.id AND m.user_id=who AND m.active
 JOIN p4_synthetic.departments dep ON dep.org_id=t.org_id AND dep.id=t.department_id AND dep.active
 WHERE t.org_id=p_org AND t.active AND (r='SALES_REP' OR t.manager_user_id=who)
 ORDER BY t.id LIMIT 101;
END $$;
CREATE FUNCTION p4_r76_ci.get_assignment(p_org uuid,p_kind text,p_record uuid)
 RETURNS TABLE(team_id text,active boolean,revision integer)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE who text:=p4_r69_ci.require_rep(p_org);
BEGIN
 IF p_kind IS NULL OR p_kind NOT IN ('LEAD','ACCOUNT','CONTACT','DEAL') OR p_record IS NULL
 THEN RAISE EXCEPTION USING ERRCODE='P7600',MESSAGE='INVALID_INPUT'; END IF;
 IF NOT EXISTS(SELECT 1 FROM p4_r76_ci.records r WHERE r.org_id=p_org AND r.kind=p_kind AND r.id=p_record AND r.owner_user_id=who)
 THEN RAISE EXCEPTION USING ERRCODE='P4003',MESSAGE='ACCESS_DENIED'; END IF;
 RETURN QUERY SELECT a.team_id,a.active,a.revision FROM p4_r76_ci.assignments a
 WHERE a.org_id=p_org AND a.kind=p_kind AND a.record_id=p_record;
END $$;
CREATE FUNCTION p4_r76_ci.set_assignment(p_org uuid,p_kind text,p_record uuid,p_team text,p_active boolean,p_expected integer)
 RETURNS TABLE(team_id text,active boolean,revision integer)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE who text:=p4_r69_ci.require_rep(p_org); old_team text; old_active boolean; old_revision integer; next_revision integer;
BEGIN
 IF p_kind IS NULL OR p_kind NOT IN ('LEAD','ACCOUNT','CONTACT','DEAL') OR p_record IS NULL
 OR p_team IS NULL OR p_team !~ '^team_demo_[a-z]{2,24}$' OR p_active IS NULL
 OR (p_expected IS NOT NULL AND (p_expected<0 OR p_expected>=1000000))
 THEN RAISE EXCEPTION USING ERRCODE='P7600',MESSAGE='INVALID_INPUT'; END IF;
 IF NOT EXISTS(SELECT 1 FROM p4_r76_ci.records r WHERE r.org_id=p_org AND r.kind=p_kind AND r.id=p_record AND r.owner_user_id=who)
 THEN RAISE EXCEPTION USING ERRCODE='P4003',MESSAGE='ACCESS_DENIED'; END IF;
 IF p_active AND NOT EXISTS(SELECT 1 FROM p4_r76_ci.teams(p_org) t WHERE t.id=p_team)
 THEN RAISE EXCEPTION USING ERRCODE='P4003',MESSAGE='ACCESS_DENIED'; END IF;
 IF p_kind='DEAL' THEN
  SELECT a.team_id,a.active,a.revision INTO old_team,old_active,old_revision FROM p4_r74_ci.deal_team_assignments a WHERE a.org_id=p_org AND a.deal_id=p_record FOR UPDATE;
 ELSE
  SELECT a.team_id,a.active,a.revision INTO old_team,old_active,old_revision FROM p4_r76_ci.record_assignments a WHERE a.org_id=p_org AND a.kind=p_kind AND a.record_id=p_record FOR UPDATE;
 END IF;
 IF old_revision IS DISTINCT FROM p_expected OR (old_revision IS NULL AND NOT p_active)
 OR (old_revision IS NOT NULL AND ((old_active AND p_active) OR (NOT old_active AND NOT p_active) OR (NOT p_active AND p_team<>old_team)))
 THEN RAISE EXCEPTION USING ERRCODE='P4009',MESSAGE='CONFLICT'; END IF;
 next_revision:=coalesce(old_revision+1,0);
 IF p_kind='DEAL' THEN
  IF old_revision IS NULL THEN
   INSERT INTO p4_r74_ci.deal_team_assignments(org_id,deal_id,team_id,active,revision) VALUES(p_org,p_record,p_team,p_active,next_revision);
  ELSE
   UPDATE p4_r74_ci.deal_team_assignments a SET team_id=p_team,active=p_active,revision=next_revision WHERE a.org_id=p_org AND a.deal_id=p_record;
  END IF;
 ELSE
  IF old_revision IS NULL THEN
   INSERT INTO p4_r76_ci.record_assignments(org_id,kind,record_id,team_id,active,revision) VALUES(p_org,p_kind,p_record,p_team,p_active,next_revision);
  ELSE
   UPDATE p4_r76_ci.record_assignments a SET team_id=p_team,active=p_active,revision=next_revision WHERE a.org_id=p_org AND a.kind=p_kind AND a.record_id=p_record;
  END IF;
 END IF;
 INSERT INTO p4_r76_ci.share_events(org_id,kind,record_id,revision,actor_user_id,team_id,active)
 VALUES(p_org,p_kind,p_record,next_revision,who,p_team,p_active);
 RETURN QUERY SELECT p_team,p_active,next_revision;
END $$;
CREATE FUNCTION p4_r76_ci.shared_records(p_org uuid,p_team text,p_kind text,p_after uuid)
 RETURNS TABLE(id uuid,label text,status text,owner_user_id text)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF p_kind IS NULL OR p_kind NOT IN ('LEAD','ACCOUNT','CONTACT','DEAL') OR p_team IS NULL OR p_team !~ '^team_demo_[a-z]{2,24}$'
 THEN RAISE EXCEPTION USING ERRCODE='P7600',MESSAGE='INVALID_INPUT'; END IF;
 IF NOT EXISTS(SELECT 1 FROM p4_r76_ci.teams(p_org) t WHERE t.id=p_team)
 THEN RAISE EXCEPTION USING ERRCODE='P4003',MESSAGE='ACCESS_DENIED'; END IF;
 RETURN QUERY SELECT r.id,r.label,r.status,r.owner_user_id FROM p4_r76_ci.records r
 JOIN p4_r76_ci.assignments a ON a.org_id=r.org_id AND a.kind=r.kind AND a.record_id=r.id AND a.active
 JOIN p4_synthetic.team_memberships tm ON tm.org_id=r.org_id AND tm.team_id=a.team_id AND tm.user_id=r.owner_user_id AND tm.active
 JOIN p4_synthetic.memberships m ON m.org_id=r.org_id AND m.user_id=r.owner_user_id AND m.active AND m.role='MEMBER'
 JOIN p4_r40_ci.sales_roles sr ON sr.org_id=r.org_id AND sr.user_id=r.owner_user_id AND sr.role_code='SALES_REP'
 WHERE r.org_id=p_org AND r.kind=p_kind AND a.team_id=p_team AND (p_after IS NULL OR r.id>p_after)
 ORDER BY r.id LIMIT 21;
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA p4_r76_ci FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p4_r76_ci.teams(uuid),p4_r76_ci.get_assignment(uuid,text,uuid),p4_r76_ci.set_assignment(uuid,text,uuid,text,boolean,integer),p4_r76_ci.shared_records(uuid,text,text,uuid) TO p4_synthetic_ci_runtime;
COMMIT;
