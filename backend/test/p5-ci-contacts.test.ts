import {test} from "node:test";
import assert from "node:assert/strict";
import {parseContact,parseContactWrite} from "../src/platform/p5-ci-contacts.js";
const id="99400000-0000-4000-8000-000000000001",base={requestId:id,displayName:"Demo Person",email:"person@example.com",accountId:id};
test("contact association requires an opaque UUID or null and rejects unmodeled fields",()=>{
 assert.deepEqual(parseContactWrite({...base,id},false),{...base,id,expectedRevision:null});
 assert.deepEqual(parseContactWrite({...base,accountId:null,expectedRevision:0},true),{...base,accountId:null,id:null,expectedRevision:0});
 for(const x of [{...base,id,ownerId:id},{...base,id,cardNumber:"fake"},{...base,id,accountId:"invalid"},{...base,id,email:"person@real.invalid"}])assert.throws(()=>parseContactWrite(x,false));
 assert.throws(()=>parseContact({id,displayName:base.displayName,email:base.email,accountId:id,revision:0,organizationId:id}));
});
