import {test} from "node:test";
import assert from "node:assert/strict";
import {parsePreview,parseReceipt} from "../src/lib/p5-duplicate-client";
const a="99400000-0000-4000-8000-000000000001",b="99400000-0000-4000-8000-000000000002";
test("merge projections verify identity, exact email and account",()=>{
 const s={id:a,displayName:"Demo Source Contact",email:"duplicate@example.com",accountId:a,revision:0},t={...s,id:b,displayName:"Demo Target Contact"};
 const p={source:s,target:t,dealCount:1,eligible:true};assert.deepEqual(parsePreview(p,a,b),p);
 assert.throws(()=>parsePreview({...p,target:{...t,accountId:b}},a,b));
 assert.throws(()=>parsePreview({...p,target:{...t,email:"different@example.com"}},a,b));
 assert.deepEqual(parseReceipt({sourceId:a,targetId:b,dealCount:1},a,b),{sourceId:a,targetId:b,dealCount:1});
 assert.throws(()=>parseReceipt({sourceId:b,targetId:a,dealCount:1},a,b));
});
