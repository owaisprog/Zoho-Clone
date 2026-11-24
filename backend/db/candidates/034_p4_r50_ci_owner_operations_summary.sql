-- P4 R50: bounded, aggregate-only owner operations summary for disposable CI.
-- Explicitly NOT an owner-Neon migration or a production authorization grant.
\set ON_ERROR_STOP on
BEGIN;
DO $guard$
BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci'
 OR current_user<>'demo_ci'
 OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
 OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='p4_r50_ci')
 OR to_regprocedure('p4_r40_ci.require_current_owner(uuid)') IS NULL
 THEN RAISE EXCEPTION 'P4_R50_CI_ONLY'; END IF;
END $guard$;
CREATE SCHEMA p4_r50_ci;
REVOKE ALL ON SCHEMA p4_r50_ci FROM PUBLIC;
GRANT USAGE ON SCHEMA p4_r50_ci TO p4_synthetic_ci_runtime;
CREATE FUNCTION p4_r50_ci.owner_operations_summary(p_org uuid)
RETURNS TABLE(
 active_members integer,revoked_members integer,sales_managers integer,
 pending_invites integer,accepted_invites integer,revoked_invites integer,
 expired_invites integer,role_changes integer,membership_events integer,
 renewals integer,cancellations integer
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $body$
BEGIN
 PERFORM p4_r40_ci.require_current_owner(p_org);
 RETURN QUERY
 SELECT
  (SELECT count(*)::integer FROM p4_synthetic.memberships m
    WHERE m.org_id=p_org AND m.role='MEMBER' AND m.active) AS active_members,
  (SELECT count(*)::integer FROM p4_synthetic.memberships m
    WHERE m.org_id=p_org AND m.role='MEMBER' AND NOT m.active) AS revoked_members,
  (SELECT count(*)::integer FROM p4_r40_ci.sales_roles r
    JOIN p4_synthetic.memberships m
      ON m.org_id=r.org_id AND m.user_id=r.user_id
    WHERE r.org_id=p_org AND r.role_code='SALES_MANAGER'
      AND m.role='MEMBER' AND m.active) AS sales_managers,
  (SELECT count(*)::integer FROM p4_synthetic.invitations i
    WHERE i.org_id=p_org AND i.status='pending'
      AND i.expires_at>transaction_timestamp()) AS pending_invites,
  (SELECT count(*)::integer FROM p4_synthetic.invitations i
    WHERE i.org_id=p_org AND i.status='accepted') AS accepted_invites,
  (SELECT count(*)::integer FROM p4_synthetic.invitations i
    WHERE i.org_id=p_org AND i.status='revoked') AS revoked_invites,
  (SELECT count(*)::integer FROM p4_synthetic.invitations i
    WHERE i.org_id=p_org AND
      (i.status='expired' OR (i.status='pending'
        AND i.expires_at<=transaction_timestamp()))) AS expired_invites,
  (SELECT count(*)::integer FROM p4_r40_ci.role_events e
    WHERE e.org_id=p_org) AS role_changes,
  (SELECT count(*)::integer FROM p4_r43_ci.membership_events e
    WHERE e.org_id=p_org) AS membership_events,
  (SELECT count(*)::integer FROM p4_r45_ci.renewal_events e
    WHERE e.org_id=p_org) AS renewals,
  (SELECT count(*)::integer FROM p4_r46_ci.cancellation_events e
    WHERE e.org_id=p_org) AS cancellations;
END $body$;
REVOKE ALL ON FUNCTION p4_r50_ci.owner_operations_summary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p4_r50_ci.owner_operations_summary(uuid)
 TO p4_synthetic_ci_runtime;
COMMIT;
