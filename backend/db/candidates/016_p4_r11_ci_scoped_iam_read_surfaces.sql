-- P4 Batch 11: P1.06 R0 read-only members, invitation status and audit.
-- DISPOSABLE GitHub CI only; NOT a Neon migration, Auth0 or invite sender.
\set ON_ERROR_STOP on
BEGIN;
DO $guard$
BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' OR current_user<>'demo_ci'
    OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
    OR NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='p4_r10_ci')
    OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='p4_r11_ci') THEN
   RAISE EXCEPTION 'P4 R11 only available in fresh disposable GitHub CI';
 END IF;
END $guard$;
CREATE SCHEMA p4_r11_ci;
REVOKE ALL ON SCHEMA p4_r11_ci FROM PUBLIC;

-- All data is fake. Invite token never leaves DB; no token delivery,
-- acceptance or mutation endpoints are implemented.
CREATE TABLE p4_r11_ci.invitation_status(
 organization_id p4_v1_ci.internal_id NOT NULL
   REFERENCES p4_v1_ci.organizations(id) ON DELETE RESTRICT,
 id p4_v1_ci.internal_id NOT NULL,
 issued_by p4_v1_ci.internal_id NOT NULL,
 role_code text NOT NULL CHECK(role_code='SALES_REP'),
 status text NOT NULL CHECK(status IN ('pending','expired','revoked','accepted')),
 expires_at timestamptz NOT NULL,
 token_hash_private text NOT NULL DEFAULT 'Demo NOT EXPOSE TOKEN HASH',
 recipient_email_private text NOT NULL DEFAULT 'demo-private@example.invalid',
 PRIMARY KEY(organization_id,id),
 FOREIGN KEY(organization_id,issued_by)
  REFERENCES p4_r7_ci.memberships(organization_id,actor_id) ON DELETE RESTRICT
);
CREATE TABLE p4_r11_ci.audit_status(
 organization_id p4_v1_ci.internal_id NOT NULL
   REFERENCES p4_v1_ci.organizations(id) ON DELETE RESTRICT,
 id p4_v1_ci.internal_id NOT NULL,
 actor_user_id p4_v1_ci.internal_id NOT NULL,
 action text NOT NULL CHECK(action IN ('role_grant.revoked','team_grant.revoked','invitation.created')),
 occurred_at timestamptz NOT NULL,
 raw_payload_private text NOT NULL DEFAULT 'Demo PRIVATE request body',
 PRIMARY KEY(organization_id,id),
 FOREIGN KEY(organization_id,actor_user_id)
  REFERENCES p4_r7_ci.memberships(organization_id,actor_id) ON DELETE RESTRICT
);
INSERT INTO p4_v1_ci.users(id,display_name) VALUES
 ('10000000-0000-4000-8000-0000000000e1','Demo Emma Admin'),
 ('10000000-0000-4000-8000-0000000000f1','Demo Felix Reviewer');
INSERT INTO p4_v1_ci.identity_subjects
 (issuer,external_subject,user_id,email_verified) VALUES
 ('https://demo.us.auth0.com/','auth0|demo-emma',
 '10000000-0000-4000-8000-0000000000e1',true),
 ('https://demo.us.auth0.com/','auth0|demo-felix',
 '10000000-0000-4000-8000-0000000000f1',true);
INSERT INTO p4_r7_ci.memberships(organization_id,actor_id,active) VALUES
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-0000000000e1',true),
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-0000000000f1',true);
INSERT INTO p4_r7_ci.role_grants
 (organization_id,actor_id,role_code,active) VALUES
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-0000000000e1','ORG_ADMIN',true),
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-0000000000f1','SECURITY_REVIEWER',true);
INSERT INTO p4_r7_ci.app_grants(organization_id,app_code,active) VALUES
 ('20000000-0000-4000-8000-000000000001','platform',true),
 ('20000000-0000-4000-8000-000000000002','platform',true);
INSERT INTO p4_r11_ci.invitation_status
 (organization_id,id,issued_by,role_code,status,expires_at) VALUES
 ('20000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-0000000000a1','SALES_REP','pending',
  '2030-01-01T00:00:00Z'),
 ('20000000-0000-4000-8000-000000000002',
  '60000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-0000000000a1','SALES_REP','expired',
  '2020-01-01T00:00:00Z');
INSERT INTO p4_r11_ci.audit_status
 (organization_id,id,actor_user_id,action,occurred_at) VALUES
 ('20000000-0000-4000-8000-000000000001',
  '70000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-0000000000a1',
  'role_grant.revoked','2026-11-20T10:00:00Z'),
 ('20000000-0000-4000-8000-000000000002',
  '70000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-0000000000a1',
  'team_grant.revoked','2026-11-20T11:00:00Z');

-- RLS calls a *small* SECURITY DEFINER helper. This helper is a CI proof,
-- not a production delegated-access mechanism; in production GUC context
-- and database credentials must be independently reviewed.
CREATE FUNCTION p4_r11_ci.can_read(p_org uuid,p_resource text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog AS $fn$
 SELECT p_org::text=NULLIF(current_setting('app.tenant_id',true),'')
  AND EXISTS(
   SELECT 1 FROM p4_r7_ci.memberships m
   JOIN p4_r7_ci.role_grants r
     ON r.organization_id=m.organization_id AND r.actor_id=m.actor_id
   JOIN p4_r7_ci.app_grants a
     ON a.organization_id=m.organization_id AND a.app_code='platform'
   WHERE m.organization_id=p_org
     AND m.actor_id::text=NULLIF(current_setting('app.actor_id',true),'')
     AND m.active AND r.active AND a.active
     AND (
       (p_resource IN ('memberships','role_grants')
         AND r.role_code IN ('ORG_OWNER','ORG_ADMIN','SECURITY_REVIEWER'))
       OR (p_resource='invitations'
         AND r.role_code IN ('ORG_OWNER','ORG_ADMIN'))
       OR (p_resource='audit_events'
         AND r.role_code IN ('ORG_OWNER','SECURITY_REVIEWER'))
     )
  )
$fn$;
REVOKE ALL ON FUNCTION p4_r11_ci.can_read(uuid,text) FROM PUBLIC;

-- An explicitly bounded live read of only metadata. No user email/subject
-- is included and the role list is projected from current R7 grants.
CREATE FUNCTION p4_r11_ci.read_member_roles()
RETURNS TABLE(actor_id uuid,role_code text,active boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $fn$
 SELECT m.actor_id::uuid,r.role_code,m.active AND r.active
 FROM p4_r7_ci.memberships m
 JOIN p4_r7_ci.role_grants r
   ON r.organization_id=m.organization_id AND r.actor_id=m.actor_id
 WHERE m.organization_id::text=NULLIF(current_setting('app.tenant_id',true),'')
   AND p4_r11_ci.can_read(m.organization_id::uuid,'memberships')
   AND (NOT EXISTS(
     SELECT 1 FROM p4_r7_ci.role_grants self
     WHERE self.organization_id=m.organization_id
       AND self.actor_id::text=NULLIF(current_setting('app.actor_id',true),'')
       AND self.role_code='ORG_ADMIN' AND self.active)
     OR r.role_code IN ('SALES_REP','SALES_MANAGER','ONBOARDING_MANAGER',
       'ONBOARDING_COORDINATOR','AGENT_MANAGER','BILLING_ADMIN'))
 ORDER BY m.actor_id,r.role_code
 LIMIT 40
$fn$;
REVOKE ALL ON FUNCTION p4_r11_ci.read_member_roles() FROM PUBLIC;

ALTER TABLE p4_r11_ci.invitation_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE p4_r11_ci.invitation_status FORCE ROW LEVEL SECURITY;
ALTER TABLE p4_r11_ci.audit_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE p4_r11_ci.audit_status FORCE ROW LEVEL SECURITY;
CREATE POLICY invitations_scoped ON p4_r11_ci.invitation_status
 FOR SELECT USING(
  p4_r11_ci.can_read(organization_id::uuid,'invitations')
 );
CREATE POLICY audit_scoped ON p4_r11_ci.audit_status
 FOR SELECT USING(
  p4_r11_ci.can_read(organization_id::uuid,'audit_events')
 );
GRANT USAGE ON SCHEMA p4_r11_ci TO p4_v1_ci_runtime;
GRANT EXECUTE ON FUNCTION p4_r11_ci.can_read(uuid,text)
 TO p4_v1_ci_runtime;
GRANT EXECUTE ON FUNCTION p4_r11_ci.read_member_roles()
 TO p4_v1_ci_runtime;
GRANT SELECT (organization_id,id,issued_by,role_code,status,expires_at)
 ON p4_r11_ci.invitation_status TO p4_v1_ci_runtime;
GRANT SELECT (organization_id,id,actor_user_id,action,occurred_at)
 ON p4_r11_ci.audit_status TO p4_v1_ci_runtime;
-- No INSERT, UPDATE, DELETE, hidden token/email or raw payload SELECT.
COMMIT;
