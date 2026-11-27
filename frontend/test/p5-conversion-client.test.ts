import {test} from "node:test";
import assert from "node:assert/strict";
import {parseReceipt,parseDealPage} from "../src/lib/p5-conversion-client";
const id="99400000-0000-4000-8000-000000000001";
test("conversion receipt and deal page reject extraneous fields and invalid stage",()=>{
 assert.deepEqual(parseReceipt({leadId:id,accountId:id,contactId:id,dealId:id,revision:3}),{leadId:id,accountId:id,contactId:id,dealId:id,revision:3});
 assert.throws(()=>parseReceipt({leadId:id,accountId:id,contactId:id,dealId:id,revision:3,actorId:id}));
 assert.throws(()=>parseDealPage({items:[{id,accountId:id,contactId:id,title:"Demo Deal",stage:"WON",revision:0}],nextCursor:null},null));
});
