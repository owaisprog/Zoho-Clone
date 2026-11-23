-- P4 R30: one-use invitation redemption in a disposable PostgreSQL CI fixture.
-- SECURITY DEFINER deliberately crosses the existing OWNER-only RLS write policy.
-- It is CI-only and MUST NOT be migrated or copied to Neon, staging or prod.
\set ON_ERROR_STOP on
BEGIN;
DO $guard$
BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci'
  OR current_user<>'demo_ci'
  OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='p4_synthetic_ci_runtime')
 THEN RAISE EXCEPTION 'P4_R30_DISPOSABLE_ONLY'; END IF;
END $guard$;
CREATE SCHEMA p4_r30_ci;
REVOKE ALL ON SCHEMA p4_r30_ci FROM PUBLIC;
GRANT USAGE ON SCHEMA p4_r30_ci TO p4_synthetic_ci_runtime;

CREATE FUNCTION p4_r30_ci.redeem_fictional_invitation(
 supplied_hash text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $fn$
DECLARE
 actor text;
 invite record;
 changed integer;
BEGIN
 -- A caller cannot nominate recipient email, role, org, or membership user.
 -- Only the server-injected fictional actor ID and database verified email
 -- determine the recipient. No matching row => generic false.
 IF current_database()<>'zoho_clone_synthetic_ci'
  OR current_setting('role',true)<>'p4_synthetic_ci_runtime'
  OR supplied_hash !~ '^[0-9a-f]{64}$'
 THEN RETURN false; END IF;
 actor:=nullif(current_setting('app.actor_id',true),'');
 IF actor IS NULL OR actor !~ '^user_demo_[a-z]{2,16}$'
 THEN RETURN false; END IF;
 SELECT i.id,i.org_id,i.recipient_email,i.status,i.expires_at
 INTO invite
 FROM p4_synthetic.invitations i
 JOIN p4_synthetic.identity_subjects s
  ON s.canonical_email=i.recipient_email
  AND s.user_id=actor AND s.email_verified=true
 WHERE i.token_hash=supplied_hash AND i.status='pending'
 FOR UPDATE OF i;
 IF NOT FOUND OR invite.expires_at<=clock_timestamp() THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM p4_synthetic.memberships m
  WHERE m.org_id=invite.org_id AND m.user_id=actor)
 THEN RETURN false; END IF;
 -- A bound single-use compare-and-set update plus membership insertion.
 -- They commit or roll back as one transaction; unique conflicts abort.
 UPDATE p4_synthetic.invitations
 SET status='accepted',version=version+1
 WHERE id=invite.id AND status='pending'
  AND expires_at>clock_timestamp();
 GET DIAGNOSTICS changed=ROW_COUNT;
 IF changed<>1 THEN RETURN false; END IF;
 INSERT INTO p4_synthetic.memberships(org_id,user_id,role,active)
 VALUES (invite.org_id,actor,'MEMBER',true);
 RETURN true;
END $fn$;
REVOKE ALL ON FUNCTION p4_r30_ci.redeem_fictional_invitation(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p4_r30_ci.redeem_fictional_invitation(text)
 TO p4_synthetic_ci_runtime;
COMMIT;
