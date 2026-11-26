import {test} from "node:test";
import assert from "node:assert/strict";
import {LocalSeaweedStore,localObjectPath,readLocalSeaweedConfig} from "../src/platform/p4-ci-local-seaweedfs.js";
import {LocalPrivateFiles,type LocalObjectStore} from "../src/platform/p4-ci-local-files.js";
const env={P4_LOCAL_FILES_ENABLED:"true",P4_LOCAL_SEAWEED_ENABLED:"true",P4_LOCAL_SEAWEED_ENDPOINT:"http://127.0.0.1:18334",P4_LOCAL_SEAWEED_ACCESS:"local"+"a".repeat(24),P4_LOCAL_SEAWEED_SECRET:"b".repeat(64)};
const id="97000000-0000-4000-8000-000000000001";
test("SeaweedFS is explicit loopback only with disposable credentials",()=>{
 assert.equal(readLocalSeaweedConfig(env).access,env.P4_LOCAL_SEAWEED_ACCESS);
 for(const override of [{P4_LOCAL_FILES_ENABLED:"false"},{P4_LOCAL_SEAWEED_ENABLED:"false"},{VERCEL:"1"},{NODE_ENV:"production"},{P4_STAGE_OWNER_ACTIVATION:"approved"},{P4_LOCAL_SEAWEED_ENDPOINT:"https://example.invalid"},{P4_LOCAL_SEAWEED_ENDPOINT:"http://localhost:18334"},{P4_LOCAL_SEAWEED_ACCESS:"invalid"},{P4_LOCAL_SEAWEED_SECRET:"short"}])
  assert.throws(()=>readLocalSeaweedConfig({...env,...override}));
});
test("bucket and object boundaries cannot be changed by caller",async()=>{
 assert.equal(localObjectPath("clean",id),"/zoho-local-clean/"+id);
 assert.throws(()=>localObjectPath("quarantine","../clean/"+id));
 assert.throws(()=>localObjectPath("other" as "clean",id));
 const store=new LocalSeaweedStore(env);
 await assert.rejects(store.read("clean",id));
 await assert.rejects(store.put("quarantine","../"+id,Buffer.from("fixture")));
 await assert.rejects(store.put("quarantine",id,Buffer.alloc(4097)));
 await store.close();
 await assert.rejects(store.put("quarantine",id,Buffer.from("fixture")));
});
test("object-store lifecycle never releases tampered data or failed scans",async()=>{
 const objects=new Map<string,Buffer>();
 const store:LocalObjectStore={
  async put(area,id,bytes){objects.set(area+"/"+id,Buffer.from(bytes));},
  async read(area,id){const data=objects.get(area+"/"+id);if(!data)throw Error("missing");return Buffer.from(data);},
  async close(){objects.clear();},
 };
 const files=LocalPrivateFiles.createWithStore(store,async()=>"clean",env);
 try{
  const id=await files.quarantine(Buffer.from("fictional"));
  objects.set("quarantine/"+id,Buffer.from("changed"));
  assert.equal(await files.scan(id),"unavailable");
  assert.equal(objects.has("clean/"+id),false);
  await assert.rejects(files.readClean(id));
 }finally{await files.close();}
});
