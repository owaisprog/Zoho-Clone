import {test} from "node:test";
import assert from "node:assert/strict";
import {parseHandoff} from "../src/lib/p5-handoff-client";
const id="99400000-0000-4000-8000-000000000001";
test("handoff projection requires exact checklist and lifecycle consistency",()=>{
 const row={dealId:id,accountId:id,title:"Demo Won Opportunity",reviewDone:false,contactDone:false,planDone:false,revision:0,status:"PENDING"};
 assert.deepEqual(parseHandoff(row),row);
 assert.throws(()=>parseHandoff({...row,status:"READY"}));
 assert.throws(()=>parseHandoff({...row,reviewDone:true}));
 assert.throws(()=>parseHandoff({...row,actorId:id}));
 assert.deepEqual(parseHandoff({...row,reviewDone:true,contactDone:true,planDone:true,revision:3,status:"READY"}).status,"READY");
});
