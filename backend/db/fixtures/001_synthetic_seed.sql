-- Only fictional fixtures. This file intentionally contains NO customer data.
BEGIN;
DO $$
BEGIN
  IF current_database() NOT IN ('zoho_clone_synthetic', 'zoho_clone_synthetic_ci') THEN
    RAISE EXCEPTION 'Synthetic fixtures refused: wrong database';
  END IF;
END $$;
INSERT INTO synthetic.organizations (id, display_name) VALUES
  ('org_demo_orchid','Demo Orchid Payments'),
  ('org_demo_cedar','Demo Cedar Payments');
INSERT INTO synthetic.memberships (org_id,user_id,role,record_scope,active) VALUES
  ('org_demo_orchid','user_demo_alice','SALES_EDITOR','owned',true),
  ('org_demo_orchid','user_demo_bob','SALES_READER','all',true),
  ('org_demo_orchid','user_demo_admin','ORG_ADMIN','all',true),
  ('org_demo_orchid','user_demo_eve','SALES_EDITOR','all',false),
  ('org_demo_cedar','user_demo_carla','SALES_EDITOR','all',true);
INSERT INTO synthetic.leads
  (org_id,id,owner_id,organization,contact,email,stage,version) VALUES
  ('org_demo_orchid','LEAD-DEMO-201','user_demo_alice','Demo Orchid Shops','Example Contact A','orchid@example.com','new',1),
  ('org_demo_orchid','LEAD-DEMO-202','user_demo_bob','Demo Maple Store','Example Contact B','maple@example.com','contacted',2),
  ('org_demo_cedar','LEAD-DEMO-301','user_demo_carla','Demo Cedar Studio','Example Contact C','cedar@example.com','qualified',3);
COMMIT;
