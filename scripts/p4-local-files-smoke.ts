import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {LocalPrivateFiles,classifyClamScan,requireLocalFileScope,type ScanVerdict} from "../backend/src/platform/p4-ci-local-files.js";

const root=fileURLToPath(new URL("..",import.meta.url));
async function scanner(bytes:Buffer):Promise<ScanVerdict>{
 const run=spawnSync("docker",["compose","-f","docker-compose.local-files.yml","run","--rm","--no-deps","-T","scanner"],{
  cwd:root,input:bytes,encoding:"utf8",timeout:90000,maxBuffer:65536,
 });
 if(run.error||run.signal)return "unavailable";
 return classifyClamScan(run.status,run.stdout??"");
}
async function main(){
 requireLocalFileScope(process.env);
 const files=await LocalPrivateFiles.create(scanner,process.env);
 try{
  const content=Buffer.from("Fictional report: three records, total 60.");
  const clean=await files.quarantine(content);
  await assert.rejects(files.readClean(clean));
  assert.equal(await files.scan(clean),"clean");
  assert.deepEqual(await files.readClean(clean),content);
  // Standard harmless EICAR antivirus test marker, not executable malware.
  const marker=Buffer.from(["X5O!P%@AP[4",String.fromCharCode(92),"PZX54(P^)7CC)7}$","EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"].join(""));
  const infected=await files.quarantine(marker);
  assert.equal(await files.scan(infected),"infected");
  await assert.rejects(files.readClean(infected));
  await assert.rejects(files.readClean("../quarantine/"+infected));
  const denied=await LocalPrivateFiles.create(async()=>"unavailable",process.env);
  try{
   const id=await denied.quarantine(content);
   assert.equal(await denied.scan(id),"unavailable");
   await assert.rejects(denied.readClean(id));
  }finally{await denied.close();}
  console.log("P4_LOCAL_FILES_PASS: clean release, EICAR quarantine, scanner failure denial");
 }finally{await files.close();}
}
main().catch(()=>{console.error("P4_LOCAL_FILES_FAIL");process.exitCode=1;});
