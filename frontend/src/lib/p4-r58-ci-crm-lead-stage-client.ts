/** R58 typed signed localhost CRM lead stage and immutable history client. */
import {parseP4R57Lead,type P4R57Lead}
 from "./p4-r57-ci-crm-lead-client";
export type P4R58Status="CONTACTED"|"QUALIFIED"|"LOST";
export type P4R58LeadHistory=Readonly<{
 eventId:string;eventKind:"CREATED"|"STATUS_CHANGED";
 beforeStatus:"NEW"|"CONTACTED"|null;
 afterStatus:"NEW"|"CONTACTED"|"QUALIFIED"|"LOST";
 revision:number;actorUserId:string;occurredAt:string;
}>;
export class P4R58CiLeadStageError extends Error{
 constructor(public readonly status:number,public readonly code:
  "INVALID_INPUT"|"IDENTITY_REQUIRED"|"ACCESS_DENIED"|"CONFLICT"|
  "UNAVAILABLE"|"INVALID_RESPONSE"){super(code);}
}
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const USER=/^user_demo_[a-z]{2,16}$/;
const ISO=/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/;
const ERRORS:Readonly<Record<number,P4R58CiLeadStageError["code"]>>={
 400:"INVALID_INPUT",401:"IDENTITY_REQUIRED",403:"ACCESS_DENIED",
 409:"CONFLICT",503:"UNAVAILABLE",
};
const deny=(status:number,code:P4R58CiLeadStageError["code"]):never=>{
 throw new P4R58CiLeadStageError(status,code);
};
export function parseP4R58LeadHistory(input:unknown):
 readonly P4R58LeadHistory[]|null{
 if(!Array.isArray(input)||input.length>20)return null;
 const out:P4R58LeadHistory[]=[];
 for(const row of input){
  if(!row||typeof row!=="object"||Array.isArray(row))return null;
  const v=row as Record<string,unknown>;
  if(Object.keys(v).sort().join(",")!==
   "actorUserId,afterStatus,beforeStatus,eventId,eventKind,occurredAt,revision"||
   typeof v.eventId!=="string"||!UUID.test(v.eventId)||
   typeof v.actorUserId!=="string"||!USER.test(v.actorUserId)||
   !Number.isSafeInteger(v.revision)||(v.revision as number)!==out.length||
   typeof v.occurredAt!=="string"||!ISO.test(v.occurredAt)||
   !Number.isFinite(Date.parse(v.occurredAt))||
   new Date(v.occurredAt).toISOString()!==v.occurredAt||
   (v.eventKind!=="CREATED"&&v.eventKind!=="STATUS_CHANGED"))
   return null;
  if(v.eventKind==="CREATED"){
   if(v.revision!==0||v.beforeStatus!==null||v.afterStatus!=="NEW")
    return null;
  }else{
   const prior=out.at(-1);
   if(!prior||v.beforeStatus!==prior.afterStatus||
    !((v.beforeStatus==="NEW"&&v.afterStatus==="CONTACTED")||
     (v.beforeStatus==="CONTACTED"&&
      (v.afterStatus==="QUALIFIED"||v.afterStatus==="LOST"))))
    return null;
  }
  out.push(Object.freeze(v) as P4R58LeadHistory);
 }
 if(new Set(out.map(x=>x.eventId)).size!==out.length)return null;
 return Object.freeze(out);
}
export class P4R58CiLeadStageClient{
 constructor(private readonly baseUrl:string,
  private readonly token:()=>Promise<string>,
  private readonly transport:typeof fetch=fetch,
  private readonly env:NodeJS.ProcessEnv=process.env){
  this.guard();
  if(typeof token!=="function"||typeof transport!=="function")
   deny(503,"UNAVAILABLE");
 }
 private guard():void{
  if(this.env.CI!=="true"||this.env.GITHUB_ACTIONS!=="true"||
   this.env.NODE_ENV==="production")deny(503,"UNAVAILABLE");
  let u:URL;
  try{u=new URL(this.baseUrl);}catch{return deny(503,"UNAVAILABLE");}
  if(u.protocol!=="http:"||u.hostname!=="127.0.0.1"||
   !u.port||u.pathname!=="/"||u.search||u.hash||
   u.username||u.password)deny(503,"UNAVAILABLE");
 }
 private async call(org:string,lead:string,method:"GET"|"PATCH",
  input?:unknown):Promise<unknown>{
  if(!UUID.test(org)||!UUID.test(lead))return deny(400,"INVALID_INPUT");
  this.guard();
  let jwt:string;
  try{jwt=await this.token();}catch{return deny(401,"IDENTITY_REQUIRED");}
  if(typeof jwt!=="string"||jwt.length>10000||
   !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(jwt))
   return deny(401,"IDENTITY_REQUIRED");
  let response:Response;
  try{
   const path="/_p4_r33_ci/owner/"+org+"/leads/"+lead+
    (method==="GET"?"/history":"/status");
   response=await this.transport(new URL(path,this.baseUrl),{
    method,headers:{"Authorization":"Bearer "+jwt,"Accept":"application/json",
     ...(method==="PATCH"?{"Content-Type":"application/json"}:{})},
    ...(method==="PATCH"?{body:JSON.stringify(input)}:{}),
    credentials:"omit",redirect:"error",cache:"no-store",
    signal:AbortSignal.timeout(3000),
   });
  }catch{return deny(503,"UNAVAILABLE");}
  if(response.headers.get("cache-control")!=="no-store, private"||
   response.headers.get("x-content-type-options")!=="nosniff")
   return deny(503,"INVALID_RESPONSE");
  let body:unknown;
  try{body=await response.json();}catch{return deny(503,"INVALID_RESPONSE");}
  if(!response.ok){
   if(!body||typeof body!=="object"||Array.isArray(body)||
    Object.keys(body).join(",")!=="error")
    return deny(503,"INVALID_RESPONSE");
   const e=(body as {error?:unknown}).error;
   if(!e||typeof e!=="object"||Array.isArray(e)||
    Object.keys(e).join(",")!=="code"||
    !ERRORS[response.status]||
    (e as {code?:unknown}).code!==ERRORS[response.status])
    return deny(503,"INVALID_RESPONSE");
   return deny(response.status,ERRORS[response.status]!);
  }
  if(response.status!==200||!body||typeof body!=="object"||
   Array.isArray(body)||Object.keys(body).sort().join(",")!=="data,scope")
   return deny(503,"INVALID_RESPONSE");
  const envelope=body as Record<string,unknown>;
  if(envelope.scope!=="disposable-ci-only")return deny(503,"INVALID_RESPONSE");
  return envelope.data;
 }
 async change(org:string,leadId:string,status:P4R58Status,
  expectedRevision:number):Promise<P4R57Lead>{
  if(!["CONTACTED","QUALIFIED","LOST"].includes(status)||
   !Number.isSafeInteger(expectedRevision)||expectedRevision<0||
   expectedRevision>=1000000)return deny(400,"INVALID_INPUT");
  const item=parseP4R57Lead(await this.call(org,leadId,"PATCH",{
   status,expectedRevision,
  }));
  if(!item||item.leadId!==leadId||item.status!==status||
   item.revision!==expectedRevision+1)
   return deny(503,"INVALID_RESPONSE");
  return item;
 }
 async history(org:string,leadId:string):Promise<readonly P4R58LeadHistory[]>{
  const result=parseP4R58LeadHistory(await this.call(org,leadId,"GET"));
  if(result===null)return deny(503,"INVALID_RESPONSE");
  return result;
 }
}
