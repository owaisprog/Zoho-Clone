#!/usr/bin/env node
/** R49 owner paging HMAC and production-import check. */
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const sources=[
 ["backend/db/candidates/033_p4_r49_ci_member_keyset.sql",
  ["zoho_clone_synthetic_ci","SECURITY DEFINER","require_current_owner",
   "ORDER BY m.user_id","LIMIT 21","p_after"]],
 ["backend/src/platform/p4-r49-ci-member-pager.ts",
  ["createHmac","timingSafeEqual","p4_r49_ci.owner_member_page",
   "SET LOCAL ROLE p4_synthetic_ci_runtime","nextCursor"]],
 ["backend/src/platform/p4-r49-ci-member-pager-router.ts",
  ['"/:orgId/member-directory/page"',"resolveVerifiedActor(req)"]],
 ["frontend/src/lib/p4-r49-ci-member-page-client.ts",
  ["parseP4R44DirectoryPage","no-store, private",'credentials:"omit"']],
 ["scripts/p4-r49-member-keyset-smoke.ts",
  ["P4 R49 signed HMAC paginated member directory",
   "cursor-scope-tamper-expiry","owner-revocation-clears-stale-controller"]],
];
for(const [file,needed] of sources)
 for(const item of needed)
  if(!read(file).includes(item))throw Error("P4_R49_SOURCE_DRIFT");
for(const file of ["backend/src/app.ts","backend/src/server.ts",
 "frontend/src/components/p4-functional-workspace.tsx"]){
 const s=read(file);
 if(s.includes("p4-r49-ci-")||s.includes("p4_r49_ci"))
  throw Error("P4_R49_PRODUCTION_IMPORT_DENIED");
}
console.log("P4 R49 signed restricted member keyset and production import boundary PASS; NO_GO");
