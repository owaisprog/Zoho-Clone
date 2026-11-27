-- P5.22: disposable synthetic CI only.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' OR current_user<>'demo_ci'
 OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
 OR to_regclass('p5_ci.customer_handoffs') IS NULL THEN RAISE EXCEPTION 'P5_DISPOSABLE_ONLY'; END IF;
END $$;
CREATE INDEX p5_search_lead_name ON p5_ci.leads(organization_id,lower(company_name) text_pattern_ops);
CREATE INDEX p5_search_lead_email ON p5_ci.leads(organization_id,contact_email text_pattern_ops);
CREATE INDEX p5_search_account_name ON p5_ci.accounts(organization_id,lower(name) text_pattern_ops);
CREATE INDEX p5_search_contact_name ON p5_ci.contacts(organization_id,lower(display_name) text_pattern_ops);
CREATE INDEX p5_search_contact_email ON p5_ci.contacts(organization_id,email text_pattern_ops);
CREATE INDEX p5_search_deal_title ON p5_ci.deals(organization_id,lower(title) text_pattern_ops);
CREATE TABLE p5_ci.saved_views(
 organization_id uuid NOT NULL,id uuid NOT NULL,actor_id uuid NOT NULL,
 name text NOT NULL CHECK(name ~ '^Demo [A-Za-z][A-Za-z0-9 &.-]{2,74}$'),
 query text NOT NULL CHECK(query ~ '^[A-Za-z0-9 .@-]{0,80}$'),
 entity text NOT NULL CHECK(entity IN ('ALL','ACCOUNT','CONTACT','DEAL','LEAD')),
 columns_mode text NOT NULL CHECK(columns_mode IN ('COMPACT','DETAIL')),
 revision integer NOT NULL DEFAULT 0 CHECK(revision BETWEEN 0 AND 1000000),
 PRIMARY KEY(organization_id,id),FOREIGN KEY(organization_id,actor_id) REFERENCES platform_stage.memberships(organization_id,user_id)
);
CREATE INDEX p5_view_actor ON p5_ci.saved_views(organization_id,actor_id,id);
ALTER TABLE p5_ci.saved_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE p5_ci.saved_views FORCE ROW LEVEL SECURITY;
ALTER TABLE p5_ci.saved_views OWNER TO p4_stage_owner;
REVOKE ALL ON p5_ci.saved_views FROM PUBLIC,p5_ci_runtime;
GRANT SELECT,INSERT ON p5_ci.saved_views TO p5_ci_definer;
GRANT UPDATE(name,query,entity,columns_mode,revision) ON p5_ci.saved_views TO p5_ci_definer;
CREATE POLICY view_read ON p5_ci.saved_views FOR SELECT TO p5_ci_definer USING(true);
CREATE POLICY view_insert ON p5_ci.saved_views FOR INSERT TO p5_ci_definer WITH CHECK(true);
CREATE POLICY view_update ON p5_ci.saved_views FOR UPDATE TO p5_ci_definer USING(true) WITH CHECK(true);
CREATE FUNCTION p5_ci.search_crm(p_issuer text,p_subject text,p_org uuid,p_query text,p_entity text,p_after_kind text,p_after_id uuid) RETURNS jsonb
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
 WHERE p_entity IN ('ALL','CONTACT') AND c.organization_id=p_org AND (lower(c.display_name) LIKE pattern OR c.email LIKE pattern)
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
CREATE FUNCTION p5_ci.view_projection(v p5_ci.saved_views) RETURNS jsonb LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('id',v.id,'name',v.name,'query',v.query,'entity',v.entity,'columnsMode',v.columns_mode,'revision',v.revision)
$$;
CREATE FUNCTION p5_ci.read_views(p_issuer text,p_subject text,p_org uuid,p_after uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 DECLARE who record; result jsonb;
 BEGIN
 IF current_setting('transaction_read_only')<>'on' THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 SELECT * INTO who FROM p5_ci.actor(p_issuer,p_subject,p_org);
 IF NOT FOUND OR NOT(who.rep OR who.manager) THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 SELECT coalesce(jsonb_agg(s.item ORDER BY s.id),'[]'::jsonb) INTO result FROM
 (SELECT v.id,p5_ci.view_projection(v) AS item FROM p5_ci.saved_views v WHERE v.organization_id=p_org AND v.actor_id=who.actor_id AND (p_after IS NULL OR v.id>p_after) ORDER BY v.id LIMIT 21) s;
 RETURN result;
 END $$;
CREATE FUNCTION p5_ci.write_view(p_issuer text,p_subject text,p_org uuid,p_id uuid,p_name text,p_query text,p_entity text,p_columns text,p_expected integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
 DECLARE who record; v p5_ci.saved_views%ROWTYPE;
 BEGIN
 IF current_setting('transaction_isolation')<>'serializable' THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 SELECT * INTO who FROM p5_ci.actor(p_issuer,p_subject,p_org);
 IF NOT FOUND OR NOT(who.rep OR who.manager) THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='42501'; END IF;
 IF p_id IS NULL OR substring(p_id::text from 15 for 1)<>'4' OR substring(p_id::text from 20 for 1) NOT IN ('8','9','a','b')
 OR p_name IS NULL OR p_name !~ '^Demo [A-Za-z][A-Za-z0-9 &.-]{2,74}$' OR p_query IS NULL OR p_query !~ '^[A-Za-z0-9 .@-]{0,80}$'
 OR p_entity IS NULL OR p_entity NOT IN ('ALL','ACCOUNT','CONTACT','DEAL','LEAD') OR p_columns IS NULL OR p_columns NOT IN ('COMPACT','DETAIL')
 OR p_expected IS NULL OR p_expected NOT BETWEEN -1 AND 999999 THEN RAISE EXCEPTION 'P5_INVALID' USING ERRCODE='22023'; END IF;
 SELECT * INTO v FROM p5_ci.saved_views x WHERE x.organization_id=p_org AND x.id=p_id AND x.actor_id=who.actor_id FOR UPDATE;
 IF NOT FOUND THEN
 IF p_expected<>-1 THEN RAISE EXCEPTION 'P5_DENIED' USING ERRCODE='P5004'; END IF;
 INSERT INTO p5_ci.saved_views(organization_id,id,actor_id,name,query,entity,columns_mode) VALUES(p_org,p_id,who.actor_id,p_name,p_query,p_entity,p_columns) ON CONFLICT DO NOTHING RETURNING * INTO v;
 IF NOT FOUND THEN RAISE EXCEPTION 'P5_CONFLICT' USING ERRCODE='23505'; END IF;
 ELSIF v.revision=p_expected+1 AND (v.name,v.query,v.entity,v.columns_mode)=(p_name,p_query,p_entity,p_columns) THEN NULL;
 ELSIF v.revision=p_expected AND (v.name,v.query,v.entity,v.columns_mode) IS DISTINCT FROM (p_name,p_query,p_entity,p_columns) THEN
 UPDATE p5_ci.saved_views SET name=p_name,query=p_query,entity=p_entity,columns_mode=p_columns,revision=revision+1 WHERE organization_id=p_org AND id=p_id RETURNING * INTO v;
 ELSE RAISE EXCEPTION 'P5_CONFLICT' USING ERRCODE='23505'; END IF;
 RETURN p5_ci.view_projection(v);
 END $$;
GRANT CREATE ON SCHEMA p5_ci TO p5_ci_definer;
ALTER FUNCTION p5_ci.search_crm(text,text,uuid,text,text,text,uuid) OWNER TO p5_ci_definer;
ALTER FUNCTION p5_ci.read_views(text,text,uuid,uuid) OWNER TO p5_ci_definer;
ALTER FUNCTION p5_ci.write_view(text,text,uuid,uuid,text,text,text,text,integer) OWNER TO p5_ci_definer;
REVOKE CREATE ON SCHEMA p5_ci FROM p5_ci_definer;
REVOKE ALL ON FUNCTION p5_ci.search_crm(text,text,uuid,text,text,text,uuid),p5_ci.view_projection(p5_ci.saved_views),p5_ci.read_views(text,text,uuid,uuid),p5_ci.write_view(text,text,uuid,uuid,text,text,text,text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p5_ci.view_projection(p5_ci.saved_views) TO p5_ci_definer;
GRANT EXECUTE ON FUNCTION p5_ci.search_crm(text,text,uuid,text,text,text,uuid),p5_ci.read_views(text,text,uuid,uuid),p5_ci.write_view(text,text,uuid,uuid,text,text,text,text,integer) TO p5_ci_runtime;
COMMIT;
