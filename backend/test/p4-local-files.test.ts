import {test} from "node:test";
import assert from "node:assert/strict";
import {LocalPrivateFiles,classifyClamScan,requireLocalFileScope} from "../src/platform/p4-ci-local-files.js";
const env={P4_LOCAL_FILES_ENABLED:"true"};
test("local files require explicit opt-in and refuse production, Vercel and staging activation",()=>{
 requireLocalFileScope(env);
 for(const override of [{P4_LOCAL_FILES_ENABLED:"false"},{NODE_ENV:"production"},{VERCEL:"1"},{VERCEL_ENV:"preview"},{P4_STAGE_OWNER_ACTIVATION:"approved"}])
  assert.throws(()=>requireLocalFileScope({...env,...override}),/P4_LOCAL_FILE_DENIED/);
});
test("scanner parser is fail closed on missing, ambiguous or inconsistent verdict",()=>{
 assert.equal(classifyClamScan(0,"stdin: OK\n"),"clean");
 assert.equal(classifyClamScan(1,"stdin: Eicar-Signature FOUND\n"),"infected");
 for(const [status,text] of [[null,"stdin: OK"],[2,"stdin: OK"],[0,""],[0,"stdin: OK\nstdin: Eicar-Signature FOUND"],[0,"stdin: Eicar-Signature FOUND"],[1,"stdin: OK"]] as const)
  assert.equal(classifyClamScan(status,text),"unavailable");
});
test("private snapshot, quarantine and one clean release",async()=>{
 const files=await LocalPrivateFiles.create(async bytes=>{bytes.fill(0);return "clean";},env);
 try{
  const input=Buffer.from("fictional attachment");
  const id=await files.quarantine(input);input.fill(1);
  await assert.rejects(files.readClean(id));
  await assert.rejects(files.readClean("../"+id));
  assert.equal(await files.scan(id),"clean");
  assert.deepEqual(await files.readClean(id),Buffer.from("fictional attachment"));
  await assert.rejects(files.scan(id));
  await assert.rejects(files.quarantine(Buffer.alloc(4097)));
  await assert.rejects(files.quarantine(Buffer.alloc(0)));
 }finally{await files.close();}
});
test("infected, scanner error, unavailable and concurrent scan never release",async()=>{
 for(const scanner of [async()=>"infected" as const,async()=>"unavailable" as const,async()=>{throw Error("scanner failed");}]){
  const files=await LocalPrivateFiles.create(scanner,env);
  try{
   const id=await files.quarantine(Buffer.from("fictional"));
   const scan=files.scan(id);
   await assert.rejects(files.scan(id));
   assert.notEqual(await scan,"clean");
   await assert.rejects(files.readClean(id));
  }finally{await files.close();}
 }
});
