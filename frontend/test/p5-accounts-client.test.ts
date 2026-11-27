import {test} from "node:test";
import assert from "node:assert/strict";
import {createP5AccountClient,parseAccountPage} from "../src/lib/p5-accounts-client";
const id="99400000-0000-4000-8000-000000000001",record={id,name:"Demo Retail",industry:"RETAIL",revision:0};
test("account reads use a fixed same-origin path and strict projections",async()=>{
 const client=createP5AccountClient(async(url,init)=>{assert.equal(String(url),"/api/p5/"+id+"/crm/accounts?search=&duplicate=0");assert.equal(init?.credentials,"same-origin");return Response.json({scope:"p5-synthetic",applicationAccess:false,data:{items:[record],nextCursor:null}});});
 assert.deepEqual((await client.list(id)).items,[record]);
 assert.throws(()=>parseAccountPage({items:[{...record,ownerId:id}],nextCursor:null},null));
 await assert.rejects(client.list("../"));
});
