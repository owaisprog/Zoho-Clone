#!/usr/bin/env node
/** R48 signed keyset cursor, strict production import isolation and no leaking secrets. */
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const sql=read("backend/db/candidates/032_p4_r48_ci_invitation_keyset.sql");
const service=read("backend/src/platform/p4-r48-ci-invitation-pager.ts");
const router=read("backend/src/platform/p4-r48-ci-invitation-pager-router.ts");
const frontend=read("frontend/src/lib/p4-r48-ci-invitation-page-client.ts");
const smoke=read("scripts/p4-r48-invitation-keyset-smoke.ts");
for(const [source,fields] of [
 [sql,["zoho_clone_synthetic_ci","SECURITY DEFINER","require_current_owner",
  "p_after_time","(v.issued_at,v.id)<(p_after_time,p_after_id)",
  "LIMIT 21","key_time","GRANT EXECUTE ON FUNCTION"]],
 [service,["createHmac","timingSafeEqual","app.tenant_id",
  "SET LOCAL ROLE p4_synthetic_ci_runtime","rawRows.at(-1)",
  "p4_r48_ci.owner_invitation_page","nextCursor"]],
 [router,['"/:orgId/invitations/page"',"resolveVerifiedActor(req)",
  'Object.keys(req.query).sort().join(",")']],
 [frontend,["parseSafeInvitationDraft","credentials:\"omit\"",
  "INVALID_RESPONSE","no-store, private"]],
 [smoke,["tie timestamp","cursor-integrity-tenant-filter-and-expiry",
  "owner-revocation-fail-close-controller"]],
 ]){
 for(const field of fields)if(!source.includes(field))
  throw Error("P4_R48_SOURCE_BOUNDARY_DRIFT");
}
for(const path of ["backend/src/app.ts","backend/src/server.ts",
 "frontend/src/components/p4-functional-workspace.tsx"]){
 if(read(path).includes("p4-r48-ci-")||read(path).includes("p4_r48_ci"))
  throw Error("P4_R48_PRODUCTION_ACTIVATION_DENIED");
}
console.log("P4 R48 signed owner invitation keyset and CI-only import separation PASS; NO_GO");
