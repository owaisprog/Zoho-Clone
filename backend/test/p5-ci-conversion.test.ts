import {test} from "node:test";
import assert from "node:assert/strict";
import {parseConversion,parseReceipt,parseDeal} from "../src/platform/p5-ci-conversion.js";
const id="99400000-0000-4000-8000-000000000001",cmd={requestId:id,accountId:id,contactId:id,dealId:id,contactName:"Demo Contact",dealTitle:"Demo Deal",industry:"OTHER",expectedRevision:2};
test("conversion validates exact fields and linked projections",()=>{
 assert.deepEqual(parseConversion(cmd),cmd);
 for(const x of [{...cmd,ownerId:id},{...cmd,expectedRevision:-1},{...cmd,contactName:"Real Name"},{...cmd,dealId:"bad"}])assert.throws(()=>parseConversion(x));
 assert.throws(()=>parseReceipt({leadId:id,accountId:id,contactId:id,dealId:id,revision:0}));
 assert.throws(()=>parseDeal({id,accountId:id,contactId:id,title:"Demo Deal",stage:"WON",revision:0}));
});
