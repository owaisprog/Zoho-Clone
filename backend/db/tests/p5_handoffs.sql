-- P5.21 synthetic candidate only. Transactional local handoff, not P8/P9 integration.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' OR current_user<>'demo_ci'
 OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
 OR to_regclass('p5_ci.email_logs') IS NULL THEN RAISE EXCEPTION 'P5_DISPOSABLE_ONLY'; END IF;
END $$;
CREATE TABLE p5_ci.customer_handoffs(
 organization_id uuid NOT NULL,deal_id uuid NOT NULL,
 review_done boolean NOT NULL DEFAULT false,contact_done boolean NOT NULL DEFAULT false,plan_done boolean NOT NULL DEFAULT false,
 revision integer NOT NULL DEFAULT 0 CHECK(revision BETWEEN 0 AND 3),
 PRIMARY KEY(organization_id,deal_id),
 FOREIGN KEY(organization_id,deal_id) REFERENCES p5_ci.deals(organization_id,id),
 CHECK(revision=review_done::integer+contact_done::integer+plan_done::integer)
);
ALTER TABLE p5_ci.customer_handoffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE p5_ci.customer_handoffs FORCE ROW LEVEL SECURITY;
ALTER TABLE p5_ci.customer_handoffs OWNER TO p4_stage_owner;
REVOKE ALL ON p5_ci.customer_handoffs FROM PUBLIC,p5_ci_runtime;
GRANT SELECT,INSERT ON p5_ci.customer_handoffs TO p5_ci_definer;
GRANT UPDATE(review_done,contact_done,plan_done,revision) ON p5_ci.customer_handoffs TO p5_ci_definer;
CREATE POLICY handoff_read ON p5_ci.customer_handoffs FOR SELECT TO p5_ci_definer USING(true);
CREATE POLICY handoff_insert ON p5_ci.customer_handoffs FOR INSERT TO p5_ci_definer WITH CHECK(true);
CREATE POLICY handoff_update ON p5_ci.customer_handoffs FOR UPDATE TO p5_ci_definer USING(true) WITH CHECK(true);
CREATE FUNCTION p5_ci.handoff_on_win() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
 BEGIN
 IF NEW.stage='WON' AND OLD.stage IS DISTINCT FROM NEW.stage THEN
 INSERT INTO p5_ci.customer_handoffs(organization_id,deal_id) VALUES(NEW.organization_id,NEW.id) ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
 END $$;
REVOKE ALL ON FUNCTION p5_ci.handoff_on_win() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p5_ci.handoff_on_win() TO p5_ci_definer,p4_stage_owner;
CREATE TRIGGER p5_handoff_on_win AFTER UPDATE OF stage ON p5_ci.deals FOR EACH ROW EXECUTE FUNCTION p5_ci.handoff_on_win();
CREATE FUNCTION p5_ci.handoff_projection(h p5_ci.customer_handoffs,d p5_ci.deals) RETURNS jsonb LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('dealId',h.deal_id,'accountId',d.account_id,'title',d.title,'reviewDone',h.review_done,'contactDone',h.contact_done,'planDone',h.plan_done,'revision',h.revision,'status',CASE WHEN h.revision=3 THEN 'READY' WHEN h.revision=0 THEN 'PENDING' ELSE 'IN_PROGRESS' END)
$$;
CREATE FUNCTION p5_ci.read_handoffs(p_issuer text,p_subject text,p_org uuid,p_after uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 DECLARE who record; result jsonb;
 BEGIN
 IF current_setting('transaction_read_only')<>'on' THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 SELECT * INTO who FROM p5_ci.actor(p_issuer,p_subject,p_org);
 IF NOT FOUND OR NOT(who.rep OR who.manager) THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 SELECT coalesce(jsonb_agg(s.item ORDER BY s.id),'[]'::jsonb) INTO result FROM
 (SELECT h.deal_id AS id,p5_ci.handoff_projection(h,d) AS item FROM p5_ci.customer_handoffs h JOIN p5_ci.deals d ON d.organization_id=h.organization_id AND d.id=h.deal_id
 WHERE h.organization_id=p_org AND d.stage='WON' AND (p_after IS NULL OR h.deal_id>p_after) AND p5_ci.deal_visible(p_issuer,p_subject,p_org,d) ORDER BY h.deal_id LIMIT 21) s;
 RETURN result;
 END $$;
CREATE FUNCTION p5_ci.complete_handoff(p_issuer text,p_subject text,p_org uuid,p_deal uuid,p_step text,p_expected integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
 DECLARE who record; h p5_ci.customer_handoffs%ROWTYPE; d p5_ci.deals%ROWTYPE; done boolean;
 BEGIN
 IF current_setting('transaction_isolation')<>'serializable' THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 SELECT * INTO who FROM p5_ci.actor(p_issuer,p_subject,p_org);
 IF NOT FOUND OR NOT who.rep THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 IF p_step IS NULL OR p_step NOT IN ('REVIEW','CONTACT','PLAN') OR p_expected IS NULL OR p_expected NOT BETWEEN 0 AND 2 THEN RAISE EXCEPTION 'P5_INVALID' USING ERRCODE='22023'; END IF;
 SELECT * INTO d FROM p5_ci.deals x WHERE x.organization_id=p_org AND x.id=p_deal AND x.owner_id=who.actor_id AND x.stage='WON' AND p5_ci.deal_visible(p_issuer,p_subject,p_org,x);
 IF NOT FOUND THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='P5004'; END IF;
 SELECT * INTO h FROM p5_ci.customer_handoffs x WHERE x.organization_id=p_org AND x.deal_id=p_deal FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='P5004'; END IF;
 done:=CASE p_step WHEN 'REVIEW' THEN h.review_done WHEN 'CONTACT' THEN h.contact_done ELSE h.plan_done END;
 IF done AND h.revision=p_expected+1 THEN RETURN p5_ci.handoff_projection(h,d); END IF;
 IF done OR h.revision<>p_expected THEN RAISE EXCEPTION 'P5_CONFLICT' USING ERRCODE='23505'; END IF;
 UPDATE p5_ci.customer_handoffs SET review_done=review_done OR p_step='REVIEW',contact_done=contact_done OR p_step='CONTACT',plan_done=plan_done OR p_step='PLAN',revision=revision+1 WHERE organization_id=p_org AND deal_id=p_deal RETURNING * INTO h;
 RETURN p5_ci.handoff_projection(h,d);
 END $$;
GRANT CREATE ON SCHEMA p5_ci TO p5_ci_definer;
ALTER FUNCTION p5_ci.read_handoffs(text,text,uuid,uuid) OWNER TO p5_ci_definer;
ALTER FUNCTION p5_ci.complete_handoff(text,text,uuid,uuid,text,integer) OWNER TO p5_ci_definer;
REVOKE CREATE ON SCHEMA p5_ci FROM p5_ci_definer;
REVOKE ALL ON FUNCTION p5_ci.handoff_projection(p5_ci.customer_handoffs,p5_ci.deals),p5_ci.read_handoffs(text,text,uuid,uuid),p5_ci.complete_handoff(text,text,uuid,uuid,text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p5_ci.handoff_projection(p5_ci.customer_handoffs,p5_ci.deals) TO p5_ci_definer;
GRANT EXECUTE ON FUNCTION p5_ci.read_handoffs(text,text,uuid,uuid),p5_ci.complete_handoff(text,text,uuid,uuid,text,integer) TO p5_ci_runtime;
COMMIT;
