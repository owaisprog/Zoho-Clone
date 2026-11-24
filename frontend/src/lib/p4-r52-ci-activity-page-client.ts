/** R52 CI-only owner timeline pagination via signed loopback HTTP. */
import {parseP4R51Activity,type P4R51Event,type P4R51Filter}
 from "./p4-r51-ci-owner-activity-client";
export type P4R52ActivityPage=Readonly<{
 items:readonly P4R51Event[];nextCursor:string|null;
}>;
export class P4R52CiActivityPageError extends Error{
 constructor(public readonly status:number,public readonly code:
  "INVALID_INPUT"|"IDENTITY_REQUIRED"|"ACCESS_DENIED"|"CONFLICT"|
  "UNAVAILABLE"|"INVALID_RESPONSE"){super(code);}
}
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const KINDS=new Set<P4R51Filter>(["all","role.changed","member.revoked",
 "member.reactivated","invitation.renewed","invitation.canceled"]);
const ERRORS:Readonly<Record<number,P4R52CiActivityPageError["code"]>>={
 400:"INVALID_INPUT",401:"IDENTITY_REQUIRED",403:"ACCESS_DENIED",
 409:"CONFLICT",503:"UNAVAILABLE",
};
const deny=(status:number,code:P4R52CiActivityPageError["code"]):never=>{
 throw new P4R52CiActivityPageError(status,code);
};
export class P4R52CiActivityPageClient{
 constructor(private readonly baseUrl:string,private readonly token:()=>Promise<string>,
  private readonly transport:typeof fetch=fetch,
  private readonly env:NodeJS.ProcessEnv=process.env){
  this.guard();
  if(typeof token!=="function"||typeof transport!=="function")
   deny(503,"UNAVAILABLE");
 }
 private guard(){
  if(this.env.CI!=="true"||this.env.GITHUB_ACTIONS!=="true"||
   this.env.NODE_ENV==="production")deny(503,"UNAVAILABLE");
  let uri:URL;
  try{uri=new URL(this.baseUrl);}catch{return deny(503,"UNAVAILABLE");}
  if(uri.protocol!=="http:"||uri.hostname!=="127.0.0.1"||
   !uri.port||uri.pathname!=="/"||uri.search||uri.hash||
   uri.username||uri.password)deny(503,"UNAVAILABLE");
 }
 async page(org:string,kind:P4R51Filter="all",cursor:string|null=null):
  Promise<P4R52ActivityPage>{
  if(!UUID.test(org)||!KINDS.has(kind)||
   (cursor!==null&&(typeof cursor!=="string"||cursor.length>1024||
    !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(cursor))))
   return deny(400,"INVALID_INPUT");
  this.guard();
  let jwt:string;
  try{jwt=await this.token();}catch{return deny(401,"IDENTITY_REQUIRED");}
  if(typeof jwt!=="string"||jwt.length>10000||
   !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(jwt))
   return deny(401,"IDENTITY_REQUIRED");
  let response:Response;
  try{
   const path="/_p4_r33_ci/owner/"+org+"/activity/page?kind="+
    encodeURIComponent(kind)+"&cursor="+encodeURIComponent(cursor??"");
   response=await this.transport(new URL(path,this.baseUrl),{
    method:"GET",headers:{"Authorization":"Bearer "+jwt,"Accept":"application/json"},
    credentials:"omit",redirect:"error",cache:"no-store",
    signal:AbortSignal.timeout(3000),
   });
  }catch{return deny(503,"UNAVAILABLE");}
  if(response.headers.get("cache-control")!=="no-store, private"||
   response.headers.get("x-content-type-options")!=="nosniff")
   return deny(503,"INVALID_RESPONSE");
  let json:unknown;
  try{json=await response.json();}catch{return deny(503,"INVALID_RESPONSE");}
  if(!response.ok){
   if(!json||typeof json!=="object"||Array.isArray(json)||
    Object.keys(json).join(",")!=="error")
    return deny(503,"INVALID_RESPONSE");
   const e=(json as {error?:unknown}).error;
   if(!e||typeof e!=="object"||Array.isArray(e)||
    Object.keys(e).join(",")!=="code"||!ERRORS[response.status]||
    (e as {code?:unknown}).code!==ERRORS[response.status])
    return deny(503,"INVALID_RESPONSE");
   return deny(response.status,ERRORS[response.status]!);
  }
  if(response.status!==200||!json||typeof json!=="object"||
   Array.isArray(json)||Object.keys(json).sort().join(",")!=="data,scope")
   return deny(503,"INVALID_RESPONSE");
  const envelope=json as Record<string,unknown>;
  if(envelope.scope!=="disposable-ci-only"||!envelope.data||
   typeof envelope.data!=="object"||Array.isArray(envelope.data)||
   Object.keys(envelope.data).sort().join(",")!=="items,nextCursor")
   return deny(503,"INVALID_RESPONSE");
  const data=envelope.data as {items?:unknown;nextCursor?:unknown};
  if(!Array.isArray(data.items)||data.items.length>20||
   (data.nextCursor!==null&&(typeof data.nextCursor!=="string"||
    data.nextCursor.length>1024||
    !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(data.nextCursor))))
   return deny(503,"INVALID_RESPONSE");
  const parsed=data.items.map(parseP4R51Activity);
  if(parsed.some(x=>x===null))return deny(503,"INVALID_RESPONSE");
  const events=parsed as P4R51Event[];
  if(new Set(events.map(x=>x.eventId)).size!==events.length||
   events.some(x=>kind!=="all"&&x.kind!==kind)||
   events.some((x,i)=>i>0&&x.occurredAt>events[i-1]!.occurredAt)||
   (data.nextCursor!==null&&events.length!==20))
   return deny(503,"INVALID_RESPONSE");
  return Object.freeze({items:Object.freeze(events),nextCursor:data.nextCursor});
 }
}
