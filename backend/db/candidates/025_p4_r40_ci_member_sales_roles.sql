-- P4 R40: disposable CI-only, trusted Express-to-PostgreSQL sales roles.
-- NOT a Neon, staging, or production migration. SECURITY DEFINER functions
-- are owned by disposable CI bootstrap and MUST NOT be promoted to production.
\set ON_ERROR_STOP on
BEGIN;
DO $$
BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' OR current_user<>'demo_ci'
  OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
  OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='p4_synthetic_ci_runtime')
  OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='p4_r40_ci')
 THEN RAISE EXCEPTION 'P4_R40_DISPOSABLE_CI_ONLY'; END IF;
END $$;
CREATE SCHEMA p4_r40_ci;
REVOKE ALL ON SCHEMA p4_r40_ci FROM PUBLIC;
GRANT USAGE ON SCHEMA p4_r40_ci TO p4_synthetic_ci_runtime;

-- Deliberately separate business sales role from OWNER/MEMBER membership.
-- Only the narrow owner-checked functions below have access.
CREATE TABLE p4_r40_ci.sales_roles (
 org_id uuid NOT NULL,
 user_id text NOT NULL,
 role_code text NOT NULL DEFAULT 'SALES_REP'
  CHECK (role_code IN ('SALES_REP','SALES_MANAGER')),
 revision integer NOT NULL DEFAULT 0 CHECK (revision BETWEEN 0 AND 10000000),
 PRIMARY KEY(org_id,user_id),
 FOREIGN KEY(org_id,user_id)
  REFERENCES p4_synthetic.memberships(org_id,user_id) ON DELETE RESTRICT
);
CREATE TABLE p4_r40_ci.role_events (
 org_id uuid NOT NULL,
 request_id uuid NOT NULL,
 actor_user_id text NOT NULL,
 target_user_id text NOT NULL,
 before_role text NOT NULL CHECK (before_role IN ('SALES_REP','SALES_MANAGER')),
 after_role text NOT NULL CHECK (after_role IN ('SALES_REP','SALES_MANAGER')),
 revision integer NOT NULL CHECK (revision BETWEEN 1 AND 10000000),
 occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(org_id,request_id),
 FOREIGN KEY(org_id,target_user_id)
  REFERENCES p4_synthetic.memberships(org_id,user_id) ON DELETE RESTRICT,
 CHECK (before_role<>after_role)
);
ALTER TABLE p4_r40_ci.sales_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE p4_r40_ci.sales_roles FORCE ROW LEVEL SECURITY;
ALTER TABLE p4_r40_ci.role_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE p4_r40_ci.role_events FORCE ROW LEVEL SECURITY;
REVOKE ALL ON p4_r40_ci.sales_roles,p4_r40_ci.role_events FROM PUBLIC;
-- No table grants, policies, or direct RLS access to the runtime role.
CREATE FUNCTION p4_r40_ci.deny_event_change() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN RAISE EXCEPTION 'P4_R40_AUDIT_IMMUTABLE'; END $$;
CREATE TRIGGER r40_immutable_events BEFORE UPDATE OR DELETE
 ON p4_r40_ci.role_events FOR EACH ROW EXECUTE FUNCTION p4_r40_ci.deny_event_change();

CREATE FUNCTION p4_r40_ci.require_current_owner(p_org uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog AS $$
DECLARE who text;
BEGIN
 who:=nullif(current_setting('app.actor_id',true),'');
 IF current_database()<>'zoho_clone_synthetic_ci'
    OR current_setting('role',true)<>'p4_synthetic_ci_runtime'
    OR p_org::text IS DISTINCT FROM nullif(current_setting('app.tenant_id',true),'')
    OR who IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM p4_synthetic.memberships m
       JOIN p4_synthetic.identity_subjects s ON s.user_id=m.user_id
      WHERE m.org_id=p_org AND m.user_id=who AND m.active=true
       AND m.role='OWNER' AND s.email_verified=true)
 THEN RAISE EXCEPTION USING ERRCODE='P4003',MESSAGE='ACCESS_DENIED'; END IF;
END $$;

CREATE FUNCTION p4_r40_ci.list_member_sales_roles(p_org uuid)
RETURNS TABLE(user_id text,role_code text,revision integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM p4_r40_ci.require_current_owner(p_org);
 RETURN QUERY
 SELECT m.user_id,coalesce(r.role_code,'SALES_REP')::text,
        coalesce(r.revision,0)::integer
 FROM p4_synthetic.memberships m
 LEFT JOIN p4_r40_ci.sales_roles r
  ON r.org_id=m.org_id AND r.user_id=m.user_id
 WHERE m.org_id=p_org AND m.active=true AND m.role='MEMBER'
 ORDER BY m.user_id LIMIT 21;
END $$;

-- Serialize both concurrent edits and first-assignment inserts.
-- One transaction commits role version AND immutable event or neither.
CREATE FUNCTION p4_r40_ci.change_member_sales_role(
 p_org uuid,p_target text,p_next text,p_expected integer,p_request uuid
) RETURNS TABLE(role_code text,revision integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE who text; prior text; old_revision integer;
BEGIN
 PERFORM p4_r40_ci.require_current_owner(p_org);
 who:=nullif(current_setting('app.actor_id',true),'');
 IF p_target IS NULL OR p_target !~ '^user_demo_[a-z]{2,16}$'
    OR p_target=who OR p_next IS NULL
    OR p_next NOT IN ('SALES_REP','SALES_MANAGER')
    OR p_expected IS NULL OR p_expected<0 OR p_expected>=10000000
    OR p_request IS NULL OR
    NOT EXISTS (
     SELECT 1 FROM p4_synthetic.memberships m
      WHERE m.org_id=p_org AND m.user_id=p_target
       AND m.active=true AND m.role='MEMBER')
 THEN RAISE EXCEPTION USING ERRCODE='P4003',MESSAGE='ACCESS_DENIED'; END IF;

 INSERT INTO p4_r40_ci.sales_roles(org_id,user_id)
 VALUES(p_org,p_target) ON CONFLICT(org_id,user_id) DO NOTHING;
 SELECT r.role_code,r.revision INTO prior,old_revision
 FROM p4_r40_ci.sales_roles r
 WHERE r.org_id=p_org AND r.user_id=p_target FOR UPDATE;
 -- Double-check target under the lock; revocation must fail closed.
 IF prior IS NULL OR old_revision<>p_expected OR prior=p_next
    OR NOT EXISTS (
     SELECT 1 FROM p4_synthetic.memberships m
      WHERE m.org_id=p_org AND m.user_id=p_target
       AND m.active=true AND m.role='MEMBER')
 THEN RAISE EXCEPTION USING ERRCODE='P4009',MESSAGE='CONFLICT'; END IF;
 UPDATE p4_r40_ci.sales_roles r
 SET role_code=p_next,revision=old_revision+1
 WHERE r.org_id=p_org AND r.user_id=p_target;
 INSERT INTO p4_r40_ci.role_events(
  org_id,request_id,actor_user_id,target_user_id,
  before_role,after_role,revision
 ) VALUES(p_org,p_request,who,p_target,prior,p_next,old_revision+1);
 RETURN QUERY SELECT p_next,old_revision+1;
END $$;

REVOKE ALL ON FUNCTION p4_r40_ci.require_current_owner(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION p4_r40_ci.list_member_sales_roles(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION p4_r40_ci.change_member_sales_role(uuid,text,text,integer,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p4_r40_ci.list_member_sales_roles(uuid)
 TO p4_synthetic_ci_runtime;
GRANT EXECUTE ON FUNCTION p4_r40_ci.change_member_sales_role(uuid,text,text,integer,uuid)
 TO p4_synthetic_ci_runtime;
COMMIT;
