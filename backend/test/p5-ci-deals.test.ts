import {test} from "node:test";
import assert from "node:assert/strict";
import {parseDealWrite,parseDealHistory} from "../src/platform/p5-ci-deals.js";
const id="99400000-0000-4000-8000-000000000001",base={id,requestId:id,accountId:id,contactId:id,title:"Demo Deal",valueCents:25000};
test("deal command only allows scoped fields and bounded integer cents",()=>{
 assert.equal(parseDealWrite(base,true).operation,"create");
 for(const x of [{...base,ownerId:id},{...base,valueCents:1.5},{...base,valueCents:-1},{...base,stage:"WON"}])assert.throws(()=>parseDealWrite(x,true));
 assert.equal(parseDealWrite({operation:"transition",requestId:id,expectedRevision:0,nextStage:"DISCOVERY"},false).nextStage,"DISCOVERY");
 assert.throws(()=>parseDealWrite({operation:"transition",requestId:id,expectedRevision:0,nextStage:"OPEN"},false));
 assert.throws(()=>parseDealHistory([{action:"STAGE_CHANGED",revision:1,previousStage:"OPEN",nextStage:"OPEN"}],-1));
});
