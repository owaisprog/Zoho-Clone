import {test} from "node:test";
import assert from "node:assert/strict";
import {parseTeamCommand,CiStageTeamGrants} from "../src/platform/p4-ci-stage-team-grants.js";
const teamId="99000000-0000-4000-8000-000000000001",requestId="99000000-0000-4000-8000-000000000002";
const cmd={teamId,requestId,expectedActive:false,nextActive:true,expectedRevision:0};
test("team command allows only canonical existing grant toggle fields",()=>{
 assert.deepEqual(parseTeamCommand(cmd),cmd);
 for(const bad of [{...cmd,managed:false},{...cmd,organizationId:teamId},{...cmd,teamId:"../other"},{...cmd,nextActive:false},{...cmd,expectedRevision:-1}])assert.throws(()=>parseTeamCommand(bad));
 assert.throws(()=>new CiStageTeamGrants({}));
});
