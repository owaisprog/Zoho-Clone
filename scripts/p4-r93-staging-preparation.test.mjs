import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {prepareStaging,runR93} from "./p4-r93-staging-preparation.mjs";
const p=JSON.parse(readFileSync(new URL("../docs/engineering/p4-r93-staging-preparation.json",import.meta.url),"utf8"));
const b={decision:"NO_GO",openGates:10,formalExecuted:0};
test("R93 actual repository preparation remains non-executable",()=>{const r=runR93();assert.equal(r.decision,"NO_GO");assert.equal(r.deployAuthorized,false);assert.match(r.digest,/^[a-f0-9]{64}$/);});
test("R93 rejects unapproved topology, external effects, and missing isolation",()=>{for(const mutate of [x=>x.provision=true,x=>x.deploy=true,x=>x.migrate=true,x=>x.merge=true,x=>x.host="unapproved",x=>x.monthlyCostCap=1,x=>x.services.pop(),x=>x.controls.pop(),x=>x.publicIngress=true,x=>x.liveCredentials=true,x=>x.releaseAuthorized=true]){const q=structuredClone(p);mutate(q);assert.throws(()=>prepareStaging(q,b));}assert.throws(()=>prepareStaging(p,{...b,openGates:9}));});
