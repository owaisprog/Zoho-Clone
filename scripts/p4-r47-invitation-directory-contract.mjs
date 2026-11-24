#!/usr/bin/env node
/** R47 owner-only fictional invitation directory and disconnected live app. */
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const sql=read("backend/db/candidates/031_p4_r47_ci_invitation_directory.sql");
const svc=read("backend/src/platform/p4-r47-ci-invitation-directory.ts");
const router=read("backend/src/platform/p4-r47-ci-invitation-directory-router.ts");
const signed=read("backend/src/platform/p4-r33-ci-verified-workflow.ts");
const client=read("frontend/src/lib/p4-r47-ci-invitation-directory-client.ts");
const ctl=read("frontend/src/lib/p4-r47-ci-invitation-controller.ts");
const smoke=read("scripts/p4-r47-invitation-directory-smoke.ts");
for(const [source,fragments] of [
 [sql,["zoho_clone_synthetic_ci","SECURITY DEFINER",
  "require_current_owner","CASE WHEN i.status='pending'",
  "LIMIT 21","GRANT EXECUTE ON FUNCTION"]],
 [svc,["SET LOCAL ROLE p4_synthetic_ci_runtime",
  "p4_r47_ci.owner_invitations","result.rows.length>20",
  "Object.freeze(rows)"]],
 [router,['"/:orgId/invitations"',"resolveVerifiedActor(req)",
  'Object.keys(req.query).sort().join(",")']],
 [signed,["if(deps.invitations)router.use",
  "createP4R47CiInvitationDirectoryRouter"]],
 [client,["async list(","parseSafeInvitationDraft","credentials:\"omit\"",
  "INVALID_RESPONSE","no-store, private"]],
 [ctl,["async issue(","async renew(","async cancel(",
  "this.directory.list(orgId,filter,search)","invitations:Object.freeze([])"]],
 [smoke,["P4 R47 signed persisted owner invitation directory",
  "effective-expiry-from-real-database",
  "bounded-list-requires-explicit-future-pagination"]],
 ]){
 for(const fragment of fragments)if(!source.includes(fragment))
  throw Error("P4_R47_SOURCE_CONTRACT_DRIFT");
}
if(sql.includes("GRANT SELECT ON p4_synthetic.invitations"))
 throw Error("P4_R47_RUNTIME_TABLE_READ_DENIED");
for(const name of ["backend/src/app.ts","backend/src/server.ts",
 "frontend/src/components/p4-functional-workspace.tsx"]){
 const source=read(name);
 if(source.includes("p4-r47-ci-")||source.includes("p4_r47_ci"))
  throw Error("P4_R47_LIVE_IMPORT_DENIED");
}
console.log("P4 R47 owner-only signed invitation directory, typed status and live isolation PASS; NO_GO");
