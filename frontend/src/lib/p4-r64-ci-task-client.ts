/** R64 typed signed localhost CRM follow-up task HTTP client. */
export type P4R64Task=Readonly<{
 taskId:string;leadId:string;title:string;dueDate:string;
 status:"OPEN"|"DONE";revision:number;createdBy:string;updatedBy:string|null;
 createdAt:string;completedAt:string|null;
}>;
export type P4R64NewTask=Readonly<{title:string;dueDate:string}>;
export class P4R64CiTaskError extends Error{
 constructor(public readonly status:number,public readonly code:
  "INVALID_INPUT"|"IDENTITY_REQUIRED"|"ACCESS_DENIED"|"CONFLICT"|
  "UNAVAILABLE"|"INVALID_RESPONSE"){super(code);}
}
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const USER=/^user_demo_[a-z]{2,16}$/;
const TITLE=/^Demo [A-Za-z0-9 ,.!?-]{8,70}$/;
const ISO=/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/;
const validDate=(s:unknown):s is string=>typeof s==="string"&&
 /^\d{4}-\d\d-\d\d$/.test(s)&&s>="2026-01-01"&&s<="2032-12-31"&&
 Number.isFinite(Date.parse(s+"T00:00:00.000Z"))&&
 new Date(s+"T00:00:00.000Z").toISOString().slice(0,10)===s;
const ERRORS:Readonly<Record<number,P4R64CiTaskError["code"]>>={
 400:"INVALID_INPUT",401:"IDENTITY_REQUIRED",403:"ACCESS_DENIED",
 409:"CONFLICT",503:"UNAVAILABLE",
};
const fail=(status:number,code:P4R64CiTaskError["code"]):never=>{
 throw new P4R64CiTaskError(status,code);
};
export function parseP4R64Task(v:unknown):P4R64Task|null{
 if(!v||typeof v!=="object"||Array.isArray(v))return null;
 const x=v as Record<string,unknown>;
 if(Object.keys(x).sort().join(",")!==
  "completedAt,createdAt,createdBy,dueDate,leadId,revision,status,taskId,title,updatedBy"||
  typeof x.taskId!=="string"||!UUID.test(x.taskId)||
  typeof x.leadId!=="string"||!UUID.test(x.leadId)||
  typeof x.title!=="string"||!TITLE.test(x.title)||
  !validDate(x.dueDate)||
  (x.status!=="OPEN"&&x.status!=="DONE")||
  x.revision!==(x.status==="OPEN"?0:1)||
  typeof x.createdBy!=="string"||!USER.test(x.createdBy)||
  (x.status==="OPEN"?x.updatedBy!==null:
   typeof x.updatedBy!=="string"||!USER.test(x.updatedBy))||
  typeof x.createdAt!=="string"||!ISO.test(x.createdAt)||
  !Number.isFinite(Date.parse(x.createdAt))||
  new Date(x.createdAt).toISOString()!==x.createdAt||
  (x.status==="OPEN"?x.completedAt!==null:
   typeof x.completedAt!=="string"||!ISO.test(x.completedAt)||
   !Number.isFinite(Date.parse(x.completedAt))||
   new Date(x.completedAt).toISOString()!==x.completedAt||
   x.completedAt<x.createdAt))
  return null;
 return Object.freeze({...x}) as P4R64Task;
}
export function parseP4R64Tasks(v:unknown):readonly P4R64Task[]|null{
 if(!Array.isArray(v)||v.length>20)return null;
 const items=v.map(parseP4R64Task);
 if(items.some(x=>x===null))return null;
 const out=items as P4R64Task[];
 if(new Set(out.map(x=>x.taskId)).size!==out.length||
  out.some((x,i)=>i>0&&x.createdAt>out[i-1]!.createdAt))
  return null;
 return Object.freeze(out);
}
export class P4R64CiTaskClient{
 constructor(private readonly base:string,
  private readonly token:()=>Promise<string>,private readonly transport:typeof fetch=fetch,
  private readonly env:NodeJS.ProcessEnv=process.env){this.guard();}
 private guard(){
  if(this.env.CI!=="true"||this.env.GITHUB_ACTIONS!=="true"||
   this.env.NODE_ENV==="production")fail(503,"UNAVAILABLE");
  let u:URL;
  try{u=new URL(this.base);}catch{return fail(503,"UNAVAILABLE");}
  if(u.protocol!=="http:"||u.hostname!=="127.0.0.1"||!u.port||
   u.pathname!=="/"||u.search||u.hash||u.username||u.password)
   fail(503,"UNAVAILABLE");
 }
 private async call(org:string,lead:string,method:"GET"|"POST"|"PATCH",
  task:string|null,input?:unknown):Promise<unknown>{
  if(!UUID.test(org)||!UUID.test(lead)||
   (method==="PATCH"&&(task===null||!UUID.test(task))))
   return fail(400,"INVALID_INPUT");
  this.guard();
  let jwt:string;
  try{jwt=await this.token();}catch{return fail(401,"IDENTITY_REQUIRED");}
  if(typeof jwt!=="string"||jwt.length>10000||
   !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(jwt))
   return fail(401,"IDENTITY_REQUIRED");
  let res:Response;
  try{
   const path="/_p4_r33_ci/owner/"+org+"/leads/"+lead+"/tasks"+
    (method==="PATCH"?"/"+task+"/complete":"");
   res=await this.transport(new URL(path,this.base),{
    method,headers:{"Authorization":"Bearer "+jwt,"Accept":"application/json",
     ...(method==="GET"?{}:{"Content-Type":"application/json"})},
    ...(method==="GET"?{}:{body:JSON.stringify(input)}),
    credentials:"omit",redirect:"error",cache:"no-store",
    signal:AbortSignal.timeout(3000),
   });
  }catch{return fail(503,"UNAVAILABLE");}
  if(res.headers.get("cache-control")!=="no-store, private"||
   res.headers.get("x-content-type-options")!=="nosniff")
   return fail(503,"INVALID_RESPONSE");
  let body:unknown;
  try{body=await res.json();}catch{return fail(503,"INVALID_RESPONSE");}
  if(!res.ok){
   if(!body||typeof body!=="object"||Array.isArray(body)||
    Object.keys(body).join(",")!=="error")return fail(503,"INVALID_RESPONSE");
   const e=(body as {error?:unknown}).error;
   if(!e||typeof e!=="object"||Array.isArray(e)||
    Object.keys(e).join(",")!=="code"||
    !ERRORS[res.status]||
    (e as {code?:unknown}).code!==ERRORS[res.status])
    return fail(503,"INVALID_RESPONSE");
   return fail(res.status,ERRORS[res.status]!);
  }
  if(res.status!==200||!body||typeof body!=="object"||
   Array.isArray(body)||Object.keys(body).sort().join(",")!=="data,scope")
   return fail(503,"INVALID_RESPONSE");
  const envelope=body as Record<string,unknown>;
  if(envelope.scope!=="disposable-ci-only")return fail(503,"INVALID_RESPONSE");
  return envelope.data;
 }
 async list(org:string,lead:string):Promise<readonly P4R64Task[]>{
  const value=parseP4R64Tasks(await this.call(org,lead,"GET",null));
  if(value===null||value.some(x=>x.leadId!==lead))
   return fail(503,"INVALID_RESPONSE");
  return value;
 }
 async create(org:string,lead:string,input:P4R64NewTask):Promise<P4R64Task>{
  if(!input||typeof input!=="object"||Array.isArray(input)||
   Object.keys(input).sort().join(",")!=="dueDate,title"||
   typeof input.title!=="string"||!TITLE.test(input.title)||
   !validDate(input.dueDate))
   return fail(400,"INVALID_INPUT");
  const v=parseP4R64Task(await this.call(org,lead,"POST",null,input));
  if(!v||v.leadId!==lead||v.title!==input.title||
   v.dueDate!==input.dueDate||v.status!=="OPEN"||v.revision!==0)
   return fail(503,"INVALID_RESPONSE");
  return v;
 }
 async complete(org:string,lead:string,task:string,
  expectedRevision:number):Promise<P4R64Task>{
  if(expectedRevision!==0)return fail(400,"INVALID_INPUT");
  const v=parseP4R64Task(await this.call(org,lead,"PATCH",task,{
   expectedRevision,
  }));
  if(!v||v.taskId!==task||v.leadId!==lead||
   v.status!=="DONE"||v.revision!==1)
   return fail(503,"INVALID_RESPONSE");
  return v;
 }
}
