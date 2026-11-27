import {test} from "node:test";
import assert from "node:assert/strict";
import {parseActivity} from "../src/lib/p5-activities-client";
const id="99400000-0000-4000-8000-000000000001";
test("activity projection rejects foreign records, invalid completion and extra fields",()=>{
 const row={id,dealId:id,kind:"TASK",title:"Demo Follow Up",completed:false,revision:0};
 assert.deepEqual(parseActivity(row,id),row);
 assert.throws(()=>parseActivity(row,"99400000-0000-4000-8000-000000000002"));
 assert.throws(()=>parseActivity({...row,kind:"NOTE",completed:true,revision:1},id));
 assert.throws(()=>parseActivity({...row,actorId:id},id));
});
