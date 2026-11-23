import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {evaluateP4GateManifest,REQUIRED_GATE_IDS,ENGINEERING_CHECKS}
 from "./p4-release-gate-evidence.mjs";
const raw=JSON.parse(readFileSync(resolve("docs/engineering/p4-release-gates.json"),"utf8"));
const clone=()=>structuredClone(raw);
const wf=[
 "node scripts/p4-ci-route-isolation.mjs",
 "node scripts/p4-ci-compiled-boundary.mjs",
 "npm run typecheck","npm run test","npm run build",
 "npm audit --omit=dev --audit-level=critical",
 "node backend/dist/scripts/p4-ci-r17-audit-rotation-smoke.js",
].join("\n");
const run=(x,exists=()=>true,read=()=>wf)=>evaluateP4GateManifest(x,exists,read);
test("valid release baseline has 10 OPEN gates but NEVER becomes GO",()=>{
 const r=run(clone());
 assert.equal(r.valid,true);
 assert.equal(r.decision,"NO_GO");
 assert.equal(r.gates.length,10);
 assert.equal(r.checks.length,ENGINEERING_CHECKS.length);
 assert.ok(r.gates.every(x=>x.status==="OPEN"));
});
test("real tracked release gate manifest and workflow verify consistently",()=>{
 const r=evaluateP4GateManifest(clone());
 assert.equal(r.valid,true,JSON.stringify(r.errors));
 assert.equal(r.decision,"NO_GO");
});
test("any gate asserted as passed is rejected without owner acceptance",()=>{
 const x=clone();x.gates[0].status="APPROVED";
 assert.equal(run(x).valid,false);
 assert.ok(run(x).errors.includes("INVALID_OR_APPROVED_GATE"));
});
test("fake owner approval and forged original acceptance counts fail",()=>{
 for(const patch of [
  {ownerExitApproved:true},{originalP109Executed:727},{openRisks:0},
  {openDecisions:0},{scope:"production"},{readinessClaim:"READY"},
  {defaultDecision:"GO"},
 ]){
  const r=run({...clone(),...patch});
  assert.equal(r.valid,false,JSON.stringify(patch));
  assert.equal(r.decision,"NO_GO");
 }
});
test("gate omission, duplicate, unknown and invented acceptance evidence fail",()=>{
 const x=clone();x.gates.pop();assert.equal(run(x).valid,false);
 const y=clone();y.gates[1].id=y.gates[0].id;
 assert.equal(run(y).valid,false);
 const z=clone();z.gates[2].id="P4-PAYMENTS-LIVE";
 assert.equal(run(z).valid,false);
 const w=clone();w.gates[3].acceptanceEvidence="self-certified";
 assert.equal(run(w).valid,false);
});
test("unsafe references and missing source evidence fail closed",()=>{
 const x=clone();x.gates[0].reference="../private/customer.csv";
 assert.equal(run(x).valid,false);
 const y=run(clone(),()=>false);
 assert.equal(y.valid,false);
 assert.ok(y.errors.includes("ENGINEERING_EVIDENCE_MISSING"));
});
test("workflow missing required check is denied",()=>{
 const r=run(clone(),()=>true,()=>wf.replace("npm run build",""));
 assert.equal(r.valid,false);
 assert.ok(r.errors.includes("REQUIRED_CHECK_NOT_WIRED"));
});
test("unreadable or malformed input denies release",()=>{
 for(const x of [null,undefined,[],{},true,"approved"]){
  const r=run(x);
  assert.equal(r.decision,"NO_GO");
  assert.equal(r.valid,false);
 }
});
test("required gate IDs remain canonical and unique",()=>{
 assert.equal(new Set(REQUIRED_GATE_IDS).size,10);
 assert.ok(REQUIRED_GATE_IDS.every(id=>id.startsWith("P4-")));
});
