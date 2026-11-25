import assert from "node:assert/strict";
import {test} from "node:test";
import {readFileSync} from "node:fs";
import {evaluateR83} from "./p4-r83-staging-plan.mjs";
const plan=JSON.parse(readFileSync(new URL("../docs/engineering/p4-r83-staging-plan.json",import.meta.url),"utf8"));
const gates=JSON.parse(readFileSync(new URL("../docs/engineering/p4-release-gates.json",import.meta.url),"utf8"));
test("R83 prepared plan remains NO_GO and evidence references exist",()=>assert.deepEqual(evaluateR83(plan,gates),{valid:true,decision:"NO_GO",deploymentPermitted:false,issues:[]}));
test("R83 rejects forged approvals, deployment, missing evidence and sequence changes",()=>{
 for(const mutate of [p=>p.deploymentPermitted=true,p=>p.requiredApprovals[0].state="APPROVED",p=>p.originalAcceptance.formalExecuted=727,p=>p.checkpoints[0].evidence="missing.ts",p=>p.sequence.reverse(),p=>p.forbidden.pop(),p=>p.stopConditions.pop()]){
  const candidate=structuredClone(plan);mutate(candidate);const out=evaluateR83(candidate,gates);assert.equal(out.valid,false);assert.equal(out.deploymentPermitted,false);
 }
 const changed=structuredClone(gates);changed.gates[0].status="CLOSED";assert.equal(evaluateR83(plan,changed).valid,false);
});
