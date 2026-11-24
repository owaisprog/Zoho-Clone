/** P4 R51 strict owner activity client, local synthetic CI only. */
export type P4R51Kind="role.changed"|"member.revoked"|
 "member.reactivated"|"invitation.renewed"|"invitation.canceled";
export type P4R51Filter="all"|P4R51Kind;
export type P4R51Event=Readonly<{
 eventId:string;kind:P4R51Kind;subjectId:string;
 actorUserId:string|null;occurredAt:string;
}>;
export class P4R51CiActivityError extends Error{
 constructor(public readonly status:number,public readonly code:
  "INVALID_INPUT"|"IDENTITY_REQUIRED"|"ACCESS_DENIED"|"CONFLICT"|
  "UNAVAILABLE"|"INVALID_RESPONSE"){super(code);}
}
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const USER=/^user_demo_[a-z]{2,16}$/;
const kinds=new Set<P4R51Filter>(["all","role.changed","member.revoked",
 "member.reactivated","invitation.renewed","invitation.canceled"]);
const errors:Readonly<Record<number,P4R51CiActivityError["code"]>>={
 400:"INVALID_INPUT",401:"IDENTITY_REQUIRED",403:"ACCESS_DENIED",
 409:"CONFLICT",503:"UNAVAILABLE",
};
const deny=(status:number,code:P4R51CiActivityError["code"]):never=>{
 throw new P4R51CiActivityError(status,code);
};
export function parseP4R51Activity(input:unknown):P4R51Event|null{
 if(!input||typeof input!=="object"||Array.isArray(input))return null;
 const row=input as Record<string,unknown>;
 if(Object.keys(row).sort().join(",")!==
  "actorUserId,eventId,kind,occurredAt,subjectId"||
  typeof row.eventId!=="string"||!UUID.test(row.eventId)||
  typeof row.kind!=="string"||row.kind==="all"||
  !kinds.has(row.kind as P4R51Filter)||
  typeof row.subjectId!=="string"||
  (row.kind.startsWith("member.")||row.kind==="role.changed"?
   !USER.test(row.subjectId):!UUID.test(row.subjectId))||
  (row.actorUserId!==null&&
   (typeof row.actorUserId!=="string"||!USER.test(row.actorUserId)))||
  typeof row.occurredAt!=="string"||
  !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(row.occurredAt)||
  !Number.isFinite(Date.parse(row.occurredAt))||
  new Date(row.occurredAt).toISOString()!==row.occurredAt||
  (row.kind==="member.reactivated"&&row.actorUserId!==null)||
  (row.kind!=="member.reactivated"&&row.actorUserId===null))
  return null;
 return Object.freeze(row) as P4R51Event;
}
export class P4R51CiOwnerActivityClient{
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
 async list(org:string,kind:P4R51Filter="all"):
  Promise<readonly P4R51Event[]>{
  if(!UUID.test(org)||!kinds.has(kind))
   return deny(400,"INVALID_INPUT");
  this.guard();
  let jwt:string;
  try{jwt=await this.token();}catch{return deny(401,"IDENTITY_REQUIRED");}
  if(typeof jwt!=="string"||jwt.length>10000||
   !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(jwt))
   return deny(401,"IDENTITY_REQUIRED");
  let response:Response;
  try{
   response=await this.transport(new URL(
    "/_p4_r33_ci/owner/"+org+"/activity?kind="+encodeURIComponent(kind),
    this.baseUrl),{
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
    Object.keys(e).join(",")!=="code"||
    !errors[response.status]||
    (e as {code?:unknown}).code!==errors[response.status])
    return deny(503,"INVALID_RESPONSE");
   return deny(response.status,errors[response.status]!);
  }
  if(response.status!==200||!json||typeof json!=="object"||
   Array.isArray(json)||Object.keys(json).sort().join(",")!=="data,scope")
   return deny(503,"INVALID_RESPONSE");
  const envelope=json as Record<string,unknown>;
  if(envelope.scope!=="disposable-ci-only"||
   !Array.isArray(envelope.data)||envelope.data.length>20)
   return deny(503,"INVALID_RESPONSE");
  const rows=envelope.data.map(parseP4R51Activity);
  if(rows.some(x=>x===null))return deny(503,"INVALID_RESPONSE");
  const items=rows as P4R51Event[];
  if(new Set(items.map(x=>x.eventId)).size!==items.length||
   items.some(x=>kind!=="all"&&x.kind!==kind)||
   items.some((x,i)=>i>0&&x.occurredAt>items[i-1]!.occurredAt))
   return deny(503,"INVALID_RESPONSE");
  return Object.freeze(items);
 }
}
