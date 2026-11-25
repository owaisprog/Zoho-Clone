-- R85: narrowly scoped fictional attachment lifecycle, disposable CI only.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' OR current_user<>'demo_ci'
 OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
 OR to_regnamespace('p4_r84_ci') IS NULL OR to_regnamespace('p4_r85_ci') IS NOT NULL
 THEN RAISE EXCEPTION 'P4_R85_DISPOSABLE_ONLY'; END IF;
END $$;
CREATE ROLE p4_r85_ci_writer NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
CREATE ROLE p4_r85_ci_scanner LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD 'fake_ci_not_for_real_accounts';
CREATE SCHEMA p4_r85_ci AUTHORIZATION p4_r82_ci_owner;
REVOKE ALL ON SCHEMA p4_r85_ci FROM PUBLIC;
GRANT USAGE ON SCHEMA p4_r85_ci TO p4_r85_ci_writer,p4_r85_ci_scanner,p4_r82_ci_runtime;
GRANT USAGE ON SCHEMA p4_r84_ci TO p4_r85_ci_writer;
GRANT EXECUTE ON FUNCTION p4_r84_ci.require_member(text,text,uuid,text) TO p4_r85_ci_writer;
GRANT SELECT ON p4_r84_ci.sales_roles TO p4_r85_ci_writer;
CREATE POLICY r85_sales_read ON p4_r84_ci.sales_roles FOR SELECT TO p4_r85_ci_writer USING(true);
GRANT INSERT ON p4_r84_ci.audit_events TO p4_r85_ci_writer;
CREATE POLICY r85_audit_insert ON p4_r84_ci.audit_events FOR INSERT TO p4_r85_ci_writer WITH CHECK(action IN ('file.created','file.downloaded','file.deleted'));
CREATE TABLE p4_r85_ci.attachment_parents(
 organization_id p4_r82_ci.uuid_v4 NOT NULL,id p4_r82_ci.uuid_v4 NOT NULL,owner_id p4_r82_ci.uuid_v4 NOT NULL,
 active boolean NOT NULL DEFAULT true,PRIMARY KEY(organization_id,id),
 UNIQUE(organization_id,id,owner_id),
 FOREIGN KEY(organization_id,owner_id) REFERENCES p4_r82_ci.memberships(organization_id,user_id));
CREATE TABLE p4_r85_ci.files(
 organization_id p4_r82_ci.uuid_v4 NOT NULL,id p4_r82_ci.uuid_v4 NOT NULL,parent_id p4_r82_ci.uuid_v4 NOT NULL,owner_id p4_r82_ci.uuid_v4 NOT NULL,
 content bytea,sha256 text NOT NULL CHECK(sha256 ~ '^[0-9a-f]{64}$'),
 state text NOT NULL DEFAULT 'quarantined' CHECK(state IN ('quarantined','scan_clean','rejected','soft_deleted')),
 revision integer NOT NULL DEFAULT 0 CHECK(revision BETWEEN 0 AND 1000000),
 PRIMARY KEY(organization_id,id),
 FOREIGN KEY(organization_id,parent_id,owner_id) REFERENCES p4_r85_ci.attachment_parents(organization_id,id,owner_id),
 CHECK((state IN ('rejected','soft_deleted') AND content IS NULL) OR (state IN ('quarantined','scan_clean') AND content IS NOT NULL AND octet_length(content) BETWEEN 16 AND 256)));
CREATE TABLE p4_r85_ci.download_grants(
 organization_id p4_r82_ci.uuid_v4 NOT NULL,file_id p4_r82_ci.uuid_v4 NOT NULL,actor_id p4_r82_ci.uuid_v4 NOT NULL,
 token_hash text NOT NULL CHECK(token_hash ~ '^[0-9a-f]{64}$'),file_revision integer NOT NULL,
 expires_at timestamptz NOT NULL,used boolean NOT NULL DEFAULT false,
 PRIMARY KEY(token_hash),
 FOREIGN KEY(organization_id,file_id) REFERENCES p4_r85_ci.files(organization_id,id),
 FOREIGN KEY(organization_id,actor_id) REFERENCES p4_r82_ci.memberships(organization_id,user_id));
CREATE TABLE p4_r85_ci.file_events(
 organization_id p4_r82_ci.uuid_v4 NOT NULL,file_id p4_r82_ci.uuid_v4 NOT NULL,revision integer NOT NULL,
 action text NOT NULL CHECK(action IN ('CREATED','SCANNED_CLEAN','SCANNED_REJECTED','DELETED')),
 actor_type text NOT NULL CHECK(actor_type IN ('MEMBER','CI_SCANNER')),
 PRIMARY KEY(organization_id,file_id,revision),FOREIGN KEY(organization_id,file_id) REFERENCES p4_r85_ci.files(organization_id,id));
CREATE TRIGGER r85_events_immutable BEFORE UPDATE OR DELETE ON p4_r85_ci.file_events FOR EACH ROW EXECUTE FUNCTION p4_r84_ci.immutable();
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['attachment_parents','files','download_grants','file_events'] LOOP
  EXECUTE format('ALTER TABLE p4_r85_ci.%I OWNER TO p4_r82_ci_owner',t);
  EXECUTE format('ALTER TABLE p4_r85_ci.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE p4_r85_ci.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY r85_writer_read ON p4_r85_ci.%I FOR SELECT TO p4_r85_ci_writer USING(true)',t);
 END LOOP;
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA p4_r85_ci FROM PUBLIC,p4_r82_ci_runtime,p4_r85_ci_scanner;
GRANT SELECT ON ALL TABLES IN SCHEMA p4_r85_ci TO p4_r85_ci_writer;
GRANT INSERT,UPDATE ON p4_r85_ci.files,p4_r85_ci.download_grants TO p4_r85_ci_writer;
GRANT INSERT ON p4_r85_ci.file_events TO p4_r85_ci_writer;
CREATE POLICY r85_file_insert ON p4_r85_ci.files FOR INSERT TO p4_r85_ci_writer WITH CHECK(true);
CREATE POLICY r85_file_update ON p4_r85_ci.files FOR UPDATE TO p4_r85_ci_writer USING(true) WITH CHECK(true);
CREATE POLICY r85_grant_insert ON p4_r85_ci.download_grants FOR INSERT TO p4_r85_ci_writer WITH CHECK(true);
CREATE POLICY r85_grant_update ON p4_r85_ci.download_grants FOR UPDATE TO p4_r85_ci_writer USING(true) WITH CHECK(true);
CREATE POLICY r85_event_insert ON p4_r85_ci.file_events FOR INSERT TO p4_r85_ci_writer WITH CHECK(true);
CREATE FUNCTION p4_r85_ci.actor(p_issuer text,p_subject text,p_org uuid) RETURNS uuid
 LANGUAGE plpgsql STABLE SET search_path=pg_catalog AS $$
DECLARE who uuid; member_role text;
BEGIN
 SELECT m.actor,m.role INTO who,member_role FROM p4_r84_ci.require_member(p_issuer,p_subject,p_org,'crm') m;
 IF member_role<>'MEMBER' OR NOT EXISTS(SELECT 1 FROM p4_r84_ci.sales_roles s WHERE s.organization_id=p_org AND s.user_id=who AND s.role_code='SALES_REP' AND s.active)
 THEN RAISE EXCEPTION USING ERRCODE='P4003',MESSAGE='ACCESS_DENIED'; END IF;
 RETURN who;
END $$;
ALTER FUNCTION p4_r85_ci.actor(text,text,uuid) OWNER TO p4_r85_ci_writer;
REVOKE ALL ON FUNCTION p4_r85_ci.actor(text,text,uuid) FROM PUBLIC;
CREATE FUNCTION p4_r85_ci.command(p_issuer text,p_subject text,p_org uuid,p_op text,p_id uuid,p_parent uuid,p_content text,p_hash text,p_revision integer)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE who uuid:=p4_r85_ci.actor(p_issuer,p_subject,p_org); f p4_r85_ci.files%ROWTYPE; result jsonb; expiry timestamptz;
BEGIN
 IF p_op='create' OR p_op='list' THEN
  IF NOT EXISTS(SELECT 1 FROM p4_r85_ci.attachment_parents p WHERE p.organization_id=p_org AND p.id=p_parent AND p.owner_id=who AND p.active)
  THEN RAISE EXCEPTION USING ERRCODE='P4003',MESSAGE='ACCESS_DENIED'; END IF;
  IF p_op='list' THEN
   RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('id',s.id,'state',s.state,'revision',s.revision) ORDER BY s.id),'[]') FROM
   (SELECT id,state,revision FROM p4_r85_ci.files WHERE organization_id=p_org AND parent_id=p_parent AND owner_id=who AND state<>'soft_deleted' AND (p_id IS NULL OR id>p_id) ORDER BY id LIMIT 21) s);
  END IF;
  IF p_id IS NULL OR p_content IS NULL OR p_content !~ '^Demo (blocked )?attachment [A-Za-z0-9 .-]{1,120}$' OR octet_length(p_content)>256
  THEN RAISE EXCEPTION USING ERRCODE='P8500',MESSAGE='INVALID_INPUT'; END IF;
  INSERT INTO p4_r85_ci.files(organization_id,id,parent_id,owner_id,content,sha256)
  VALUES(p_org,p_id,p_parent,who,convert_to(p_content,'UTF8'),encode(sha256(convert_to(p_content,'UTF8')),'hex'));
  INSERT INTO p4_r85_ci.file_events VALUES(p_org,p_id,0,'CREATED','MEMBER');
  INSERT INTO p4_r84_ci.audit_events(organization_id,id,actor_id,action) VALUES(p_org,gen_random_uuid(),who,'file.created');
  RETURN jsonb_build_object('id',p_id,'state','quarantined','revision',0);
 END IF;
 SELECT f0.* INTO f FROM p4_r85_ci.files f0 JOIN p4_r85_ci.attachment_parents p ON p.organization_id=f0.organization_id AND p.id=f0.parent_id AND p.owner_id=f0.owner_id AND p.active
 WHERE f0.organization_id=p_org AND f0.id=p_id AND f0.owner_id=who FOR UPDATE OF f0;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P4003',MESSAGE='ACCESS_DENIED'; END IF;
 IF p_op='delete' THEN
  IF p_revision IS NULL OR p_revision<>f.revision OR f.state NOT IN ('scan_clean','rejected') THEN RAISE EXCEPTION USING ERRCODE='P4009',MESSAGE='CONFLICT'; END IF;
  UPDATE p4_r85_ci.files SET state='soft_deleted',content=NULL,revision=f.revision+1 WHERE organization_id=p_org AND id=p_id;
  INSERT INTO p4_r85_ci.file_events VALUES(p_org,p_id,f.revision+1,'DELETED','MEMBER');
  INSERT INTO p4_r84_ci.audit_events(organization_id,id,actor_id,action) VALUES(p_org,gen_random_uuid(),who,'file.deleted');
  RETURN jsonb_build_object('id',p_id,'state','soft_deleted','revision',f.revision+1);
 END IF;
 IF f.state<>'scan_clean' OR p_hash IS NULL OR p_hash !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION USING ERRCODE='P4003',MESSAGE='ACCESS_DENIED'; END IF;
 IF p_op='grant' THEN
  expiry:=clock_timestamp()+interval '60 seconds';
  INSERT INTO p4_r85_ci.download_grants(organization_id,file_id,actor_id,token_hash,file_revision,expires_at) VALUES(p_org,p_id,who,p_hash,f.revision,expiry);
  RETURN jsonb_build_object('expiresAt',to_char(expiry AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
 ELSIF p_op='redeem' THEN
  UPDATE p4_r85_ci.download_grants SET used=true WHERE token_hash=p_hash AND organization_id=p_org AND file_id=p_id AND actor_id=who AND file_revision=f.revision AND NOT used AND expires_at>clock_timestamp();
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P4003',MESSAGE='ACCESS_DENIED'; END IF;
  IF encode(sha256(f.content),'hex')<>f.sha256 THEN RAISE EXCEPTION USING ERRCODE='P4003',MESSAGE='ACCESS_DENIED'; END IF;
  INSERT INTO p4_r84_ci.audit_events(organization_id,id,actor_id,action) VALUES(p_org,gen_random_uuid(),who,'file.downloaded');
  RETURN jsonb_build_object('content',convert_from(f.content,'UTF8'));
 ELSE RAISE EXCEPTION USING ERRCODE='P8500',MESSAGE='INVALID_INPUT'; END IF;
END $$;
ALTER FUNCTION p4_r85_ci.command(text,text,uuid,text,uuid,uuid,text,text,integer) OWNER TO p4_r85_ci_writer;
REVOKE ALL ON FUNCTION p4_r85_ci.command(text,text,uuid,text,uuid,uuid,text,text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p4_r85_ci.command(text,text,uuid,text,uuid,uuid,text,text,integer) TO p4_r82_ci_runtime;
-- Independent scanner login can execute only the bounded deterministic fixture scan.
CREATE FUNCTION p4_r85_ci.scan_fixture(p_org uuid,p_id uuid,p_revision integer) RETURNS text
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE f p4_r85_ci.files%ROWTYPE; next_state text;
BEGIN
 SELECT * INTO f FROM p4_r85_ci.files WHERE organization_id=p_org AND id=p_id FOR UPDATE;
 IF NOT FOUND OR f.state<>'quarantined' OR p_revision IS NULL OR f.revision<>p_revision THEN RAISE EXCEPTION USING ERRCODE='P4009',MESSAGE='CONFLICT'; END IF;
 next_state:=CASE WHEN encode(sha256(f.content),'hex')=f.sha256 AND convert_from(f.content,'UTF8') ~ '^Demo attachment [A-Za-z0-9 .-]{1,120}$' THEN 'scan_clean' ELSE 'rejected' END;
 UPDATE p4_r85_ci.files SET state=next_state,revision=f.revision+1,content=CASE WHEN next_state='rejected' THEN NULL ELSE f.content END WHERE organization_id=p_org AND id=p_id;
 INSERT INTO p4_r85_ci.file_events VALUES(p_org,p_id,f.revision+1,CASE WHEN next_state='scan_clean' THEN 'SCANNED_CLEAN' ELSE 'SCANNED_REJECTED' END,'CI_SCANNER');
 RETURN next_state;
END $$;
ALTER FUNCTION p4_r85_ci.scan_fixture(uuid,uuid,integer) OWNER TO p4_r85_ci_writer;
REVOKE ALL ON FUNCTION p4_r85_ci.scan_fixture(uuid,uuid,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p4_r85_ci.scan_fixture(uuid,uuid,integer) TO p4_r85_ci_scanner;
COMMIT;
