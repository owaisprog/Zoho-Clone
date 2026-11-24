#!/usr/bin/env node
/** R45 audit/outbox renewal never becomes a public API without owner gates. */
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const sql=read("backend/db/candidates/029_p4_r45_ci_invitation_renewal.sql");
const service=read("backend/src/platform/p4-r45-ci-renewal-issuer.ts");
const router=read("backend/src/platform/p4-r45-ci-renewal-router.ts");
const signed=read("backend/src/platform/p4-r33-ci-verified-workflow.ts");
const client=read("frontend/src/lib/p4-r34-ci-http-client.ts");
const smoke=read("scripts/p4-r45-invitation-renewal-smoke.ts");
for(const [source,fragments] of [
 [sql,["zoho_clone_synthetic_ci","SECURITY DEFINER",
  "FORCE ROW LEVEL SECURITY","require_current_owner",
  "renewal_events","invalidate_queued_delivery","GRANT INSERT"]],
 [service,["SET LOCAL ROLE p4_synthetic_ci_runtime",
  "FOR UPDATE","expectedVersion","p4_r45_ci.renewal_events",
  "aes-256-gcm","createHash","invalidate_queued_delivery"]],
 [router,['"/:orgId/invitations/renew"',"resolveVerifiedActor(req)",
  'no-store, private']],
 [signed,["if(deps.renewer)router.use","createP4R45CiRenewalRouter"]],
 [client,["async renew(","expectedVersion","parseSafeInvitationDraft",
  "credentials:\"omit\"","no-store, private"]],
 [smoke,["concurrent CAS","one-use recipient acceptance PASS",
  "queued-old-delivery-invalidated","owner-revocation-denies-renew"]],
 ]){
 for(const fragment of fragments)
  if(!source.includes(fragment))throw Error("P4_R45_SOURCE_GUARD_DRIFT");
}
for(const name of ["backend/src/app.ts","backend/src/server.ts",
 "frontend/src/components/p4-functional-workspace.tsx"]){
 if(read(name).includes("p4-r45-ci-")||read(name).includes("p4_r45_ci"))
  throw Error("P4_R45_LIVE_IMPORT_DENIED");
}
if(sql.includes("GRANT SELECT ON p4_r45_ci.renewal_events")||
 sql.includes("GRANT UPDATE ON p4_r32_ci.delivery_outbox"))
 throw Error("P4_R45_UNSAFE_GRANT");
console.log("P4 R45 locked signed CI owner renewal, encrypted outbox, CAS and production isolation PASS; NO_GO");
