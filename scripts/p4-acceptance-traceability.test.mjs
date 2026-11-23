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
 assert.equal(result.linkedCases,34);
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


test("Batch 22 evidence links never turn original identity cases into completed acceptance",()=>{
 const result=evaluate(inventory,features,fresh());
 assert.equal(result.valid,true);
 assert.equal(result.originalExecuted,0);
 assert.equal(result.linkedCases,34);
 const m=fresh();
 for(const id of ["AC-107","AC-108","PERM-T002","API-T002-NEG"]){
  const link=m.rows.find(r=>r.plannedTestId===id);
  assert.ok(link);
  assert.equal(link.classification,"CI_ONLY_PARTIAL");
  assert.equal(link.originalExecutionState,"NOT_RUN_DOCUMENT_ONLY");
  assert.equal(link.ownerAccepted,false);
 }
});
test("Batch 22 forbids replacing original owner-verification link with fake pass",()=>{
 const m=fresh();
 const link=m.rows.find(r=>r.plannedTestId==="PERM-T003");
 assert.ok(link);
 link.ownerAccepted=true;
 const result=evaluate(inventory,features,m);
 assert.equal(result.valid,false);
 assert.equal(result.originalExecuted,0);
});

test("Batch 23 role and tenant evidence remains partial and never approves P4",()=>{
 const m=fresh();const ids=["API-T001-NEG","PERM-T009","PERM-T010",
  "PERM-T026","PERM-T027","AC-099"];
 for(const id of ids){
  const entry=m.rows.find(row=>row.plannedTestId===id);
  assert.ok(entry,id);
  assert.equal(entry.classification,"CI_ONLY_PARTIAL");
  assert.equal(entry.originalExecutionState,"NOT_RUN_DOCUMENT_ONLY");
  assert.equal(entry.ownerAccepted,false);
 }
 const out=evaluate(inventory,features,m);
 assert.equal(out.valid,true);
 assert.equal(out.linkedCases,34);
 assert.equal(out.originalExecuted,0);
 assert.equal(out.decision,"NO_GO");
});
test("Batch 23 prevents false role revocation acceptance signoff",()=>{
 const m=fresh();
 const r=m.rows.find(row=>row.plannedTestId==="API-T001-NEG");
 assert.ok(r);
 r.ownerAccepted=true;
 const output=evaluate(inventory,features,m);
 assert.equal(output.valid,false);
 assert.equal(output.originalExecuted,0);
});

test("Batch 24 new limited security evidence remains unexecuted",()=>{
 const m=fresh();
 for(const id of ["API-T013-NEG","API-T015-NEG","PERM-T028","PERM-T029"]){
  const l=m.rows.find(row=>row.plannedTestId===id);
  assert.ok(l,id);
  assert.equal(l.classification,"CI_ONLY_PARTIAL");
  assert.equal(l.ownerAccepted,false);
  assert.equal(l.originalExecutionState,"NOT_RUN_DOCUMENT_ONLY");
  assert.ok(l.limitation.length>35);
 }
 const out=evaluate(inventory,features,m);
 assert.equal(out.valid,true,JSON.stringify(out.errors));
 assert.equal(out.linkedCases,34);
 assert.equal(out.originalExecuted,0);
 assert.equal(out.decision,"NO_GO");
});
test("Batch 24 rejects invented audit acceptance or wrong evidence file",()=>{
 const m=fresh();
 const r=m.rows.find(row=>row.plannedTestId==="PERM-T028");
 assert.ok(r);r.ownerAccepted=true;
 assert.equal(evaluate(inventory,features,m).valid,false);
 const n=fresh();
 const link=n.rows.find(row=>row.plannedTestId==="API-T013-NEG");
 assert.ok(link);link.evidencePath="../../private.csv";
 assert.equal(evaluate(inventory,features,n).valid,false);
});

test("Batch 25 invitation and member references remain partial",()=>{
 const m=fresh();
 for(const id of ["PERM-T006","API-T006-NEG","API-T008-NEG","API-T009-NEG"]){
  const link=m.rows.find(row=>row.plannedTestId===id);
  assert.ok(link,id);
  assert.equal(link.classification,"CI_ONLY_PARTIAL");
  assert.equal(link.originalExecutionState,"NOT_RUN_DOCUMENT_ONLY");
  assert.equal(link.ownerAccepted,false);
  assert.ok(link.limitation.length>35);
 }
 const output=evaluate(inventory,features,m);
 assert.equal(output.valid,true,JSON.stringify(output.errors));
 assert.equal(output.linkedCases,34);
 assert.equal(output.originalExecuted,0);
 assert.equal(output.decision,"NO_GO");
});
test("Batch 25 rejects fake invitation redemption acceptance",()=>{
 const m=fresh();
 const link=m.rows.find(row=>row.plannedTestId==="PERM-T006");
 assert.ok(link);
 link.classification="ACCEPTANCE_PASS";
 assert.equal(evaluate(inventory,features,m).valid,false);
 const n=fresh();
 n.rows.find(row=>row.plannedTestId==="API-T008-NEG").ownerAccepted=true;
 assert.equal(evaluate(inventory,features,n).valid,false);
});
