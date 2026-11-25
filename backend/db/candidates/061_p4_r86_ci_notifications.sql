-- R86: atomic file scan event -> durable in-app notification outbox, disposable CI only.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' OR current_user<>'demo_ci'
 OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
 OR to_regnamespace('p4_r85_ci') IS NULL OR to_regnamespace('p4_r86_ci') IS NOT NULL
 THEN RAISE EXCEPTION 'P4_R86_DISPOSABLE_ONLY'; END IF;
END $$;
CREATE ROLE p4_r86_ci_writer NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
CREATE ROLE p4_r86_ci_worker LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD 'fake_ci_not_for_real_accounts';
CREATE SCHEMA p4_r86_ci AUTHORIZATION p4_r82_ci_owner;
REVOKE ALL ON SCHEMA p4_r86_ci FROM PUBLIC;
GRANT USAGE ON SCHEMA p4_r86_ci TO p4_r86_ci_writer,p4_r86_ci_worker,p4_r82_ci_runtime;
GRANT USAGE ON SCHEMA p4_r82_ci,p4_r84_ci,p4_r85_ci TO p4_r86_ci_writer;
GRANT EXECUTE ON FUNCTION p4_r84_ci.require_member(text,text,uuid,text) TO p4_r86_ci_writer;
GRANT SELECT(id,active) ON p4_r82_ci.users,p4_r82_ci.organizations TO p4_r86_ci_writer;
GRANT SELECT(user_id,verified,active) ON p4_r82_ci.identity_subjects TO p4_r86_ci_writer;
GRANT SELECT(organization_id,user_id,role,active) ON p4_r82_ci.memberships TO p4_r86_ci_writer;
CREATE POLICY r86_users ON p4_r82_ci.users FOR SELECT TO p4_r86_ci_writer USING(active);
CREATE POLICY r86_orgs ON p4_r82_ci.organizations FOR SELECT TO p4_r86_ci_writer USING(active);
CREATE POLICY r86_identity ON p4_r82_ci.identity_subjects FOR SELECT TO p4_r86_ci_writer USING(active AND verified);
CREATE POLICY r86_members ON p4_r82_ci.memberships FOR SELECT TO p4_r86_ci_writer USING(active);
GRANT SELECT ON p4_r84_ci.app_entitlements,p4_r84_ci.sales_roles TO p4_r86_ci_writer;
CREATE POLICY r86_entitlement ON p4_r84_ci.app_entitlements FOR SELECT TO p4_r86_ci_writer USING(active);
CREATE POLICY r86_sales ON p4_r84_ci.sales_roles FOR SELECT TO p4_r86_ci_writer USING(active);
GRANT SELECT(organization_id,id,parent_id,owner_id,state,revision) ON p4_r85_ci.files TO p4_r86_ci_writer;
GRANT SELECT(organization_id,id,owner_id,active) ON p4_r85_ci.attachment_parents TO p4_r86_ci_writer;
CREATE POLICY r86_files ON p4_r85_ci.files FOR SELECT TO p4_r86_ci_writer USING(true);
CREATE POLICY r86_parents ON p4_r85_ci.attachment_parents FOR SELECT TO p4_r86_ci_writer USING(active);
GRANT INSERT ON p4_r84_ci.audit_events TO p4_r86_ci_writer;
CREATE POLICY r86_audit_insert ON p4_r84_ci.audit_events FOR INSERT TO p4_r86_ci_writer WITH CHECK(action='notice.read');
CREATE TABLE p4_r86_ci.outbox(
 organization_id p4_r82_ci.uuid_v4 NOT NULL,id p4_r82_ci.uuid_v4 NOT NULL DEFAULT gen_random_uuid(),
 file_id p4_r82_ci.uuid_v4 NOT NULL,file_revision integer NOT NULL,recipient_id p4_r82_ci.uuid_v4 NOT NULL,
 kind text NOT NULL CHECK(kind IN ('FILE_SCAN_CLEAN','FILE_SCAN_REJECTED')),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','delivered','cancelled','dead')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 3),
 next_attempt_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(organization_id,id),UNIQUE(organization_id,file_id,file_revision),
 FOREIGN KEY(organization_id,file_id,file_revision) REFERENCES p4_r85_ci.file_events(organization_id,file_id,revision),
 FOREIGN KEY(organization_id,recipient_id) REFERENCES p4_r82_ci.memberships(organization_id,user_id));
CREATE INDEX r86_pending ON p4_r86_ci.outbox(next_attempt_at,id) WHERE status='pending';
CREATE TABLE p4_r86_ci.notices(
 organization_id p4_r82_ci.uuid_v4 NOT NULL,id p4_r82_ci.uuid_v4 NOT NULL,recipient_id p4_r82_ci.uuid_v4 NOT NULL,
 read_at timestamptz,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(organization_id,id),FOREIGN KEY(organization_id,id) REFERENCES p4_r86_ci.outbox(organization_id,id),
 FOREIGN KEY(organization_id,recipient_id) REFERENCES p4_r82_ci.memberships(organization_id,user_id));
CREATE INDEX r86_recipient ON p4_r86_ci.notices(organization_id,recipient_id,id);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['outbox','notices'] LOOP
  EXECUTE format('ALTER TABLE p4_r86_ci.%I OWNER TO p4_r82_ci_owner',t);
  EXECUTE format('ALTER TABLE p4_r86_ci.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE p4_r86_ci.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY r86_select ON p4_r86_ci.%I FOR SELECT TO p4_r86_ci_writer USING(true)',t);
  EXECUTE format('CREATE POLICY r86_insert ON p4_r86_ci.%I FOR INSERT TO p4_r86_ci_writer WITH CHECK(true)',t);
  EXECUTE format('CREATE POLICY r86_update ON p4_r86_ci.%I FOR UPDATE TO p4_r86_ci_writer USING(true) WITH CHECK(true)',t);
 END LOOP;
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA p4_r86_ci FROM PUBLIC,p4_r82_ci_runtime,p4_r86_ci_worker;
GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA p4_r86_ci TO p4_r86_ci_writer;
CREATE FUNCTION p4_r86_ci.enqueue_scan() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE recipient uuid;
BEGIN
 IF NEW.action NOT IN ('SCANNED_CLEAN','SCANNED_REJECTED') THEN RETURN NEW; END IF;
 SELECT f.owner_id INTO STRICT recipient FROM p4_r85_ci.files f WHERE f.organization_id=NEW.organization_id AND f.id=NEW.file_id AND f.revision=NEW.revision;
 INSERT INTO p4_r86_ci.outbox(organization_id,file_id,file_revision,recipient_id,kind)
 VALUES(NEW.organization_id,NEW.file_id,NEW.revision,recipient,CASE WHEN NEW.action='SCANNED_CLEAN' THEN 'FILE_SCAN_CLEAN' ELSE 'FILE_SCAN_REJECTED' END);
 RETURN NEW;
END $$;
ALTER FUNCTION p4_r86_ci.enqueue_scan() OWNER TO p4_r86_ci_writer;
REVOKE ALL ON FUNCTION p4_r86_ci.enqueue_scan() FROM PUBLIC;
CREATE TRIGGER r86_scan_notice AFTER INSERT ON p4_r85_ci.file_events FOR EACH ROW EXECUTE FUNCTION p4_r86_ci.enqueue_scan();
CREATE FUNCTION p4_r86_ci.eligible(p_org uuid,p_file uuid,p_rev integer,p_recipient uuid) RETURNS boolean
 LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM p4_r85_ci.files f
 JOIN p4_r85_ci.attachment_parents p ON p.organization_id=f.organization_id AND p.id=f.parent_id AND p.owner_id=f.owner_id AND p.active
 JOIN p4_r82_ci.organizations o ON o.id=f.organization_id AND o.active
 JOIN p4_r82_ci.users u ON u.id=f.owner_id AND u.active
 JOIN p4_r82_ci.memberships m ON m.organization_id=f.organization_id AND m.user_id=u.id AND m.active AND m.role='MEMBER'
 JOIN p4_r84_ci.sales_roles s ON s.organization_id=m.organization_id AND s.user_id=m.user_id AND s.role_code='SALES_REP' AND s.active
 JOIN p4_r84_ci.app_entitlements e ON e.organization_id=m.organization_id AND e.app_code='crm' AND e.active
 WHERE f.organization_id=p_org AND f.id=p_file AND f.owner_id=p_recipient AND f.revision=p_rev AND f.state IN ('scan_clean','rejected')
 AND EXISTS(SELECT 1 FROM p4_r82_ci.identity_subjects i WHERE i.user_id=u.id AND i.verified AND i.active)
 AND EXISTS(SELECT 1 FROM p4_r84_ci.app_entitlements x WHERE x.organization_id=p_org AND x.app_code='platform' AND x.active));
$$;
ALTER FUNCTION p4_r86_ci.eligible(uuid,uuid,integer,uuid) OWNER TO p4_r86_ci_writer;
REVOKE ALL ON FUNCTION p4_r86_ci.eligible(uuid,uuid,integer,uuid) FROM PUBLIC;
CREATE FUNCTION p4_r86_ci.deliver_one() RETURNS text
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE q p4_r86_ci.outbox%ROWTYPE;
BEGIN
 SELECT * INTO q FROM p4_r86_ci.outbox WHERE status='pending' AND next_attempt_at<=clock_timestamp()
 ORDER BY next_attempt_at,id LIMIT 1 FOR UPDATE SKIP LOCKED;
 IF NOT FOUND THEN RETURN 'empty'; END IF;
 IF NOT p4_r86_ci.eligible(q.organization_id,q.file_id,q.file_revision,q.recipient_id) THEN
  UPDATE p4_r86_ci.outbox SET status='cancelled' WHERE organization_id=q.organization_id AND id=q.id;RETURN 'cancelled';
 END IF;
 BEGIN
  INSERT INTO p4_r86_ci.notices(organization_id,id,recipient_id) VALUES(q.organization_id,q.id,q.recipient_id);
  UPDATE p4_r86_ci.outbox SET status='delivered',attempts=attempts+1 WHERE organization_id=q.organization_id AND id=q.id;
  RETURN 'delivered';
 EXCEPTION WHEN OTHERS THEN
  UPDATE p4_r86_ci.outbox SET attempts=attempts+1,status=CASE WHEN attempts+1>=3 THEN 'dead' ELSE 'pending' END,
  next_attempt_at=clock_timestamp()+make_interval(secs=>5*(attempts+1)) WHERE organization_id=q.organization_id AND id=q.id;
  RETURN CASE WHEN q.attempts+1>=3 THEN 'dead' ELSE 'retry' END;
 END;
END $$;
ALTER FUNCTION p4_r86_ci.deliver_one() OWNER TO p4_r86_ci_writer;
REVOKE ALL ON FUNCTION p4_r86_ci.deliver_one() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p4_r86_ci.deliver_one() TO p4_r86_ci_worker;
CREATE FUNCTION p4_r86_ci.inbox(p_issuer text,p_subject text,p_org uuid,p_op text,p_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE who uuid; result jsonb;
BEGIN
 SELECT m.actor INTO who FROM p4_r84_ci.require_member(p_issuer,p_subject,p_org,'platform') m;
 IF p_op='list' THEN
  RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('id',z.id,'kind',z.kind,'read',z.read,'fileId',z.file_id) ORDER BY z.id),'[]') FROM
   (SELECT n.id,q.kind,n.read_at IS NOT NULL AS read,q.file_id FROM p4_r86_ci.notices n JOIN p4_r86_ci.outbox q ON q.organization_id=n.organization_id AND q.id=n.id
    WHERE n.organization_id=p_org AND n.recipient_id=who AND q.recipient_id=who AND q.status='delivered' AND (p_id IS NULL OR n.id>p_id)
    AND p4_r86_ci.eligible(p_org,q.file_id,q.file_revision,who) ORDER BY n.id LIMIT 21) z);
 ELSIF p_op='read' THEN
  IF NOT EXISTS(SELECT 1 FROM p4_r86_ci.notices n JOIN p4_r86_ci.outbox q ON q.organization_id=n.organization_id AND q.id=n.id
   WHERE n.organization_id=p_org AND n.id=p_id AND n.recipient_id=who AND q.recipient_id=who AND q.status='delivered' AND p4_r86_ci.eligible(p_org,q.file_id,q.file_revision,who))
  THEN RAISE EXCEPTION USING ERRCODE='P4003',MESSAGE='ACCESS_DENIED'; END IF;
  UPDATE p4_r86_ci.notices SET read_at=clock_timestamp() WHERE organization_id=p_org AND id=p_id AND recipient_id=who AND read_at IS NULL;
  IF FOUND THEN INSERT INTO p4_r84_ci.audit_events(organization_id,id,actor_id,action) VALUES(p_org,gen_random_uuid(),who,'notice.read'); END IF;
  RETURN jsonb_build_object('id',p_id,'read',true);
 ELSE RAISE EXCEPTION USING ERRCODE='P8600',MESSAGE='INVALID_INPUT'; END IF;
END $$;
ALTER FUNCTION p4_r86_ci.inbox(text,text,uuid,text,uuid) OWNER TO p4_r86_ci_writer;
REVOKE ALL ON FUNCTION p4_r86_ci.inbox(text,text,uuid,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p4_r86_ci.inbox(text,text,uuid,text,uuid) TO p4_r82_ci_runtime;
COMMIT;
