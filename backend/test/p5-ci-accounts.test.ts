import {test} from "node:test";
import assert from "node:assert/strict";
import {parseAccount,parseAccountWrite} from "../src/platform/p5-ci-accounts.js";
const id="99400000-0000-4000-8000-000000000001",base={requestId:id,name:"Demo Retail",industry:"RETAIL"};
test("account fields and write authority are strictly bounded",()=>{
 assert.deepEqual(parseAccountWrite({...base,id},false),{...base,id,expectedRevision:null});
 assert.deepEqual(parseAccountWrite({...base,expectedRevision:0},true),{...base,id:null,expectedRevision:0});
 for(const x of [{...base,id,ownerId:id},{...base,id,bankAccount:"fake"},{...base,id,name:"Actual Business"},{...base,id,industry:"UNKNOWN"}])assert.throws(()=>parseAccountWrite(x,false));
 assert.throws(()=>parseAccount({id,name:base.name,industry:base.industry,revision:0,teamId:id}));
});
