import {test} from "node:test";
import assert from "node:assert/strict";
import {parseTeamPage,buildTeamChange} from "../src/lib/stage-team-editor";
const teamId="99000000-0000-4000-8000-000000000001",requestId="99000000-0000-4000-8000-000000000002";
const row={teamId,active:true,revision:3},page={status:"verified",applicationAccess:false,items:[row],nextCursor:null};
test("team editor accepts bounded grant projection and rejects extra authority or invalid cursors",()=>{
 assert.deepEqual(parseTeamPage(page,null),{items:[row],nextCursor:null});
 for(const bad of [{...page,applicationAccess:true},{...page,items:[{...row,managed:false}]},{...page,items:[row,row]},{...page,nextCursor:teamId}])assert.throws(()=>parseTeamPage(bad,null));
 assert.throws(()=>parseTeamPage(page,teamId));
});
test("team editor binds toggle to revision and stable UUID",()=>{
 assert.deepEqual(buildTeamChange(row,requestId),{teamId,expectedActive:true,nextActive:false,expectedRevision:3,requestId});
 assert.throws(()=>buildTeamChange({...row,revision:-1},requestId));
 assert.throws(()=>buildTeamChange(row,"wrong"));
});
