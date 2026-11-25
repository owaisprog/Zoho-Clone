import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {prepareR95,runR95} from "./p4-r95-identity-acceptance.mjs";
import {readR90} from "./p4-r90-acceptance-review.mjs";
const m=JSON.parse(readFileSync(new URL("../docs/engineering/p4-r95-identity-acceptance.json",import.meta.url),"utf8"));
const db={decision:"NO_GO",executionAuthorized:false,writerAuthorized:false};
test("R95 builds exact P4 pending case queue and checks fictional identity syntax",()=>{const r=runR95();assert.equal(r.p4Queue.length,108);assert.equal(r.formalExecuted,0);assert.equal(r.liveIdentityVerified,false);assert.equal(r.identityFixture.liveVerified,false);assert.equal(r.p4Queue.filter(x=>x.engineeringEvidence==="PARTIAL_REFERENCE").length,43);});
test("R95 rejects live identity, approval escalation and altered acceptance",()=>{const a=readR90();for(const mutate of [x=>x.liveAuth0=true,x=>x.deploy=true,x=>x.formalExecution=true,x=>x.ownerAccepted=true,x=>x.identity.issuer="https://example.com/",x=>x.identity.mfaApproved=true,x=>x.checks.pop(),x=>x.evidenceFields.pop()]){const q=structuredClone(m);mutate(q);assert.throws(()=>prepareR95(q,db,a));}assert.throws(()=>prepareR95(m,db,{...a,formalExecuted:1}));assert.throws(()=>prepareR95(m,{...db,writerAuthorized:true},a));});
