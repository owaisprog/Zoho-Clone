/** Explicit, one-shot synthetic monitoring; no SDK auto-capture or production import. */
import {randomUUID} from "node:crypto";
type Env=Readonly<Record<string,string|undefined>>;
type Fetch=typeof fetch;
type HealthCode="LOCAL_API_UNAVAILABLE"|"LOCAL_READINESS_UNEXPECTED"|"LOCAL_MONITOR_TEST";
const codes=new Set<string>(["LOCAL_API_UNAVAILABLE","LOCAL_READINESS_UNEXPECTED","LOCAL_MONITOR_TEST"]);
const deny=()=>{throw Error("P4_LOCAL_MONITOR_DENIED");};
export function requireLocalMonitoring(env:Env){
 if(env.P4_LOCAL_MONITOR_ENABLED!=="true"||env.NODE_ENV==="production"||
    env.VERCEL!==undefined||env.VERCEL_ENV!==undefined||
    env.P4_STAGE_OWNER_ACTIVATION==="approved")return deny();
}
export function readSentryTarget(env:Env){
 requireLocalMonitoring(env);
 if(env.P4_LOCAL_SENTRY_SEND!=="true")return null;
 // CI never sends; a separate explicit owner activation is required for external transfer.
 if(env.CI!==undefined||env.GITHUB_ACTIONS!==undefined||
    env.P4_LOCAL_SENTRY_OWNER_APPROVAL!=="approved"||
    env.P4_LOCAL_SENTRY_PLAN!=="developer-free")return deny();
 try{
  const dsn=env.P4_LOCAL_SENTRY_DSN??"",url=new URL(dsn);
  if(url.protocol!=="https:"||url.port||url.password||url.search||url.hash||
    !/^o[0-9]+\.ingest(?:\.(?:us|de))?\.sentry\.io$/.test(url.hostname)||
    url.hostname!==env.P4_LOCAL_SENTRY_HOST||!/^[a-f0-9]{32}$/.test(url.username)||
    !/^\/[0-9]+$/.test(url.pathname)||url.pathname.slice(1)!==env.P4_LOCAL_SENTRY_PROJECT)return deny();
  return Object.freeze({dsn,endpoint:url.origin+"/api"+url.pathname+"/envelope/"});
 }catch{return deny();}
}
export function makeSyntheticEnvelope(dsn:string,code:HealthCode){
 if(!codes.has(code))return deny();
 const id=randomUUID().replace(/-/g,""),now=new Date().toISOString();
 const event={event_id:id,timestamp:now,platform:"node",level:"error",environment:"local-synthetic",
  logger:"zoho-clone.synthetic-monitor",message:code,fingerprint:["zoho-local",code],
  tags:{scope:"synthetic-only",component:"api-monitor"}};
 const payload=JSON.stringify(event);
 return JSON.stringify({event_id:id,dsn,sent_at:now})+"\n"+
  JSON.stringify({type:"event",length:Buffer.byteLength(payload)})+"\n"+payload+"\n";
}
export function createLocalMonitor(env:Env,request:Fetch=fetch){
 requireLocalMonitoring(env);
 const target=readSentryTarget(env);
 let attempted=false;
 async function send(code:HealthCode){
  requireLocalMonitoring(env);
  if(!codes.has(code))return deny();
  if(!target)return "disabled" as const;
  if(attempted)return "limited" as const;
  attempted=true; // one outbound request maximum per explicit process, even on error
  try{
   if(readSentryTarget(env)?.endpoint!==target.endpoint||readSentryTarget(env)?.dsn!==target.dsn)return "denied" as const;
   const res=await request(target.endpoint,{method:"POST",headers:{"Content-Type":"application/x-sentry-envelope"},
    body:makeSyntheticEnvelope(target.dsn,code),redirect:"error",signal:AbortSignal.timeout(5000)});
   await res.body?.cancel();
   return res.ok?"accepted" as const:"rejected" as const;
  }catch{return "unavailable" as const;}
 }
 async function probe(){
  requireLocalMonitoring(env);
  const checks=[{path:"/health/live",status:200,code:"LOCAL_API_UNAVAILABLE" as const},
   {path:"/health/ready",status:503,code:"LOCAL_READINESS_UNEXPECTED" as const}];
  for(const check of checks){
   let ok=false;
   try{
    const res=await request("http://127.0.0.1:4000"+check.path,{redirect:"error",cache:"no-store",signal:AbortSignal.timeout(2000)});
    const reader=res.body?.getReader();
    let bytes=0,parts:Uint8Array[]=[];
    if(reader){
     try{for(;;){const chunk=await reader.read();if(chunk.done)break;
      bytes+=chunk.value.byteLength;if(bytes>1024){await reader.cancel();break;}parts.push(chunk.value);
     }}finally{reader.releaseLock();}
    }
    if(bytes<=1024){
     const data:unknown=JSON.parse(Buffer.concat(parts).toString("utf8"));
     ok=res.status===check.status&&typeof data==="object"&&data!==null&&
      (data as Record<string,unknown>).scope==="synthetic-only"&&
      (data as Record<string,unknown>).status===(check.status===200?"alive":"not_ready");
    }
   }catch{/* fixed code only; never capture thrown error, body, request or stack */}
   if(!ok)return {status:"failed" as const,code:check.code,report:await send(check.code)};
  }
  return {status:"passed" as const,code:"LOCAL_SYNTHETIC_HEALTH_PASS" as const,report:"not-needed" as const};
 }
 return {probe,sendTest:()=>send("LOCAL_MONITOR_TEST")};
}
