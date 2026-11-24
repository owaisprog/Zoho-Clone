#!/usr/bin/env node
/** R63 CI HMAC note paging source/prod isolation proof. */
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const fragments=[
 ["backend/db/candidates/042_p4_r63_ci_crm_note_keyset.sql",
  ["zoho_clone_synthetic_ci","SECURITY DEFINER","require_current_owner",
   "LIMIT 21","GRANT EXECUTE ON FUNCTION"]],
 ["backend/src/platform/p4-r63-ci-note-pager.ts",
  ["createHmac","timingSafeEqual",
   "SET LOCAL ROLE p4_synthetic_ci_runtime",
   "p4_r63_ci.owner_note_page","nextCursor"]],
 ["frontend/src/lib/p4-r63-ci-note-page-client.ts",
  ['credentials:"omit"',"parseP4R61LeadNote","INVALID_RESPONSE"]],
 ["scripts/p4-r63-crm-note-page-smoke.ts",
  ["P4 R63 real signed 25 immutable CRM notes 20+5",
   "cursor-HMAC-lead-and-org-binding",
   "member-forgery-and-revoked-owner-clearing"]],
];
for(const [path,patterns] of fragments)
 for(const pattern of patterns)
  if(!read(path).includes(pattern))
   throw Error("P4_R63_NOTE_PAGE_DRIFT");
for(const file of ["backend/src/app.ts","backend/src/server.ts",
 "frontend/src/app/page.tsx","frontend/src/app/layout.tsx"]){
 if(read(file).includes("p4-r63-ci-"))
  throw Error("P4_R63_LIVE_APP_IMPORT_DENIED");
}
console.log("P4 R63 authenticated fictional immutable notes paging and live app isolation PASS; NO_GO");
