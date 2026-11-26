/** Local synthetic-only BullMQ worker. Never imported by application entrypoints. */
import {randomUUID} from "node:crypto";
import {setTimeout as delay} from "node:timers/promises";
import {Queue,Worker} from "bullmq";
import {isCanonicalUuidV4} from "./p4-approved-uuid.js";

type Env=Readonly<Record<string,string|undefined>>;
export type DemoJob=Readonly<{scope:"synthetic-only";runId:string;kind:"demo-report"}>;
export type DemoResult=Readonly<{scope:"synthetic-only";records:number;total:number}>;
const deny=()=>{throw Error("P4_LOCAL_WORKER_DENIED");};
export function localWorkerConfig(env:Env){
 if(env.P4_LOCAL_WORKER_ENABLED!=="true"||env.NODE_ENV==="production"||
    env.VERCEL!==undefined||env.VERCEL_ENV!==undefined||
    env.P4_STAGE_OWNER_ACTIVATION==="approved"||
    env.P4_LOCAL_REDIS_URL!=="redis://127.0.0.1:6380")return deny();
 return Object.freeze({host:"127.0.0.1",port:6380,db:0,connectTimeout:1000,
  retryStrategy:(attempt:number)=>attempt<=2?100:null});
}
export function processDemoJob(name:unknown,id:unknown,data:unknown,expectedRun:string):DemoResult{
 if(!isCanonicalUuidV4(expectedRun)||name!=="demo-report"||id!==expectedRun||
    !data||typeof data!=="object"||Array.isArray(data)||
    Object.keys(data).sort().join(",")!=="kind,runId,scope")return deny();
 const x=data as Record<string,unknown>;
 if(x.scope!=="synthetic-only"||x.kind!=="demo-report"||x.runId!==expectedRun)return deny();
 // Fixed fictional fixture, not caller-supplied report contents.
 const amounts=[10,20,30];
 return Object.freeze({scope:"synthetic-only",records:amounts.length,total:amounts.reduce((a,b)=>a+b,0)});
}
async function within<T>(work:Promise<T>,ms:number):Promise<T>{
 const controller=new AbortController();
 try{
  return await Promise.race([work,delay(ms,undefined,{signal:controller.signal}).then(()=>{throw Error("P4_LOCAL_WORKER_TIMEOUT");})]);
 }finally{controller.abort();}
}
/** A bounded real queue/worker session; a unique namespace avoids other Redis workloads.
 * No database, external I/O, customer payloads, recurring polling, or production job handler.
 */
export async function runLocalWorker(env:Env=process.env):Promise<DemoResult>{
 const connection=localWorkerConfig(env);
 const runId=randomUUID(),prefix="zoho-clone-local-"+runId,queueName="synthetic-report";
 const queue=new Queue<DemoJob,DemoResult,"demo-report">(queueName,{prefix,connection:{...connection,maxRetriesPerRequest:1}});
 let worker:Worker<DemoJob,DemoResult,"demo-report">|undefined;
 let failed=false,ready=false;
 let stage="QUEUE_READY";
 queue.on("error",()=>{failed=true;});
 try{
  await within(queue.waitUntilReady(),3000);
  ready=true;
  stage="WORKER_READY";
  worker=new Worker<DemoJob,DemoResult,"demo-report">(queueName,async job=>{
   localWorkerConfig(env);
   return processDemoJob(job.name,job.id,job.data,runId);
  },{prefix,connection:{...connection,maxRetriesPerRequest:null},concurrency:1,maxStalledCount:0});
  worker.on("error",()=>{failed=true;});
  await within(worker.waitUntilReady(),3000);
  stage="ENQUEUE";
  const data:DemoJob={scope:"synthetic-only",runId,kind:"demo-report"};
  const job=await within(queue.add("demo-report",data,{jobId:runId,attempts:1}),2000);
  const duplicate=await within(queue.add("demo-report",data,{jobId:runId,attempts:1}),2000);
  if(job.id!==runId||duplicate.id!==runId)return deny();
  stage="COMPLETION";
  const deadline=Date.now()+5000;
  while(Date.now()<deadline&&!failed){
   const saved=await within(queue.getJob(runId),1000);
   if(saved){
    const state=await within(saved.getState(),1000);
    if(state==="failed")return deny();
    if(state==="completed"){
     // State can transition after getJob() loaded the earlier snapshot.
     // Read the stored result only after observing the terminal state.
     const completed=await within(queue.getJob(runId),1000);
     const result=completed?.returnvalue;
     if(!result||result.scope!=="synthetic-only"||result.records!==3||result.total!==60||
        await within(queue.getCompletedCount(),1000)!==1)return deny();
     return Object.freeze({scope:"synthetic-only",records:3,total:60});
    }
   }
   await delay(50);
  }
  return deny();
 }catch{
  throw Error("P4_LOCAL_WORKER_"+stage+"_FAILED");
 }finally{
  try{
   if(worker)await within(worker.close(),3000);
   // Delete only this random, private queue after worker shutdown. Never flush Redis.
   if(ready)await within(queue.obliterate(),3000);
  }catch{throw Error("P4_LOCAL_WORKER_CLEANUP_FAILED");}
  finally{try{await within(queue.close(),3000);}catch{throw Error("P4_LOCAL_WORKER_CLOSE_FAILED");}}
 }
}
