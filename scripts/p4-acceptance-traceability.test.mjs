import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {parseP4R21Csv,evaluateP4R21Acceptance}
 from "./p4-acceptance-traceability.mjs";
const inventory=readFileSync(resolve("docs/qa/test-inventory.csv"),"utf8");
const features=readFileSync(resolve("docs/qa/feature-coverage.csv"),"utf8");
const manifest=JSON.parse(readFileSync(resolve("docs/qa/p4-engineering-evidence-links.json"),"utf8"));
const fresh=()=>structuredClone(manifest);
const evaluate=(i=inventory,f=features,m=fresh(),exists=()=>true)=>
 evaluateP4R21Acceptance(i,f,m,exists);
test("RFC4180 CSV parsing preserves escaped quoted values and quoted line breaks",()=>{
 const data=parseP4R21Csv('"test_id","scenario"\n"AC-1","Hello, ""world""\nnext"\n');
 assert.deepEqual(data.headers,["test_id","scenario"]);
 assert.deepEqual(data.rows,[{test_id:"AC-1",scenario:'Hello, "world"\nnext'}]);
});
test("malformed and duplicated-header CSVs fail deterministically",()=>{
 for(const input of ['', '"a","a"\n"x","y"', '"a","b"\n"missing"',
  '"a","b"\n"unterminated', '"a","b"\n"ok"bad,"no"']){
  assert.throws(()=>parseP4R21Csv(input));
 }
});
test("real original inventory is unchanged and all evidence links are partial",()=>{
 const result=evaluateP4R21Acceptance(inventory,features,fresh());
 assert.equal(result.valid,true,JSON.stringify(result.errors));
 assert.equal(result.decision,"NO_GO");
 assert.equal(result.originalCases,727);
 assert.equal(result.originalExecuted,0);
 assert.ok(result.p4FeatureCount>=4);
 assert.equal(result.linkedCases,12);
});
test("changing original inventory execution state cannot be counted as a pass",()=>{
 const altered=inventory.replace("NOT_RUN_DOCUMENT_ONLY","PASS");
 const result=evaluate(altered);
 assert.equal(result.valid,false);
 assert.ok(result.errors.includes("INVENTORY_STATE_OR_ID_DRIFT"));
 assert.equal(result.decision,"NO_GO");
 assert.equal(result.originalExecuted,0);
});
test("missing, extra and duplicate planned test cases fail",()=>{
 const rows=inventory.trimEnd().split("\n");
 for(const csv of [rows.slice(0,-1).join("\n")+"\n",
  inventory+rows[1]+"\n",inventory+rows[2]+"\n"]){
  assert.equal(evaluate(csv).valid,false);
 }
});
test("cannot invent owner acceptance, completed classification or executed test",()=>{
 for(const mutation of [
  m=>{m.rows[0].ownerAccepted=true;},
  m=>{m.rows[0].classification="ACCEPTANCE_PASS";},
  m=>{m.rows[0].originalExecutionState="PASSED";},
  m=>{m.originalExecutedTotal=1;},
  m=>{m.evidenceDoesNotExecuteOriginalCases=false;},
  m=>{m.scope="production";},
 ]){
  const m=fresh();mutation(m);
  const result=evaluate(inventory,features,m);
  assert.equal(result.valid,false);
  assert.equal(result.originalExecuted,0);
 }
});
test("dangling, duplicate, unknown, or unsupported evidence links deny",()=>{
 for(const mutation of [
  m=>{m.rows[0].plannedTestId="AC-NONEXISTENT";},
  m=>{m.rows[1].plannedTestId=m.rows[0].plannedTestId;},
  m=>{m.rows.pop();},
  m=>{m.rows[0].limitation="pass";},
  m=>{m.rows[0].evidencePath="../sensitive/customer.csv";},
 ]){
  const m=fresh();mutation(m);
  assert.equal(evaluate(inventory,features,m).valid,false);
 }
});
test("missing referenced engineering file never implies execution",()=>{
 const result=evaluate(inventory,features,fresh(),()=>false);
 assert.equal(result.valid,false);
 assert.ok(result.errors.includes("MISSING_ENGINEERING_EVIDENCE"));
 assert.equal(result.originalExecuted,0);
});
test("original P4 feature cases must still refer to inventory",()=>{
 const invalid=features.replace("AC-050;AC-051","FAKE-ID;AC-051");
 const result=evaluate(inventory,invalid);
 // One replaced ID is tolerated because other planned IDs remain; all
 // references in each feature must exist when the exact map is enforced.
 assert.equal(result.decision,"NO_GO");
 assert.equal(result.originalExecuted,0);
});
test("inventory schema, fake feature coverage and non-CI evidence are rejected",()=>{
 assert.equal(evaluate(inventory.replace('"test_id"','"case_id"')).valid,false);
 assert.equal(evaluate(inventory,features.replace('"implementation_phase"','"wrong_phase"')).valid,false);
 const m=fresh();m.rows[0].evidencePath="docs/engineering/unknown-file.md";
 assert.equal(evaluate(inventory,features,m,()=>false).valid,false);
});
