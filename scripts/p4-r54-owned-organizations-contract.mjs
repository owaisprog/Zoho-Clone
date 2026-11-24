#!/usr/bin/env node
/** R54 limited verified owner-org chooser; no real SaaS import. */
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const checks=[
 ["backend/db/candidates/037_p4_r54_ci_owned_organizations.sql",
  ["zoho_clone_synthetic_ci","SECURITY DEFINER","email_verified=true",
   "m.role='OWNER' AND m.active=true","LIMIT 21",
   "nullif(current_setting('app.tenant_id',true),'') IS NOT NULL",
   "GRANT EXECUTE ON FUNCTION"]],
 ["backend/src/platform/p4-r54-ci-owned-organizations.ts",
  ["REPEATABLE READ READ ONLY","SET LOCAL ROLE p4_synthetic_ci_runtime",
   "p4_r54_ci.list_owned_organizations","response.rows.length>200"]],
 ["backend/src/platform/p4-r54-ci-owned-organizations-router.ts",
  ['"/organizations"',"resolveVerifiedActor(req)","no-store, private"]],
 ["frontend/src/lib/p4-r54-ci-owned-organizations-client.ts",
  ["parseP4R54OwnedOrganizations","credentials:\"omit\"",
   "INVALID_RESPONSE","no-store, private"]],
 ["scripts/p4-r54-owned-organizations-smoke.ts",
  ["P4 R54 signed owned-organization chooser","revoked-owner-is-not-listed",
   "signed-owner-and-nonowner-discovery"]],
];
for(const [path,values] of checks)
 for(const value of values)
  if(!read(path).includes(value))throw Error("P4_R54_SOURCE_CONTRACT_DRIFT");
for(const path of ["backend/src/app.ts","backend/src/server.ts",
 "frontend/src/app/page.tsx","frontend/src/app/layout.tsx",
 "frontend/src/components/p4-functional-workspace.tsx"]){
 const src=read(path);
 if(src.includes("p4-r54-ci-")||src.includes("P4R54CiOwned"))
  throw Error("P4_R54_PRODUCTION_ACTIVATION_DENIED");
}
console.log("P4 R54 signed restricted active-owner organizations, no live imports PASS; NO_GO");
