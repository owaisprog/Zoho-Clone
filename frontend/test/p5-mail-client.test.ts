import {test} from "node:test";
import assert from "node:assert/strict";
import {parseTemplate,parseEmail} from "../src/lib/p5-mail-client";
const id="99400000-0000-4000-8000-000000000001";
test("mail projections reject invalid scope and non-synthetic content",()=>{
 const t={id,subject:"Demo Introduction",body:"Demo Welcome message"};assert.deepEqual(parseTemplate(t),t);
 const e={...t,dealId:id,direction:"OUTBOUND",recordedAt:"2027-01-01T00:00:00.000Z"};assert.deepEqual(parseEmail(e,id),e);
 assert.throws(()=>parseEmail(e,"99400000-0000-4000-8000-000000000002"));
 assert.throws(()=>parseTemplate({...t,body:"Actual customer message"}));
 assert.throws(()=>parseTemplate({...t,actorId:id}));
});
