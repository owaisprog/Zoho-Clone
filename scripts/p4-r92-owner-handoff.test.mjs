import {test} from "node:test";
import assert from "node:assert/strict";
import {loadR92,evaluateR92} from "./p4-r92-owner-handoff.mjs";
test("R92 preserves official gate, risk, decision and acceptance baselines and P5 scope",()=>{
 const {manifest,baseline}=loadR92(),r=evaluateR92(manifest,baseline);
 assert.equal(r.decision,"NO_GO");assert.equal(r.openGates,10);assert.equal(r.openRisks,14);assert.equal(r.openDecisions,12);assert.equal(r.formalExecuted,0);assert.equal(r.p5FeatureCount,8);
});
test("R92 refuses premature release, omitted gates, altered acceptance and invented P5 scope",()=>{
 const {manifest,baseline}=loadR92();
 for(const mutate of [m=>m.p4ExitApproved=true,m=>m.p5ReleaseAuthorized=true,m=>m.stagingDeploymentAuthorized=true,m=>m.productionAuthorized=true,m=>m.gateReview.pop(),m=>m.gateReview[0].status="CLOSED",m=>m.ownerPackages[0].state="APPROVED",m=>m.originalCases.formalExecuted=727,m=>m.p5[0].id="FT-999",m=>m.checkpoints[0].formalAccepted=true]){
  const m=structuredClone(manifest);mutate(m);assert.throws(()=>evaluateR92(m,baseline));
 }
});
