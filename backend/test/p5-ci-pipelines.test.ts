import {test} from "node:test";
import assert from "node:assert/strict";
import {parseStages,parsePipelineWrite} from "../src/platform/p5-ci-pipelines.js";
const id="99400000-0000-4000-8000-000000000001",stages=[{key:"OPEN",label:"Open"},{key:"REVIEW",label:"Review"},{key:"WON",label:"Won"},{key:"LOST",label:"Lost"}];
test("pipeline definitions validate ordering, uniqueness and forbidden authority fields",()=>{
 assert.deepEqual(parseStages(stages),stages);
 for(const bad of [[],[...stages,stages[0]],stages.slice().reverse(),[{key:"OPEN",label:"Open",probability:100},...stages.slice(1)]])assert.throws(()=>parseStages(bad));
 assert.throws(()=>parsePipelineWrite({id,requestId:id,name:"Demo Pipeline",stages,isDefault:true},true));
});
