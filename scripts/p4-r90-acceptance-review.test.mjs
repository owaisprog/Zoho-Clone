import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {readR90,evaluateR90} from "./p4-r90-acceptance-review.mjs";
const load=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const inv=load("docs/qa/test-inventory.csv"),fc=load("docs/qa/feature-coverage.csv"),legacy=JSON.parse(load("docs/qa/p4-engineering-evidence-links.json")),manifest=JSON.parse(load("docs/qa/r90-verified-ci-evidence.json"));
test("R90 original inventory and unique feature-linked subset remain unexecuted",()=>{
 const r=readR90();assert.equal(r.planned,727);assert.equal(r.p4FeatureCount,7);assert.equal(r.p4LinkedCases,108);assert.equal(r.formalExecuted,0);assert.equal(r.decision,"NO_GO");assert.equal(r.p4PartialReferences+r.p4Unmapped,108);assert.equal(r.rows.filter(x=>x.ownerAccepted).length,0);
});
test("R90 rejects invented IDs, missing references, unverified runs and promoted acceptance",()=>{
 for(const mutate of [m=>m.formalExecuted=727,m=>m.groups[0].ownerAccepted=true,m=>m.groups[0].cases[0][0]="FAKE",m=>m.groups[0].verifiedJobs=3,m=>m.groups.pop(),m=>m.groups[0].sha="not-a-commit",m=>m.groups[0].cases[0][1]="pass"]){const x=structuredClone(manifest);mutate(x);assert.throws(()=>evaluateR90(inv,fc,legacy,x));}
});
