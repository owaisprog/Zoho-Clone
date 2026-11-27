-- P5.24 synthetic contact merge only; preserve immutable conversion receipts.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' OR current_user<>'demo_ci'
 OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
 OR to_regclass('p5_ci.saved_views') IS NULL THEN RAISE EXCEPTION 'P5_DISPOSABLE_ONLY'; END IF;
END $$;
CREATE TABLE p5_ci.merge_audit(
 organization_id uuid NOT NULL,request_id uuid NOT NULL,actor_id uuid NOT NULL,source_id uuid NOT NULL,target_id uuid NOT NULL,
 source_revision integer NOT NULL,target_revision integer NOT NULL,deal_count integer NOT NULL CHECK(deal_count>=0),deal_ids uuid[] NOT NULL CHECK(cardinality(deal_ids)=deal_count),occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(organization_id,request_id),UNIQUE(organization_id,source_id),
 CHECK(source_id<>target_id),
 FOREIGN KEY(organization_id,source_id) REFERENCES p5_ci.contacts(organization_id,id),
 FOREIGN KEY(organization_id,target_id) REFERENCES p5_ci.contacts(organization_id,id),
 FOREIGN KEY(organization_id,actor_id) REFERENCES platform_stage.memberships(organization_id,user_id)
);
ALTER TABLE p5_ci.merge_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE p5_ci.merge_audit FORCE ROW LEVEL SECURITY;
ALTER TABLE p5_ci.merge_audit OWNER TO p4_stage_owner;
REVOKE ALL ON p5_ci.merge_audit FROM PUBLIC,p5_ci_runtime;
GRANT SELECT,INSERT ON p5_ci.merge_audit TO p5_ci_definer;
CREATE POLICY merge_read ON p5_ci.merge_audit FOR SELECT TO p5_ci_definer USING(true);
CREATE POLICY merge_insert ON p5_ci.merge_audit FOR INSERT TO p5_ci_definer WITH CHECK(true);
CREATE TRIGGER p5_merge_immutable BEFORE UPDATE OR DELETE ON p5_ci.merge_audit FOR EACH ROW EXECUTE FUNCTION platform_stage.grant_audit_immutable();
CREATE INDEX p5_duplicate_email ON p5_ci.contacts(organization_id,email,id);
GRANT UPDATE(contact_id) ON p5_ci.deals TO p5_ci_definer;
CREATE FUNCTION p5_ci.guard_merged_contact() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
 BEGIN
 IF EXISTS(SELECT 1 FROM p5_ci.merge_audit a WHERE a.organization_id=OLD.organization_id AND (a.source_id=OLD.id OR a.target_id=OLD.id)) THEN RAISE EXCEPTION 'P5_CONFLICT' USING ERRCODE='23505'; END IF;
 RETURN NEW;
 END $$;
REVOKE ALL ON FUNCTION p5_ci.guard_merged_contact() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p5_ci.guard_merged_contact() TO p5_ci_definer,p4_stage_owner;
CREATE TRIGGER p5_merged_contact_guard BEFORE UPDATE ON p5_ci.contacts FOR EACH ROW EXECUTE FUNCTION p5_ci.guard_merged_contact();
CREATE OR REPLACE FUNCTION p5_ci.read_contacts(p_issuer text,p_subject text,p_org uuid,p_after uuid,p_id uuid,p_search text,p_exact boolean)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 DECLARE who record; result jsonb;
 BEGIN
 IF current_setting('transaction_read_only')<>'on' THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 IF p_search IS NULL OR p_search !~ '^[A-Za-z0-9 .@_-]{0,80}$' OR p_exact IS NULL OR (p_id IS NOT NULL AND p_after IS NOT NULL) THEN RAISE EXCEPTION 'P5_INVALID' USING ERRCODE='22023'; END IF;
 SELECT * INTO who FROM p5_ci.actor(p_issuer,p_subject,p_org);
 IF NOT FOUND OR NOT(who.rep OR who.manager) THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 SELECT coalesce(jsonb_agg(p5_ci.contact_projection(s.row_value) ORDER BY s.id),'[]'::jsonb) INTO result FROM
 (SELECT c AS row_value,c.id FROM p5_ci.contacts c WHERE c.organization_id=p_org AND NOT EXISTS(SELECT 1 FROM p5_ci.merge_audit ma WHERE ma.organization_id=c.organization_id AND ma.source_id=c.id) AND (p_after IS NULL OR c.id>p_after) AND (p_id IS NULL OR c.id=p_id)
 AND (CASE WHEN p_exact THEN lower(c.display_name)=lower(p_search) OR c.email=lower(p_search) ELSE strpos(lower(c.display_name),lower(p_search))>0 OR strpos(c.email,lower(p_search))>0 OR p_search='' END)
 AND ((who.rep AND c.owner_id=who.actor_id) OR (c.team_id IS NOT NULL AND platform_stage.team_membership_check(p_issuer,p_subject,p_org,c.team_id)))
 AND p5_ci.account_visible(p_issuer,p_subject,p_org,c.account_id)
 ORDER BY c.id LIMIT 21) s;
 IF p_id IS NOT NULL THEN RETURN result->0; END IF; RETURN result;
 END $$;

CREATE OR REPLACE FUNCTION p5_ci.search_crm(p_issuer text,p_subject text,p_org uuid,p_query text,p_entity text,p_after_kind text,p_after_id uuid) RETURNS jsonb
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 DECLARE who record; result jsonb; pattern text;
 BEGIN
 IF current_setting('transaction_read_only')<>'on' THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 IF p_query IS NULL OR p_query !~ '^[A-Za-z0-9 .@-]{0,80}$' OR p_entity IS NULL OR p_entity NOT IN ('ALL','ACCOUNT','CONTACT','DEAL','LEAD')
 OR ((p_after_kind IS NULL)<>(p_after_id IS NULL)) OR (p_after_kind IS NOT NULL AND (p_after_kind NOT IN ('ACCOUNT','CONTACT','DEAL','LEAD') OR (p_entity<>'ALL' AND p_entity<>p_after_kind))) THEN RAISE EXCEPTION 'P5_INVALID' USING ERRCODE='22023'; END IF;
 SELECT * INTO who FROM p5_ci.actor(p_issuer,p_subject,p_org);
 IF NOT FOUND OR NOT(who.rep OR who.manager) THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 pattern:=lower(p_query)||'%';
 WITH matches AS (
 SELECT 'ACCOUNT'::text AS kind,a.id,a.name AS label,a.industry AS detail FROM p5_ci.accounts a
 WHERE p_entity IN ('ALL','ACCOUNT') AND a.organization_id=p_org AND lower(a.name) LIKE pattern AND p5_ci.account_visible(p_issuer,p_subject,p_org,a.id)
 UNION ALL
 SELECT 'CONTACT',c.id,c.display_name,c.email FROM p5_ci.contacts c
 WHERE p_entity IN ('ALL','CONTACT') AND c.organization_id=p_org AND NOT EXISTS(SELECT 1 FROM p5_ci.merge_audit ma WHERE ma.organization_id=c.organization_id AND ma.source_id=c.id) AND (lower(c.display_name) LIKE pattern OR c.email LIKE pattern)
 AND ((who.rep AND c.owner_id=who.actor_id) OR (c.team_id IS NOT NULL AND platform_stage.team_membership_check(p_issuer,p_subject,p_org,c.team_id))) AND p5_ci.account_visible(p_issuer,p_subject,p_org,c.account_id)
 UNION ALL
 SELECT 'DEAL',d.id,d.title,d.stage FROM p5_ci.deals d
 WHERE p_entity IN ('ALL','DEAL') AND d.organization_id=p_org AND lower(d.title) LIKE pattern AND p5_ci.deal_visible(p_issuer,p_subject,p_org,d)
 UNION ALL
 SELECT 'LEAD',l.id,l.company_name,l.status FROM p5_ci.leads l
 WHERE p_entity IN ('ALL','LEAD') AND l.organization_id=p_org AND (lower(l.company_name) LIKE pattern OR l.contact_email LIKE pattern)
 AND ((who.rep AND l.owner_id=who.actor_id) OR (l.team_id IS NOT NULL AND platform_stage.team_membership_check(p_issuer,p_subject,p_org,l.team_id)))
 )
 SELECT coalesce(jsonb_agg(jsonb_build_object('kind',s.kind,'id',s.id,'label',s.label,'detail',s.detail) ORDER BY s.kind COLLATE "C",s.id),'[]'::jsonb) INTO result
 FROM (SELECT * FROM matches m WHERE p_after_kind IS NULL OR (m.kind COLLATE "C",m.id)>(p_after_kind COLLATE "C",p_after_id) ORDER BY m.kind COLLATE "C",m.id LIMIT 21) s;
 RETURN result;
 END $$;

CREATE OR REPLACE FUNCTION p5_ci.deal_links_visible(p_issuer text,p_subject text,p_org uuid,p_account uuid,p_contact uuid)
 RETURNS boolean LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT p5_ci.account_visible(p_issuer,p_subject,p_org,p_account) AND EXISTS(
 SELECT 1 FROM p5_ci.contacts c CROSS JOIN p5_ci.actor(p_issuer,p_subject,p_org) w
 WHERE c.organization_id=p_org AND NOT EXISTS(SELECT 1 FROM p5_ci.merge_audit ma WHERE ma.organization_id=c.organization_id AND ma.source_id=c.id) AND c.id=p_contact AND c.account_id=p_account AND (w.rep OR w.manager)
 AND ((w.rep AND c.owner_id=w.actor_id) OR (c.team_id IS NOT NULL AND platform_stage.team_membership_check(p_issuer,p_subject,p_org,c.team_id))))
 $$;

CREATE OR REPLACE FUNCTION p5_ci.write_contact(p_issuer text,p_subject text,p_org uuid,p_id uuid,p_request uuid,p_expected integer,p_name text,p_email text,p_account uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
 DECLARE who record; c p5_ci.contacts%ROWTYPE; ev p5_ci.contact_events%ROWTYPE; fingerprint text; operation text;
 BEGIN
 IF current_setting('transaction_isolation')<>'serializable' THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 SELECT * INTO who FROM p5_ci.actor(p_issuer,p_subject,p_org);
 IF NOT FOUND OR NOT(who.rep OR who.manager) OR (p_expected IS NULL AND NOT who.rep) THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 IF p_id IS NULL OR p_request IS NULL OR substring(p_id::text from 15 for 1)<>'4' OR substring(p_id::text from 20 for 1) NOT IN ('8','9','a','b')
 OR substring(p_request::text from 15 for 1)<>'4' OR substring(p_request::text from 20 for 1) NOT IN ('8','9','a','b')
 OR (p_expected IS NOT NULL AND (p_expected<0 OR p_expected>=1000000))
 OR p_name IS NULL OR p_name !~ '^Demo [A-Za-z][A-Za-z0-9 .-]{2,74}$' OR p_email IS NULL OR p_email !~ '^[a-z][a-z0-9._-]{1,40}@example[.]com$' THEN RAISE EXCEPTION 'P5_INVALID' USING ERRCODE='22023'; END IF;
 IF NOT p5_ci.account_visible(p_issuer,p_subject,p_org,p_account) THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='P5004'; END IF;
 operation:=CASE WHEN p_expected IS NULL THEN 'CREATED' ELSE 'EDITED' END;
 fingerprint:=encode(sha256(convert_to(jsonb_build_array(p_id,p_expected,p_name,p_email,p_account)::text,'UTF8')),'hex');
 SELECT * INTO ev FROM p5_ci.contact_events WHERE organization_id=p_org AND request_id=p_request;
 IF FOUND THEN
  IF ev.actor_id<>who.actor_id OR ev.contact_id<>p_id OR ev.action<>operation OR ev.digest<>fingerprint THEN RAISE EXCEPTION 'P5_CONFLICT' USING ERRCODE='23505'; END IF;
  SELECT * INTO c FROM p5_ci.contacts x WHERE x.organization_id=p_org AND x.id=p_id AND NOT EXISTS(SELECT 1 FROM p5_ci.merge_audit a WHERE a.organization_id=x.organization_id AND a.source_id=x.id) AND ((who.rep AND x.owner_id=who.actor_id) OR (x.team_id IS NOT NULL AND platform_stage.team_membership_check(p_issuer,p_subject,p_org,x.team_id))) AND p5_ci.account_visible(p_issuer,p_subject,p_org,x.account_id);
  IF NOT FOUND THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='P5004'; END IF;
  RETURN jsonb_build_object('outcome','replay','record',p5_ci.contact_projection(c));
 END IF;
 IF p_expected IS NULL THEN
  INSERT INTO p5_ci.contacts(organization_id,id,owner_id,display_name,email,account_id) VALUES(p_org,p_id,who.actor_id,p_name,p_email,p_account) RETURNING * INTO c;
 ELSE
  SELECT * INTO c FROM p5_ci.contacts x WHERE x.organization_id=p_org AND x.id=p_id AND NOT EXISTS(SELECT 1 FROM p5_ci.merge_audit a WHERE a.organization_id=x.organization_id AND a.source_id=x.id) AND ((who.rep AND x.owner_id=who.actor_id) OR (x.team_id IS NOT NULL AND platform_stage.team_membership_check(p_issuer,p_subject,p_org,x.team_id))) AND p5_ci.account_visible(p_issuer,p_subject,p_org,x.account_id) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='P5004'; END IF;
  IF c.revision<>p_expected OR (c.display_name,c.email,c.account_id) IS NOT DISTINCT FROM (p_name,p_email,p_account) THEN RAISE EXCEPTION 'P5_CONFLICT' USING ERRCODE='23505'; END IF;
  UPDATE p5_ci.contacts SET display_name=p_name,email=p_email,account_id=p_account,revision=revision+1 WHERE organization_id=p_org AND id=p_id RETURNING * INTO c;
 END IF;
 INSERT INTO p5_ci.contact_events(organization_id,request_id,contact_id,actor_id,action,revision,digest) VALUES(p_org,p_request,p_id,who.actor_id,operation,c.revision,fingerprint);
 RETURN jsonb_build_object('outcome',CASE WHEN p_expected IS NULL THEN 'created' ELSE 'applied' END,'record',p5_ci.contact_projection(c));
 END $$;

CREATE FUNCTION p5_ci.merge_contact_visible(p_issuer text,p_subject text,p_org uuid,c p5_ci.contacts) RETURNS boolean LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT c.organization_id=p_org AND c.team_id IS NOT NULL AND platform_stage.team_membership_check(p_issuer,p_subject,p_org,c.team_id)
 AND p5_ci.account_visible(p_issuer,p_subject,p_org,c.account_id)
$$;
CREATE FUNCTION p5_ci.contact_merge_preview(p_issuer text,p_subject text,p_org uuid,p_source uuid,p_target uuid) RETURNS jsonb
 LANGUAGE plpgsql STABLE SET search_path=pg_catalog AS $$
 DECLARE src p5_ci.contacts%ROWTYPE; dst p5_ci.contacts%ROWTYPE; n bigint; eligible boolean;
 BEGIN
 SELECT * INTO src FROM p5_ci.contacts c WHERE c.organization_id=p_org AND c.id=p_source AND p5_ci.merge_contact_visible(p_issuer,p_subject,p_org,c);
 IF NOT FOUND THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='P5004'; END IF;
 SELECT * INTO dst FROM p5_ci.contacts c WHERE c.organization_id=p_org AND c.id=p_target AND p5_ci.merge_contact_visible(p_issuer,p_subject,p_org,c);
 IF NOT FOUND THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='P5004'; END IF;
 IF src.id=dst.id OR src.email<>dst.email THEN RAISE EXCEPTION 'P5_INVALID' USING ERRCODE='22023'; END IF;
 SELECT count(*) INTO n FROM p5_ci.deals d WHERE d.organization_id=p_org AND d.contact_id=src.id AND p5_ci.deal_visible(p_issuer,p_subject,p_org,d);
 eligible:=src.account_id IS NOT NULL AND src.account_id=dst.account_id AND src.owner_id=dst.owner_id AND src.team_id=dst.team_id
 AND NOT EXISTS(SELECT 1 FROM p5_ci.merge_audit a WHERE a.organization_id=p_org AND (a.source_id IN(src.id,dst.id) OR a.target_id=src.id))
 AND NOT EXISTS(SELECT 1 FROM p5_ci.conversions c WHERE c.organization_id=p_org AND c.contact_id=src.id)
 AND NOT EXISTS(SELECT 1 FROM p5_ci.deals d WHERE d.organization_id=p_org AND d.contact_id=src.id AND NOT p5_ci.deal_visible(p_issuer,p_subject,p_org,d));
 RETURN jsonb_build_object('source',p5_ci.contact_projection(src),'target',p5_ci.contact_projection(dst),'dealCount',n,'eligible',coalesce(eligible,false));
 END $$;
CREATE FUNCTION p5_ci.read_duplicates(p_issuer text,p_subject text,p_org uuid,p_email text) RETURNS jsonb
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 DECLARE who record; result jsonb;
 BEGIN
 IF current_setting('transaction_read_only')<>'on' THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 SELECT * INTO who FROM p5_ci.actor(p_issuer,p_subject,p_org);
 IF NOT FOUND OR NOT who.manager THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 IF p_email IS NULL OR p_email !~ '^[a-z][a-z0-9._-]{1,40}@example[.]com$' THEN RAISE EXCEPTION 'P5_INVALID' USING ERRCODE='22023'; END IF;
 SELECT coalesce(jsonb_agg(p5_ci.contact_projection(s.row_value) ORDER BY s.id),'[]'::jsonb) INTO result FROM
 (SELECT c AS row_value,c.id FROM p5_ci.contacts c WHERE c.organization_id=p_org AND c.email=p_email
 AND p5_ci.merge_contact_visible(p_issuer,p_subject,p_org,c)
 AND NOT EXISTS(SELECT 1 FROM p5_ci.merge_audit a WHERE a.organization_id=p_org AND a.source_id=c.id) ORDER BY c.id LIMIT 21) s;
 RETURN result;
 END $$;
CREATE FUNCTION p5_ci.preview_merge(p_issuer text,p_subject text,p_org uuid,p_source uuid,p_target uuid) RETURNS jsonb
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 DECLARE who record;
 BEGIN
 IF current_setting('transaction_read_only')<>'on' THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 SELECT * INTO who FROM p5_ci.actor(p_issuer,p_subject,p_org);
 IF NOT FOUND OR NOT who.manager THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 RETURN p5_ci.contact_merge_preview(p_issuer,p_subject,p_org,p_source,p_target);
 END $$;
CREATE FUNCTION p5_ci.apply_merge(p_issuer text,p_subject text,p_org uuid,p_source uuid,p_target uuid,p_request uuid,p_source_rev integer,p_target_rev integer) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
 DECLARE who record; prev p5_ci.merge_audit%ROWTYPE; preview jsonb; n integer; moved uuid[];
 BEGIN
 IF current_setting('transaction_isolation')<>'serializable' THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 SELECT * INTO who FROM p5_ci.actor(p_issuer,p_subject,p_org);
 IF NOT FOUND OR NOT who.manager THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 IF p_source IS NULL OR p_target IS NULL OR p_request IS NULL OR p_source=p_target OR p_source_rev IS NULL OR p_target_rev IS NULL OR p_source_rev NOT BETWEEN 0 AND 1000000 OR p_target_rev NOT BETWEEN 0 AND 1000000 THEN RAISE EXCEPTION 'P5_INVALID' USING ERRCODE='22023'; END IF;
 PERFORM 1 FROM p5_ci.contacts c WHERE c.organization_id=p_org AND c.id IN(p_source,p_target) ORDER BY c.id FOR UPDATE;
 preview:=p5_ci.contact_merge_preview(p_issuer,p_subject,p_org,p_source,p_target);
 SELECT * INTO prev FROM p5_ci.merge_audit a WHERE a.organization_id=p_org AND a.request_id=p_request;
 IF FOUND THEN
 IF (prev.actor_id,prev.source_id,prev.target_id,prev.source_revision,prev.target_revision) IS DISTINCT FROM (who.actor_id,p_source,p_target,p_source_rev,p_target_rev) THEN RAISE EXCEPTION 'P5_CONFLICT' USING ERRCODE='23505'; END IF;
 RETURN jsonb_build_object('sourceId',prev.source_id,'targetId',prev.target_id,'dealCount',prev.deal_count);
 END IF;
 IF NOT (preview->>'eligible')::boolean OR (preview->'source'->>'revision')::integer<>p_source_rev OR (preview->'target'->>'revision')::integer<>p_target_rev THEN RAISE EXCEPTION 'P5_CONFLICT' USING ERRCODE='23505'; END IF;
 WITH changed AS (UPDATE p5_ci.deals SET contact_id=p_target WHERE organization_id=p_org AND contact_id=p_source RETURNING id)
 SELECT count(*)::integer,coalesce(array_agg(id ORDER BY id),ARRAY[]::uuid[]) INTO n,moved FROM changed;
 INSERT INTO p5_ci.merge_audit(organization_id,request_id,actor_id,source_id,target_id,source_revision,target_revision,deal_count,deal_ids)
 VALUES(p_org,p_request,who.actor_id,p_source,p_target,p_source_rev,p_target_rev,n,moved);
 RETURN jsonb_build_object('sourceId',p_source,'targetId',p_target,'dealCount',n);
 END $$;
GRANT CREATE ON SCHEMA p5_ci TO p5_ci_definer;
ALTER FUNCTION p5_ci.read_duplicates(text,text,uuid,text) OWNER TO p5_ci_definer;
ALTER FUNCTION p5_ci.preview_merge(text,text,uuid,uuid,uuid) OWNER TO p5_ci_definer;
ALTER FUNCTION p5_ci.apply_merge(text,text,uuid,uuid,uuid,uuid,integer,integer) OWNER TO p5_ci_definer;
REVOKE CREATE ON SCHEMA p5_ci FROM p5_ci_definer;
REVOKE ALL ON FUNCTION p5_ci.merge_contact_visible(text,text,uuid,p5_ci.contacts),p5_ci.contact_merge_preview(text,text,uuid,uuid,uuid),p5_ci.read_duplicates(text,text,uuid,text),p5_ci.preview_merge(text,text,uuid,uuid,uuid),p5_ci.apply_merge(text,text,uuid,uuid,uuid,uuid,integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p5_ci.merge_contact_visible(text,text,uuid,p5_ci.contacts),p5_ci.contact_merge_preview(text,text,uuid,uuid,uuid) TO p5_ci_definer;
GRANT EXECUTE ON FUNCTION p5_ci.read_duplicates(text,text,uuid,text),p5_ci.preview_merge(text,text,uuid,uuid,uuid),p5_ci.apply_merge(text,text,uuid,uuid,uuid,uuid,integer,integer) TO p5_ci_runtime;
COMMIT;
