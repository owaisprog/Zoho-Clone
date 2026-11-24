-- P4 R51: owner-only redacted audit activity of fictional records.
-- Disposable PostgreSQL CI only, NEVER a production or Neon migration.
\set ON_ERROR_STOP on
BEGIN;
DO $guard$ BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci'
 OR current_user<>'demo_ci'
 OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
 OR EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='p4_r51_ci')
 OR to_regprocedure('p4_r40_ci.require_current_owner(uuid)') IS NULL
 THEN RAISE EXCEPTION 'P4_R51_DISPOSABLE_CI_ONLY'; END IF;
END $guard$;
CREATE SCHEMA p4_r51_ci;
REVOKE ALL ON SCHEMA p4_r51_ci FROM PUBLIC;
GRANT USAGE ON SCHEMA p4_r51_ci TO p4_synthetic_ci_runtime;
CREATE FUNCTION p4_r51_ci.owner_activity(p_org uuid,p_kind text)
RETURNS TABLE(
 event_id uuid,kind text,subject_id text,
 actor_user_id text,occurred_at timestamptz
) LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog AS $body$
BEGIN
 PERFORM p4_r40_ci.require_current_owner(p_org);
 IF p_kind IS NULL OR p_kind NOT IN ('all','role.changed',
  'member.revoked','member.reactivated',
  'invitation.renewed','invitation.canceled')
 THEN RAISE EXCEPTION USING ERRCODE='P5100',MESSAGE='INVALID_ACTIVITY_KIND'; END IF;
 RETURN QUERY
 WITH activity AS(
  SELECT e.request_id AS eid,'role.changed'::text AS k,
   e.target_user_id::text AS subject,
   e.actor_user_id::text AS actor,e.occurred_at AS at
  FROM p4_r40_ci.role_events e WHERE e.org_id=p_org
  UNION ALL
  SELECT e.request_id,e.event_kind::text,e.target_user_id::text,
   e.actor_user_id::text,e.occurred_at
  FROM p4_r43_ci.membership_events e WHERE e.org_id=p_org
  UNION ALL
  SELECT e.id,'invitation.renewed'::text,
   e.renewed_invitation_id::text,e.actor_user_id::text,e.occurred_at
  FROM p4_r45_ci.renewal_events e WHERE e.org_id=p_org
  UNION ALL
  SELECT e.id,'invitation.canceled'::text,
   e.invitation_id::text,e.actor_user_id::text,e.occurred_at
  FROM p4_r46_ci.cancellation_events e WHERE e.org_id=p_org
 )
 SELECT a.eid,a.k,a.subject,a.actor,a.at FROM activity a
 WHERE p_kind='all' OR a.k=p_kind
 ORDER BY a.at DESC,a.eid DESC LIMIT 21;
END $body$;
REVOKE ALL ON FUNCTION p4_r51_ci.owner_activity(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p4_r51_ci.owner_activity(uuid,text)
 TO p4_synthetic_ci_runtime;
COMMIT;
