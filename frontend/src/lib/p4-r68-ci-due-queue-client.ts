/** R68 strict signed localhost owner queue client, multi-lead due tasks. */
import {parseP4R64Task,type P4R64Task}
 from "./p4-r64-ci-task-client";
export type P4R68DueItem=Readonly<{task:P4R64Task;companyName:string}>;
export type P4R68DuePage=Readonly<{items:readonly P4R68DueItem[];
 nextCursor:string|null}>;
export class P4R68CiQueueError extends Error{
 constructor(public readonly status:number,public readonly code:
  "INVALID_INPUT"|"IDENTITY_REQUIRED"|"ACCESS_DENIED"|"CONFLICT"|
  "UNAVAILABLE"|"INVALID_RESPONSE"){super(code);}
}
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const COMPANY=/^Demo [A-Za-z][A-Za-z0-9 &.-]{2,48}$/;
const validDate=(v:unknown):v is string=>typeof v==="string"&&
 /^\d{4}-\d\d-\d\d$/.test(v)&&v>="2026-01-01"&&v<="2032-12-31"&&
 Number.isFinite(Date.parse(v+"T00:00:00.000Z"))&&
 new Date(v+"T00:00:00.000Z").toISOString().slice(0,10)===v;
const ERRORS:Readonly<Record<number,P4R68CiQueueError["code"]>>={
 400:"INVALID_INPUT",401:"IDENTITY_REQUIRED",403:"ACCESS_DENIED",
 409:"CONFLICT",503:"UNAVAILABLE",
};
const fail=(status:number,code:P4R68CiQueueError["code"]):never=>{
 throw new P4R68CiQueueError(status,code);
};
export class P4R68CiDueQueueClient{
 constructor(private readonly base:string,private readonly token:()=>Promise<string>,
  private readonly fetcher:typeof fetch=fetch,
  private readonly env:NodeJS.ProcessEnv=process.env){this.guard();}
 private guard():void{
  if(this.env.CI!=="true"||this.env.GITHUB_ACTIONS!=="true"||
   this.env.NODE_ENV==="production")return fail(503,"UNAVAILABLE");
  let u:URL;
  try{u=new URL(this.base);}catch{return fail(503,"UNAVAILABLE");}
  if(u.protocol!=="http:"||u.hostname!=="127.0.0.1"||!u.port||
   u.pathname!=="/"||u.search||u.hash||u.username||u.password)
   return fail(503,"UNAVAILABLE");
 }
 async page(org:string,through:string,cursor:string|null=null):
  Promise<P4R68DuePage>{
  this.guard();
  if(!UUID.test(org)||!validDate(through)||
   (cursor!==null&&(typeof cursor!=="string"||cursor.length>1024||
    !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(cursor))))
   return fail(400,"INVALID_INPUT");
  let jwt:string;
  try{jwt=await this.token();}catch{return fail(401,"IDENTITY_REQUIRED");}
  if(typeof jwt!=="string"||jwt.length>10000||
   !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(jwt))
   return fail(401,"IDENTITY_REQUIRED");
  let res:Response;
  try{
   res=await this.fetcher(new URL(
    "/_p4_r33_ci/owner/"+org+"/tasks/due?through="+through+
    "&cursor="+encodeURIComponent(cursor??""),this.base),{
    method:"GET",headers:{Authorization:"Bearer "+jwt,Accept:"application/json"},
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
   const error=(body as {error?:unknown}).error;
   if(!error||typeof error!=="object"||Array.isArray(error)||
    Object.keys(error).join(",")!=="code"||
    !ERRORS[res.status]||(error as {code?:unknown}).code!==ERRORS[res.status])
    return fail(503,"INVALID_RESPONSE");
   return fail(res.status,ERRORS[res.status]!);
  }
  if(res.status!==200||!body||typeof body!=="object"||
   Array.isArray(body)||Object.keys(body).sort().join(",")!=="data,scope")
   return fail(503,"INVALID_RESPONSE");
  const envelope=body as Record<string,unknown>;
  if(envelope.scope!=="disposable-ci-only"||!envelope.data||
   typeof envelope.data!=="object"||Array.isArray(envelope.data)||
   Object.keys(envelope.data).sort().join(",")!=="items,nextCursor")
   return fail(503,"INVALID_RESPONSE");
  const data=envelope.data as {items?:unknown;nextCursor?:unknown};
  if(!Array.isArray(data.items)||data.items.length>20||
   (data.nextCursor!==null&&(typeof data.nextCursor!=="string"||
    data.nextCursor.length>1024||
    !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(data.nextCursor))))
   return fail(503,"INVALID_RESPONSE");
  const items:P4R68DueItem[]=data.items.map((raw:unknown)=>{
   if(!raw||typeof raw!=="object"||Array.isArray(raw))
    return fail(503,"INVALID_RESPONSE");
   const x=raw as Record<string,unknown>;
   if(Object.keys(x).sort().join(",")!=="companyName,task"||
    typeof x.companyName!=="string"||!COMPANY.test(x.companyName))
    return fail(503,"INVALID_RESPONSE");
   const task=parseP4R64Task(x.task);
   if(!task||task.status!=="OPEN"||task.dueDate>through)
    return fail(503,"INVALID_RESPONSE");
   return Object.freeze({task,companyName:x.companyName});
  });
  if(new Set(items.map(x=>x.task.taskId)).size!==items.length||
   items.some((x,i)=>i>0&&(
    x.task.dueDate<items[i-1]!.task.dueDate||
    (x.task.dueDate===items[i-1]!.task.dueDate&&
     x.task.taskId<=items[i-1]!.task.taskId)))||
   (data.nextCursor!==null&&items.length!==20))
   return fail(503,"INVALID_RESPONSE");
  return Object.freeze({items:Object.freeze(items),nextCursor:data.nextCursor});
 }
}
