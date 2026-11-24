-- P4 R58: transactional CRM lead stage progression and immutable history.
-- Disposable CI only: NOT a production/Neon migration.
\set ON_ERROR_STOP on
BEGIN;
DO $guard$ BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci'
 OR current_user<>'demo_ci'
 OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
 OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='p4_r58_ci')
 OR to_regprocedure('p4_r40_ci.require_current_owner(uuid)') IS NULL
 OR to_regclass('p4_r57_ci.leads') IS NULL
 OR to_regclass('p4_r57_ci.lead_events') IS NULL
 THEN RAISE EXCEPTION 'P4_R58_CI_ONLY'; END IF;
END $guard$;
CREATE SCHEMA p4_r58_ci;
REVOKE ALL ON SCHEMA p4_r58_ci FROM PUBLIC;
GRANT USAGE ON SCHEMA p4_r58_ci TO p4_synthetic_ci_runtime;

CREATE FUNCTION p4_r58_ci.change_lead_status(
 p_org uuid,p_lead uuid,p_next text,p_expected integer,p_event uuid
) RETURNS TABLE(
 lead_id uuid,company_name text,contact_email text,source text,
 status text,revision integer,created_at timestamptz
) LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $body$
DECLARE who text; prior text; prior_rev integer;
BEGIN
 PERFORM p4_r40_ci.require_current_owner(p_org);
 who:=nullif(current_setting('app.actor_id',true),'');
 IF p_lead IS NULL OR p_event IS NULL
 OR p_next IS NULL OR p_next NOT IN ('CONTACTED','QUALIFIED','LOST')
 OR p_expected IS NULL OR p_expected<0 OR p_expected>=1000000
 THEN RAISE EXCEPTION USING ERRCODE='P5800',MESSAGE='INVALID_STAGE'; END IF;
 SELECT l.status,l.revision INTO prior,prior_rev
 FROM p4_r57_ci.leads l
 WHERE l.org_id=p_org AND l.lead_id=p_lead FOR UPDATE;
 IF prior IS NULL OR prior_rev<>p_expected OR
  NOT ((prior='NEW' AND p_next='CONTACTED') OR
       (prior='CONTACTED' AND p_next IN ('QUALIFIED','LOST')))
 THEN RAISE EXCEPTION USING ERRCODE='P4009',MESSAGE='STALE_OR_INVALID_STAGE'; END IF;
 UPDATE p4_r57_ci.leads l SET status=p_next,revision=prior_rev+1
 WHERE l.org_id=p_org AND l.lead_id=p_lead;
 INSERT INTO p4_r57_ci.lead_events(
  org_id,event_id,lead_id,actor_user_id,event_kind,
  before_status,after_status,revision
 ) VALUES(p_org,p_event,p_lead,who,'STATUS_CHANGED',
  prior,p_next,prior_rev+1);
 RETURN QUERY SELECT l.lead_id,l.company_name,l.contact_email,
  l.source,l.status,l.revision,l.created_at
 FROM p4_r57_ci.leads l WHERE l.org_id=p_org AND l.lead_id=p_lead;
END $body$;

CREATE FUNCTION p4_r58_ci.list_lead_history(p_org uuid,p_lead uuid)
RETURNS TABLE(event_id uuid,event_kind text,before_status text,
 after_status text,revision integer,actor_user_id text,occurred_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $body$
BEGIN
 PERFORM p4_r40_ci.require_current_owner(p_org);
 IF p_lead IS NULL THEN RAISE EXCEPTION USING ERRCODE='P5800',
  MESSAGE='INVALID_LEAD'; END IF;
 RETURN QUERY SELECT e.event_id,e.event_kind,e.before_status,
  e.after_status,e.revision,e.actor_user_id,e.occurred_at
 FROM p4_r57_ci.lead_events e
 WHERE e.org_id=p_org AND e.lead_id=p_lead
 ORDER BY e.revision,e.event_id LIMIT 21;
END $body$;
REVOKE ALL ON FUNCTION
 p4_r58_ci.change_lead_status(uuid,uuid,text,integer,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION p4_r58_ci.list_lead_history(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION
 p4_r58_ci.change_lead_status(uuid,uuid,text,integer,uuid)
 TO p4_synthetic_ci_runtime;
GRANT EXECUTE ON FUNCTION p4_r58_ci.list_lead_history(uuid,uuid)
 TO p4_synthetic_ci_runtime;
COMMIT;
