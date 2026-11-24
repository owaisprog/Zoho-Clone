#!/usr/bin/env node
/** R42 CI-only audit history boundary, not production audit approval. */
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const sql=read("backend/db/candidates/026_p4_r42_ci_member_role_history.sql");
const service=read("backend/src/platform/p4-r40-ci-member-roles.ts");
const route=read("backend/src/platform/p4-r40-ci-member-roles-router.ts");
const client=read("frontend/src/lib/p4-r41-ci-member-role-client.ts");
const parser=read("frontend/src/lib/p4-r42-ci-role-history-contract.ts");
const smoke=read("scripts/p4-r42-role-history-smoke.ts");
for(const [source,parts] of [
 [sql,["SECURITY DEFINER","require_current_owner",
  "current_database()","LIMIT 21","GRANT EXECUTE ON FUNCTION",
  "REVOKE ALL ON FUNCTION"]],
 [service,["async history(","read_member_role_history","rows.rows.length>20"]],
 [route,['"/:orgId/role-history"',"resolveVerifiedActor(req)"]],
 [client,["async history(","parseP4R42HistoryPage","this.call("]],
 [parser,["Object.keys(x).sort()","Number.isSafeInteger","Object.freeze"]],
 [smoke,["fresh owner and tenant isolation PASS","read-only","role_events"]],
 ]){
 for(const part of parts)if(!source.includes(part))
  throw Error("P4_R42_HISTORY_SOURCE_CONTRACT_DRIFT");
}
if(sql.includes("GRANT SELECT ON p4_r40_ci.role_events"))
 throw Error("P4_R42_DIRECT_AUDIT_TABLE_ACCESS_DENIED");
const app=read("backend/src/app.ts");
const ui=read("frontend/src/components/p4-functional-workspace.tsx");
for(const s of [app,ui]){
 if(s.includes("p4-r42-ci-role-history")||s.includes("p4-r40-ci-member-roles"))
  throw Error("P4_R42_PRODUCTION_IMPORT_DENIED");
}
console.log("P4 R42 owner-only role audit function, strict typed projection and source isolation PASS; NO_GO");
