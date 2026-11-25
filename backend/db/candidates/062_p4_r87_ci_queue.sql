-- R87: Redis wakeups contain only opaque IDs and attempt; PostgreSQL remains authoritative.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' OR current_user<>'demo_ci'
 OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
 OR to_regnamespace('p4_r86_ci') IS NULL OR to_regnamespace('p4_r87_ci') IS NOT NULL
 THEN RAISE EXCEPTION 'P4_R87_DISPOSABLE_ONLY'; END IF;
END $$;
CREATE SCHEMA p4_r87_ci AUTHORIZATION p4_r82_ci_owner;
REVOKE ALL ON SCHEMA p4_r87_ci FROM PUBLIC;
GRANT USAGE ON SCHEMA p4_r87_ci TO p4_r86_ci_writer,p4_r86_ci_worker;
CREATE FUNCTION p4_r87_ci.due_jobs() RETURNS TABLE(organization_id uuid,id uuid,attempt integer)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT o.organization_id::uuid,o.id::uuid,o.attempts FROM p4_r86_ci.outbox o
 WHERE o.status='pending' AND o.attempts<3 AND o.next_attempt_at<=statement_timestamp()
 ORDER BY o.next_attempt_at,o.id,o.organization_id LIMIT 20;
$$;
ALTER FUNCTION p4_r87_ci.due_jobs() OWNER TO p4_r86_ci_writer;
REVOKE ALL ON FUNCTION p4_r87_ci.due_jobs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p4_r87_ci.due_jobs() TO p4_r86_ci_worker;
CREATE FUNCTION p4_r87_ci.deliver_job(p_org uuid,p_id uuid,p_attempt integer) RETURNS text
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE q p4_r86_ci.outbox%ROWTYPE;
BEGIN
 IF p_org IS NULL OR p_id IS NULL OR p_attempt IS NULL OR p_attempt NOT BETWEEN 0 AND 2 THEN
  RAISE EXCEPTION USING ERRCODE='P8700',MESSAGE='INVALID_INPUT'; END IF;
 SELECT * INTO q FROM p4_r86_ci.outbox WHERE organization_id=p_org AND id=p_id
 AND status='pending' AND attempts=p_attempt AND next_attempt_at<=clock_timestamp()
 FOR UPDATE SKIP LOCKED;
 IF NOT FOUND THEN RETURN 'empty'; END IF;
 IF NOT p4_r86_ci.eligible(q.organization_id,q.file_id,q.file_revision,q.recipient_id) THEN
  UPDATE p4_r86_ci.outbox SET status='cancelled' WHERE organization_id=q.organization_id AND id=q.id;
  RETURN 'cancelled';
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
ALTER FUNCTION p4_r87_ci.deliver_job(uuid,uuid,integer) OWNER TO p4_r86_ci_writer;
REVOKE ALL ON FUNCTION p4_r87_ci.deliver_job(uuid,uuid,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p4_r87_ci.deliver_job(uuid,uuid,integer) TO p4_r86_ci_worker;
COMMIT;
