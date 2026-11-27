import {test} from "node:test";
import assert from "node:assert/strict";
import {parseRules,parseRulePreview} from "../src/lib/p5-rules-client";
const id="99400000-0000-4000-8000-000000000001";
test("score projection reconciles immutable source and current status",()=>{
 const config={website:10,referral:20,event:15,contacted:10,qualified:60,revision:-1};
 const r={id,originalSource:"WEBSITE",latestSource:"EVENT",status:"CONTACTED",revision:2,sourcePoints:10,statusPoints:10,score:20,reason:null,config};
 assert.deepEqual(parseRules(r,id),r);assert.throws(()=>parseRules({...r,score:25},id));assert.throws(()=>parseRules({...r,sourcePoints:15},id));
 assert.throws(()=>parseRulePreview({leadId:id,leadRevision:0,source:"WEBSITE",ruleRevision:-1,primaryId:id,fallbackId:null,suggestedId:null,eligible:[]},id));
});
