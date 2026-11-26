import assert from "node:assert/strict";
import {randomBytes} from "node:crypto";
import {spawnSync} from "node:child_process";
import {setTimeout as delay} from "node:timers/promises";
import {fileURLToPath} from "node:url";
import {LocalPrivateFiles,classifyClamScan,requireLocalFileScope,type ScanVerdict} from "../backend/src/platform/p4-ci-local-files.js";
import {LocalSeaweedStore,localObjectPath} from "../backend/src/platform/p4-ci-local-seaweedfs.js";

const root=fileURLToPath(new URL("..",import.meta.url));
const endpoint="http://127.0.0.1:18334";
function docker(args:string[],env:NodeJS.ProcessEnv=process.env,input?:Buffer,timeout=90000){
 return spawnSync("docker",args,{cwd:root,env,input,encoding:"utf8",timeout,maxBuffer:65536});
}
function assertLocalDocker(){
 const configured=process.env.DOCKER_HOST;
 if(configured&&!configured.startsWith("unix://"))throw Error("P4_LOCAL_DOCKER_DENIED");
 const result=docker(["context","inspect","--format","{{.Endpoints.docker.Host}}"]);
 if(result.status!==0||!result.stdout.trim().startsWith("unix://"))throw Error("P4_LOCAL_DOCKER_DENIED");
}
async function scanner(bytes:Buffer):Promise<ScanVerdict>{
 const r=docker(["compose","-f","docker-compose.local-files.yml","run","--rm","--no-deps","-T","scanner"],process.env,bytes);
 if(r.error||r.signal)return "unavailable";
 return classifyClamScan(r.status,r.stdout??"");
}
async function main(){
 requireLocalFileScope(process.env);
 if(process.env.P4_LOCAL_SEAWEED_ENABLED!=="true")throw Error("P4_LOCAL_SEAWEED_DENIED");
 assertLocalDocker();
 const nonce=randomBytes(12).toString("hex"),project="zoho-seaweed-"+nonce;
 const env={...process.env,P4_LOCAL_SEAWEED_ENDPOINT:endpoint,P4_LOCAL_SEAWEED_ACCESS:"local"+nonce,P4_LOCAL_SEAWEED_SECRET:randomBytes(32).toString("hex")};
 const args=["compose","-p",project,"-f","docker-compose.local-seaweedfs.yml"];
 let files:LocalPrivateFiles|undefined;
 let stage="startup";
 try{
  if(docker([...args,"up","-d"],env,undefined,180000).status!==0)throw Error("startup");
  const store=new LocalSeaweedStore(env);
  stage="readiness";
  const deadline=Date.now()+90000;
  let ready=false;
  while(Date.now()<deadline){
   try{await store.ready();ready=true;break;}catch{await delay(1000);}
  }
  assert.equal(ready,true);
  const wrong=new LocalSeaweedStore({...env,P4_LOCAL_SEAWEED_SECRET:randomBytes(32).toString("hex")});
  await assert.rejects(wrong.ready());
  files=LocalPrivateFiles.createWithStore(store,scanner,env);
  stage="clean";
  const cleanBytes=Buffer.from("Fictional report: local object storage.");
  const clean=await files.quarantine(cleanBytes);
  assert.deepEqual(await store.read("quarantine",clean),cleanBytes);
  await assert.rejects(files.readClean(clean));
  const anonymous=await fetch(endpoint+localObjectPath("quarantine",clean),{redirect:"error",signal:AbortSignal.timeout(5000)});
  assert.ok([401,403].includes(anonymous.status));await anonymous.body?.cancel();
  assert.equal(await files.scan(clean),"clean");
  assert.deepEqual(await files.readClean(clean),cleanBytes);
  const anonymousClean=await fetch(endpoint+localObjectPath("clean",clean),{redirect:"error",signal:AbortSignal.timeout(5000)});
  assert.ok([401,403].includes(anonymousClean.status));await anonymousClean.body?.cancel();
  stage="infected";
  const marker=Buffer.from(["X5O!P%@AP[4",String.fromCharCode(92),"PZX54(P^)7CC)7}$","EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"].join(""));
  const infected=await files.quarantine(marker);
  assert.equal(await files.scan(infected),"infected");
  await assert.rejects(files.readClean(infected));
  await assert.rejects(store.read("clean",infected));
  stage="cleanup";
  await files.close();files=undefined;
  console.log("P4_LOCAL_SEAWEED_PASS: signed S3 storage, anonymous and bad-signature denial, clean release, infected quarantine");
 }catch{throw Error("P4_LOCAL_SEAWEED_FAIL_"+stage);}
 finally{
  try{await files?.close();}
  finally{if(docker([...args,"down","-v","--remove-orphans"],env).status!==0)throw Error("P4_LOCAL_SEAWEED_FAIL_cleanup");}
 }
}
main().catch((e:unknown)=>{
 const code=e instanceof Error?e.message:"";
 console.error(/^P4_LOCAL_(?:SEAWEED_FAIL_(?:startup|readiness|clean|infected|cleanup)|SEAWEED_DENIED|DOCKER_DENIED|FILE_DENIED)$/.test(code)?code:"P4_LOCAL_SEAWEED_FAIL");
 process.exitCode=1;
});
