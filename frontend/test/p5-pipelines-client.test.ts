import {test} from "node:test";
import assert from "node:assert/strict";
import {parseStages,parsePipelinePage} from "../src/lib/p5-pipelines-client";
const id="99400000-0000-4000-8000-000000000001",stages=[{key:"OPEN",label:"Open"},{key:"REVIEW",label:"Review"},{key:"WON",label:"Won"},{key:"LOST",label:"Lost"}];
test("pipeline projections validate stable keys and ordering",()=>{assert.deepEqual(parseStages(stages),stages);assert.throws(()=>parseStages(stages.slice().reverse()));assert.throws(()=>parsePipelinePage({items:[{id,name:"Demo Pipeline",isDefault:false,revision:0,stages,ownerId:id}],nextCursor:null},null));});
