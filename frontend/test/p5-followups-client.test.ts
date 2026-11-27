import {test} from "node:test";
import assert from "node:assert/strict";
import {parseFollowup,validDueDate} from "../src/lib/p5-followups-client";
const id="99400000-0000-4000-8000-000000000001";
test("strict follow-up projection and calendar validation",()=>{
 const row={activityId:id,dealId:id,dueDate:"2024-02-29",title:"Demo Follow Up",completed:false,revision:0};
 assert.deepEqual(parseFollowup(row),row);
 assert.equal(validDueDate("2025-02-29"),false);
 assert.throws(()=>parseFollowup({...row,revision:-1}));
 assert.throws(()=>parseFollowup({...row,actorId:id}));
});
