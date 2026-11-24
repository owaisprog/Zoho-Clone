#!/usr/bin/env node
/** R56 recipient-only fictional React confirmation, no public routes or token logs. */
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const checks=[
 ["frontend/src/lib/p4-r56-ci-recipient-acceptance-controller.ts",
  ['private epoch=0',"TOKEN.test(token)","phase:\"submitting\"",
   "membershipActivated:true","reset():void","this.api.accept(token)"]],
 ["frontend/src/components/p4-r56-ci-recipient-acceptance.tsx",
  ['"use client"',"type=\"password\"","autoComplete=\"off\"",
   "P4R56CiRecipientAcceptanceBound","Join your team",
   "CI only","Tokens are never displayed after submission"]],
 ["frontend/test/p4-r56-ci-recipient-acceptance.test.ts",
  ["renderToStaticMarkup","submitting blocks duplicate requests",
   "reset drops late signed acceptance","invalid token fails without network"]],
 ["scripts/p4-r56-recipient-react-smoke.ts",
  ["P4 R56 signed fictional recipient React acceptance",
   "signed-wrong-recipient-rejected-without-token-consumption",
   "replay-and-double-submit-do-not-create-extra-membership"]],
];
for(const [path,fragments] of checks)
 for(const fragment of fragments)
  if(!read(path).includes(fragment))
   throw Error("P4_R56_SOURCE_DRIFT");
for(const path of ["backend/src/app.ts","backend/src/server.ts",
 "frontend/src/app/page.tsx","frontend/src/app/layout.tsx",
 "frontend/src/components/p4-functional-workspace.tsx"]){
 const source=read(path);
 if(source.includes("p4-r56-ci-")||source.includes("P4R56CiRecipient"))
  throw Error("P4_R56_PRODUCTION_FORM_ACTIVATION_DENIED");
}
console.log("P4 R56 real recipient React form, signed one-use acceptance and live app isolation PASS; NO_GO");
