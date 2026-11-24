#!/usr/bin/env node
/** R46 signed cancellation and audit are strict disposable CI only. */
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const sql=read("backend/db/candidates/030_p4_r46_ci_invitation_cancellation.sql");
const svc=read("backend/src/platform/p4-r46-ci-invitation-canceler.ts");
const route=read("backend/src/platform/p4-r46-ci-invitation-cancel-router.ts");
const signed=read("backend/src/platform/p4-r33-ci-verified-workflow.ts");
const client=read("frontend/src/lib/p4-r34-ci-http-client.ts");
const smoke=read("scripts/p4-r46-invitation-cancellation-smoke.ts");
for(const [src,required] of [
 [sql,["zoho_clone_synthetic_ci","FORCE ROW LEVEL SECURITY",
  "CREATE POLICY","immutable_cancellation_events","GRANT INSERT"]],
 [svc,["SET LOCAL ROLE p4_synthetic_ci_runtime","version=$3",
  "expires_at>clock_timestamp()","status='revoked'",
  "p4_r45_ci.invalidate_queued_delivery",
  "p4_r46_ci.cancellation_events"]],
 [route,['"/:orgId/invitations/cancel"',"resolveVerifiedActor(req)",
  "no-store, private"]],
 [signed,["if(deps.canceler)router.use","createP4R46CiCancelRouter"]],
 [client,["async cancel(","parsed.status!==\"revoked\"",
  "expectedVersion+1","no-store, private"]],
 [smoke,["P4 R46 signed owner cancellation",
  "concurrent-cancellation-version-guard",
  "queued-delivery-canceled-atomically","new-link-after-cancel"]],
 ]){
 for(const part of required)if(!src.includes(part))
  throw Error("P4_R46_SOURCE_CONTRACT_DRIFT");
}
for(const name of ["backend/src/app.ts","backend/src/server.ts",
 "frontend/src/components/p4-functional-workspace.tsx"]){
 if(read(name).includes("p4-r46-ci-")||read(name).includes("p4_r46_ci"))
  throw Error("P4_R46_LIVE_APP_IMPORT_DENIED");
}
if(sql.includes("GRANT SELECT ON p4_r46_ci.cancellation_events")||
 sql.includes("GRANT UPDATE ON p4_r46_ci.cancellation_events"))
 throw Error("P4_R46_AUDIT_GRANTS_DENIED");
console.log("P4 R46 signed owner invitation cancellation, immutable CI audit and no live API import PASS; NO_GO");
