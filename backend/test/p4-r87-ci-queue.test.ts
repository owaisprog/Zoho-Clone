import assert from "node:assert/strict";
import {test} from "node:test";
import {parseWakeup,wakeupJobId,P4R87CiOutbox} from "../src/platform/p4-r87-ci-queue.js";
const a="84000000-0000-4000-8000-000000000001",id="87000000-0000-4000-8000-000000000001";
test("R87 queue envelope contains only tenant/id/attempt and stable job id",()=>{
 const v={organizationId:a,id,attempt:0};assert.deepEqual(parseWakeup(v),v);assert.equal(wakeupJobId(v),a+"-"+id+"-0");
 for(const bad of [{...v,recipient:"private"},{...v,attempt:3},{...v,attempt:-1},{...v,attempt:"0"},{...v,id:"not-id"},null])assert.throws(()=>parseWakeup(bad));
});
test("R87 queue worker cannot be created outside exact disposable CI profile",()=>assert.throws(()=>new P4R87CiOutbox({})));
