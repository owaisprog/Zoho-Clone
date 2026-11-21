-- Architecture v1.0 P4.13 provisional TEAM/RECORD + FIELD access experiment.
-- DISPOSABLE GITHUB CI ONLY. Never use as a Neon/managed migration.
\set ON_ERROR_STOP on
BEGIN;
DO $guard$
BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' OR current_user<>'demo_ci'
   OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
   OR NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='p4_v1_ci')
   OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='p4_v1_ci.app_grants'::regclass) THEN
   RAISE EXCEPTION 'P4.13 field and record ACL candidate is disposable CI only';
 END IF;
END $guard$;

-- Fictional fixtures ONLY. The new MEMBER has no personally owned leads.
INSERT INTO p4_v1_ci.users (id,display_name)
 VALUES('10000000-0000-4000-8000-0000000000c1','Demo Charlie');
INSERT INTO p4_v1_ci.identity_subjects
  (issuer,external_subject,user_id,email_verified)
 VALUES('https://demo.us.auth0.com/','auth0|demo-charlie',
  '10000000-0000-4000-8000-0000000000c1',true);
INSERT INTO p4_v1_ci.memberships (organization_id,user_id,role,active)
 VALUES('20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-0000000000c1','MEMBER',true);
INSERT INTO p4_v1_ci.team_memberships (organization_id,team_id,user_id)
 VALUES('20000000-0000-4000-8000-000000000001',
   '30000000-0000-4000-8000-000000000001',
   '10000000-0000-4000-8000-0000000000c1');

-- Seed a simulated confidential field to prove the DB read role CANNOT
-- SELECT it even if a future Prisma route contains a field-selection bug.
ALTER TABLE p4_v1_ci.crm_leads ADD COLUMN confidential_note text NOT NULL
  DEFAULT 'Demo never expose this confidential note';
ALTER TABLE p4_v1_ci.file_metadata ADD COLUMN private_object_locator text NOT NULL
  DEFAULT 'Demo never expose this private object locator';

-- PostgreSQL column privileges are an extra independent field boundary;
-- model projections alone are not a security boundary.
REVOKE SELECT ON p4_v1_ci.crm_leads FROM p4_v1_ci_runtime;
GRANT SELECT (organization_id,id,owner_user_id,team_id,display_name,version)
 ON p4_v1_ci.crm_leads TO p4_v1_ci_runtime;
REVOKE SELECT ON p4_v1_ci.file_metadata FROM p4_v1_ci_runtime;
GRANT SELECT (organization_id,id,lead_id,owner_user_id,scan_state,revision)
 ON p4_v1_ci.file_metadata TO p4_v1_ci_runtime;

-- Team assignment is independently scoped to an authenticated active
-- member and the transaction-local tenant. No team-assignment writes are
-- available to the runtime role.
CREATE POLICY p4_v1_team_self ON p4_v1_ci.team_memberships
 FOR SELECT USING (
   organization_id::text=nullif(current_setting('app.tenant_id',true),'')
   AND user_id::text=nullif(current_setting('app.actor_id',true),'')
   AND EXISTS(SELECT 1 FROM p4_v1_ci.memberships m
      WHERE m.organization_id=team_memberships.organization_id
        AND m.user_id=team_memberships.user_id AND m.active)
 );
GRANT SELECT (organization_id,team_id,user_id)
 ON p4_v1_ci.team_memberships TO p4_v1_ci_runtime;

-- A fixture lead is available iff it belongs to the selected tenant,
-- actor has active membership, CRM app is enabled, the matching DB role
-- holds crm.leads.read, AND actor owns/teams the lead or is org OWNER.
DROP POLICY lead_record_access ON p4_v1_ci.crm_leads;
CREATE POLICY p4_v1_leads_entitlement_role_record_scope
 ON p4_v1_ci.crm_leads FOR SELECT USING (
   organization_id::text=nullif(current_setting('app.tenant_id',true),'')
   AND EXISTS (
     SELECT 1 FROM p4_v1_ci.memberships m
     WHERE m.organization_id=crm_leads.organization_id AND m.active
       AND EXISTS (SELECT 1 FROM p4_v1_ci.app_grants g
           WHERE g.organization_id=crm_leads.organization_id
            AND g.app_code='crm' AND g.active)
       AND EXISTS (SELECT 1 FROM p4_v1_ci.role_permissions rp
           WHERE rp.organization_id=crm_leads.organization_id
            AND rp.role_code=m.role AND rp.permission_code='crm.leads.read')
       AND (m.role='OWNER' OR crm_leads.owner_user_id=m.user_id
         OR EXISTS (SELECT 1 FROM p4_v1_ci.team_memberships tm
             WHERE tm.organization_id=crm_leads.organization_id
               AND tm.team_id=crm_leads.team_id AND tm.user_id=m.user_id))
   )
 );
-- This policy is a sample, NOT the final P1.06 action/field matrix.
COMMIT;
