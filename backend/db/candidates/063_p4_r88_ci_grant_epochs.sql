-- R88: invalidate previously issued download grants on authorization changes.
-- Organization-wide epoch is deliberately conservative. Disposable CI only.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
 IF current_database()<>'zoho_clone_synthetic_ci' OR current_user<>'demo_ci'
 OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
 OR to_regnamespace('p4_r87_ci') IS NULL OR to_regnamespace('p4_r88_ci') IS NOT NULL
 THEN RAISE EXCEPTION 'P4_R88_DISPOSABLE_ONLY'; END IF;
END $$;
CREATE ROLE p4_r88_ci_epoch_writer NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
CREATE SCHEMA p4_r88_ci AUTHORIZATION p4_r82_ci_owner;
REVOKE ALL ON SCHEMA p4_r88_ci FROM PUBLIC;
GRANT USAGE ON SCHEMA p4_r88_ci,p4_r82_ci TO p4_r88_ci_epoch_writer;
CREATE TABLE p4_r88_ci.epochs(
 organization_id p4_r82_ci.uuid_v4 PRIMARY KEY REFERENCES p4_r82_ci.organizations(id),
 epoch bigint NOT NULL DEFAULT 1 CHECK(epoch>0));
INSERT INTO p4_r88_ci.epochs(organization_id) SELECT id FROM p4_r82_ci.organizations;
ALTER TABLE p4_r88_ci.epochs OWNER TO p4_r82_ci_owner;
ALTER TABLE p4_r88_ci.epochs ENABLE ROW LEVEL SECURITY;
ALTER TABLE p4_r88_ci.epochs FORCE ROW LEVEL SECURITY;
REVOKE ALL ON p4_r88_ci.epochs FROM PUBLIC,p4_r82_ci_runtime,p4_r85_ci_writer,p4_r86_ci_worker;
GRANT SELECT,INSERT,UPDATE ON p4_r88_ci.epochs TO p4_r88_ci_epoch_writer;
CREATE POLICY r88_epoch_writer ON p4_r88_ci.epochs TO p4_r88_ci_epoch_writer USING(true) WITH CHECK(true);
GRANT SELECT(organization_id,user_id) ON p4_r82_ci.memberships TO p4_r88_ci_epoch_writer;
CREATE POLICY r88_epoch_membership ON p4_r82_ci.memberships FOR SELECT TO p4_r88_ci_epoch_writer USING(true);
ALTER TABLE p4_r85_ci.download_grants ADD COLUMN authorization_epoch bigint NOT NULL DEFAULT 0 CHECK(authorization_epoch>=0);
CREATE FUNCTION p4_r88_ci.bump_org() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a uuid; b uuid;
BEGIN
 IF TG_OP='UPDATE' AND NEW IS NOT DISTINCT FROM OLD THEN RETURN NULL; END IF;
 IF TG_TABLE_NAME='organizations' THEN
  IF TG_OP='INSERT' THEN INSERT INTO p4_r88_ci.epochs(organization_id) VALUES(NEW.id); RETURN NULL; END IF;
  a:=OLD.id;b:=NEW.id;
 ELSE
  IF TG_OP<>'INSERT' THEN a:=OLD.organization_id; END IF;
  IF TG_OP<>'DELETE' THEN b:=NEW.organization_id; END IF;
 END IF;
 UPDATE p4_r88_ci.epochs SET epoch=epoch+1 WHERE organization_id=a OR organization_id=b;
 RETURN NULL;
END $$;
ALTER FUNCTION p4_r88_ci.bump_org() OWNER TO p4_r88_ci_epoch_writer;
REVOKE ALL ON FUNCTION p4_r88_ci.bump_org() FROM PUBLIC;
CREATE FUNCTION p4_r88_ci.bump_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a uuid; b uuid;
BEGIN
 IF TG_OP='UPDATE' AND NEW IS NOT DISTINCT FROM OLD THEN RETURN NULL; END IF;
 IF TG_TABLE_NAME='users' THEN
  IF TG_OP<>'INSERT' THEN a:=OLD.id; END IF;
  IF TG_OP<>'DELETE' THEN b:=NEW.id; END IF;
 ELSE
  IF TG_OP<>'INSERT' THEN a:=OLD.user_id; END IF;
  IF TG_OP<>'DELETE' THEN b:=NEW.user_id; END IF;
 END IF;
 UPDATE p4_r88_ci.epochs e SET epoch=e.epoch+1 WHERE EXISTS(SELECT 1 FROM p4_r82_ci.memberships m WHERE m.organization_id=e.organization_id AND (m.user_id=a OR m.user_id=b));
 RETURN NULL;
END $$;
ALTER FUNCTION p4_r88_ci.bump_user() OWNER TO p4_r88_ci_epoch_writer;
REVOKE ALL ON FUNCTION p4_r88_ci.bump_user() FROM PUBLIC;
CREATE TRIGGER r88_org_epoch AFTER INSERT OR UPDATE ON p4_r82_ci.organizations FOR EACH ROW EXECUTE FUNCTION p4_r88_ci.bump_org();
CREATE TRIGGER r88_member_epoch AFTER INSERT OR UPDATE OR DELETE ON p4_r82_ci.memberships FOR EACH ROW EXECUTE FUNCTION p4_r88_ci.bump_org();
CREATE TRIGGER r88_entitlement_epoch AFTER INSERT OR UPDATE OR DELETE ON p4_r84_ci.app_entitlements FOR EACH ROW EXECUTE FUNCTION p4_r88_ci.bump_org();
CREATE TRIGGER r88_sales_epoch AFTER INSERT OR UPDATE OR DELETE ON p4_r84_ci.sales_roles FOR EACH ROW EXECUTE FUNCTION p4_r88_ci.bump_org();
CREATE TRIGGER r88_parent_epoch AFTER INSERT OR UPDATE OR DELETE ON p4_r85_ci.attachment_parents FOR EACH ROW EXECUTE FUNCTION p4_r88_ci.bump_org();
CREATE TRIGGER r88_user_epoch AFTER UPDATE ON p4_r82_ci.users FOR EACH ROW EXECUTE FUNCTION p4_r88_ci.bump_user();
CREATE TRIGGER r88_identity_epoch AFTER INSERT OR UPDATE OR DELETE ON p4_r82_ci.identity_subjects FOR EACH ROW EXECUTE FUNCTION p4_r88_ci.bump_user();
CREATE FUNCTION p4_r88_ci.guard_grant() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v bigint;
BEGIN
 SELECT e.epoch INTO v FROM p4_r88_ci.epochs e WHERE e.organization_id=NEW.organization_id;
 IF v IS NULL THEN RAISE EXCEPTION USING ERRCODE='P4003',MESSAGE='ACCESS_DENIED'; END IF;
 IF TG_OP='INSERT' THEN NEW.authorization_epoch:=v; RETURN NEW; END IF;
 IF NEW.organization_id IS DISTINCT FROM OLD.organization_id OR NEW.authorization_epoch IS DISTINCT FROM OLD.authorization_epoch OR (OLD.used AND NOT NEW.used) THEN
  RAISE EXCEPTION USING ERRCODE='P4003',MESSAGE='ACCESS_DENIED';
 END IF;
 IF NOT OLD.used AND NEW.used AND OLD.authorization_epoch<>v THEN RAISE EXCEPTION USING ERRCODE='P4003',MESSAGE='ACCESS_DENIED'; END IF;
 RETURN NEW;
END $$;
ALTER FUNCTION p4_r88_ci.guard_grant() OWNER TO p4_r88_ci_epoch_writer;
REVOKE ALL ON FUNCTION p4_r88_ci.guard_grant() FROM PUBLIC;
CREATE TRIGGER r88_grant_epoch BEFORE INSERT OR UPDATE ON p4_r85_ci.download_grants FOR EACH ROW EXECUTE FUNCTION p4_r88_ci.guard_grant();
COMMIT;
