#!/usr/bin/env node
/** R44 synthetic directory constraints and unmounted production boundary. */
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const sql=read("backend/db/candidates/028_p4_r44_ci_member_directory.sql");
const svc=read("backend/src/platform/p4-r40-ci-member-roles.ts");
const route=read("backend/src/platform/p4-r40-ci-member-roles-router.ts");
const client=read("frontend/src/lib/p4-r41-ci-member-role-client.ts");
const contract=read("frontend/src/lib/p4-r44-ci-member-directory-contract.ts");
const ctl=read("frontend/src/lib/p4-r44-ci-member-directory-controller.ts");
const smoke=read("scripts/p4-r44-member-directory-fullstack-smoke.ts");
for(const [source,fragments] of [
 [sql,["zoho_clone_synthetic_ci","SECURITY DEFINER",
  "require_current_owner","LEFT JOIN LATERAL",
  "email_verified=true","p_status='revoked'","LIMIT 21",
  "strpos(lower(","GRANT EXECUTE ON FUNCTION"]],
 [svc,["async directory(","search_member_directory",
  "SET LOCAL ROLE p4_synthetic_ci_runtime","rows.rows.length>20",
  "query.toLowerCase()"]],
 [route,['"/:orgId/member-directory"',"resolveVerifiedActor(req)",
  'Object.keys(req.query).sort().join(",")']],
 [client,["async directory(","encodeURIComponent(q)",
  "parseP4R44DirectoryPage","credentials:\"omit\"",
  "no-store, private"]],
 [contract,["Object.keys(x).sort().join","example[.]com",
  "typeof x.active","parseP4R44DirectoryPage"]],
 [ctl,["revokeAndRefresh","members:Object.freeze([])",
  'message:"Fictional member revoked']],
 [smoke,["owner directory, actual PostgreSQL",
  "recipient-bound-reactivation","bounded-directory-fails-closed",
  "owner-revocation-clears-controller"]],
 ]){
 for(const fragment of fragments){
  if(!source.includes(fragment))throw Error("P4_R44_SOURCE_CONTRACT_DRIFT");
 }
}
if(sql.includes("GRANT SELECT ON p4_synthetic.memberships")||
 sql.includes("GRANT SELECT ON p4_synthetic.identity_subjects"))
 throw Error("P4_R44_DIRECT_TABLE_GRANT_DENIED");
for(const path of ["backend/src/app.ts","backend/src/server.ts",
 "frontend/src/components/p4-functional-workspace.tsx"]){
 const src=read(path);
 if(src.includes("p4-r44-ci-")||src.includes("p4_r44_ci"))
  throw Error("P4_R44_LIVE_APP_IMPORT_BLOCKED");
}
console.log("P4 R44 signed scoped member directory search/filter and disconnected production boundary PASS; NO_GO");
