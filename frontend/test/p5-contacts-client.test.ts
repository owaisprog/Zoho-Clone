import {test} from "node:test";
import assert from "node:assert/strict";
import {createP5ContactClient,parseContactPage} from "../src/lib/p5-contacts-client";
const id="99400000-0000-4000-8000-000000000001",record={id,displayName:"Demo Person",email:"person@example.com",accountId:id,revision:0};
test("contact reads validate scoped projections and fixed paths",async()=>{
 const client=createP5ContactClient(async(url,init)=>{assert.equal(String(url),"/api/p5/"+id+"/crm/contacts?search=&duplicate=0");assert.equal(init?.credentials,"same-origin");return Response.json({scope:"p5-synthetic",applicationAccess:false,data:{items:[record],nextCursor:null}});});
 assert.deepEqual((await client.list(id)).items,[record]);assert.throws(()=>parseContactPage({items:[{...record,accountId:"bad"}],nextCursor:null},null));await assert.rejects(client.list("../"));
});
