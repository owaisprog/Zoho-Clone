import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {reviewMigration,runR94} from "./p4-r94-migration-review.mjs";
const m=JSON.parse(readFileSync(new URL("../docs/engineering/p4-r94-migration-review.json",import.meta.url),"utf8"));
const b={decision:"NO_GO",provisionAuthorized:false,deployAuthorized:false};
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("R94 inventories six actual guarded candidates without executing SQL",()=>{const r=runR94();assert.equal(r.entries.length,6);assert.equal(r.executionAuthorized,false);assert.ok(r.entries.every(e=>/^[a-f0-9]{64}$/.test(e.sha256)));});
test("R94 rejects scope escalation, reordered files and missing candidate guard",()=>{for(const mutate of [x=>x.execute=true,x=>x.liveNeon=true,x=>x.copyLegacyRows=true,x=>x.writerApproved=true,x=>x.files.reverse(),x=>x.files[0].path="../outside",x=>x.required.pop()]){const q=structuredClone(m);mutate(q);assert.throws(()=>reviewMigration(q,b,read));}assert.throws(()=>reviewMigration(m,b,()=>"BEGIN; COMMIT;"));assert.throws(()=>reviewMigration(m,{...b,deployAuthorized:true},read));});
