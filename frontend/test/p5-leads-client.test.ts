import {test} from "node:test";
import assert from "node:assert/strict";
import {createP5LeadClient,parseLeadPage} from "../src/lib/p5-leads-client";
const id="99300000-0000-4000-8000-000000000001";
const lead={id,companyName:"Demo Company",contactEmail:"sample@example.com",source:"WEBSITE",status:"NEW",revision:0};
test("P5 list uses fixed same-origin endpoint and safe projection",async()=>{
 const client=createP5LeadClient(async(url,opts)=>{assert.equal(String(url),"/api/p5/"+id+"/crm/leads");assert.equal(opts?.credentials,"same-origin");assert.equal(new Headers(opts?.headers).get("authorization"),null);return Response.json({scope:"p5-synthetic",applicationAccess:false,data:{items:[lead],nextCursor:null}});});
 assert.equal((await client.list(id)).items[0]?.companyName,"Demo Company");
 await assert.rejects(client.list("../"));
 assert.throws(()=>parseLeadPage({items:[{...lead,privateNote:"fake"}],nextCursor:null},null));
 assert.throws(()=>parseLeadPage({items:[lead,lead],nextCursor:null},null));
});
