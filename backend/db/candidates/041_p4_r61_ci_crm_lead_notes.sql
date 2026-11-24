-- P4 R61: fictional lead follow-up notes; disposable CI database only.
\set ON_ERROR_STOP on
BEGIN;
DO $guard$ BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci'
 OR current_user<>'demo_ci'
 OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
 OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='p4_r61_ci')
 OR to_regprocedure('p4_r40_ci.require_current_owner(uuid)') IS NULL
 OR to_regclass('p4_r57_ci.leads') IS NULL
 THEN RAISE EXCEPTION 'P4_R61_CI_ONLY'; END IF;
END $guard$;
CREATE SCHEMA p4_r61_ci;
REVOKE ALL ON SCHEMA p4_r61_ci FROM PUBLIC;
GRANT USAGE ON SCHEMA p4_r61_ci TO p4_synthetic_ci_runtime;

CREATE TABLE p4_r61_ci.lead_notes(
 org_id uuid NOT NULL,
 note_id uuid NOT NULL,
 lead_id uuid NOT NULL,
 request_id uuid NOT NULL,
 note_text text NOT NULL
  CHECK(note_text ~ '^Demo [A-Za-z0-9 ,.!?-]{8,130}$'),
 actor_user_id text NOT NULL CHECK(actor_user_id ~ '^user_demo_[a-z]{2,16}$'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(org_id,note_id),
 UNIQUE(org_id,request_id),
 FOREIGN KEY(org_id,lead_id) REFERENCES p4_r57_ci.leads(org_id,lead_id)
 ON DELETE RESTRICT
);
ALTER TABLE p4_r61_ci.lead_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE p4_r61_ci.lead_notes FORCE ROW LEVEL SECURITY;
REVOKE ALL ON p4_r61_ci.lead_notes FROM PUBLIC;
CREATE FUNCTION p4_r61_ci.immutable_note() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $body$
BEGIN RAISE EXCEPTION 'P4_R61_NOTE_IMMUTABLE'; END $body$;
CREATE TRIGGER r61_immutable_notes BEFORE UPDATE OR DELETE
 ON p4_r61_ci.lead_notes FOR EACH ROW
 EXECUTE FUNCTION p4_r61_ci.immutable_note();

CREATE FUNCTION p4_r61_ci.add_lead_note(
 p_org uuid,p_lead uuid,p_note uuid,p_request uuid,p_text text
) RETURNS TABLE(
 note_id uuid,lead_id uuid,note_text text,actor_user_id text,created_at timestamptz
) LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $body$
DECLARE who text;
BEGIN
 PERFORM p4_r40_ci.require_current_owner(p_org);
 who:=nullif(current_setting('app.actor_id',true),'');
 IF p_note IS NULL OR p_request IS NULL OR p_lead IS NULL
 OR p_text IS NULL OR p_text !~ '^Demo [A-Za-z0-9 ,.!?-]{8,130}$'
 THEN RAISE EXCEPTION USING ERRCODE='P6100',MESSAGE='INVALID_NOTE'; END IF;
 IF NOT EXISTS(SELECT 1 FROM p4_r57_ci.leads l
  WHERE l.org_id=p_org AND l.lead_id=p_lead)
 THEN RAISE EXCEPTION USING ERRCODE='P4009',MESSAGE='LEAD_MISSING'; END IF;
 INSERT INTO p4_r61_ci.lead_notes(
  org_id,note_id,lead_id,request_id,note_text,actor_user_id
 ) VALUES(p_org,p_note,p_lead,p_request,p_text,who);
 RETURN QUERY SELECT n.note_id,n.lead_id,n.note_text,n.actor_user_id,n.created_at
 FROM p4_r61_ci.lead_notes n WHERE n.org_id=p_org AND n.note_id=p_note;
END $body$;

CREATE FUNCTION p4_r61_ci.list_lead_notes(p_org uuid,p_lead uuid)
RETURNS TABLE(note_id uuid,lead_id uuid,note_text text,
 actor_user_id text,created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $body$
BEGIN
 PERFORM p4_r40_ci.require_current_owner(p_org);
 IF p_lead IS NULL OR NOT EXISTS(SELECT 1 FROM p4_r57_ci.leads l
  WHERE l.org_id=p_org AND l.lead_id=p_lead)
 THEN RAISE EXCEPTION USING ERRCODE='P4009',MESSAGE='LEAD_MISSING'; END IF;
 RETURN QUERY SELECT n.note_id,n.lead_id,n.note_text,n.actor_user_id,n.created_at
 FROM p4_r61_ci.lead_notes n
 WHERE n.org_id=p_org AND n.lead_id=p_lead
 ORDER BY n.created_at DESC,n.note_id DESC LIMIT 21;
END $body$;
REVOKE ALL ON FUNCTION
 p4_r61_ci.add_lead_note(uuid,uuid,uuid,uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION p4_r61_ci.list_lead_notes(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION
 p4_r61_ci.add_lead_note(uuid,uuid,uuid,uuid,text)
 TO p4_synthetic_ci_runtime;
GRANT EXECUTE ON FUNCTION
 p4_r61_ci.list_lead_notes(uuid,uuid) TO p4_synthetic_ci_runtime;
COMMIT;
