/** R63 strict localhost signed CRM note page client. */
import {parseP4R61LeadNote,type P4R61LeadNote}
 from "./p4-r61-ci-lead-notes-client";
export type P4R63NotePage=Readonly<{items:readonly P4R61LeadNote[];
 nextCursor:string|null}>;
export class P4R63CiPageError extends Error{
 constructor(public readonly status:number,public readonly code:
  "INVALID_INPUT"|"IDENTITY_REQUIRED"|"ACCESS_DENIED"|"CONFLICT"|
  "UNAVAILABLE"|"INVALID_RESPONSE"){super(code);}
}
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ERRORS:Readonly<Record<number,P4R63CiPageError["code"]>>={
 400:"INVALID_INPUT",401:"IDENTITY_REQUIRED",403:"ACCESS_DENIED",
 409:"CONFLICT",503:"UNAVAILABLE",
};
const fail=(status:number,code:P4R63CiPageError["code"]):never=>{
 throw new P4R63CiPageError(status,code);
};
export class P4R63CiNotePageClient{
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
 async page(org:string,lead:string,cursor:string|null=null):Promise<P4R63NotePage>{
  this.guard();
  if(!UUID.test(org)||!UUID.test(lead)||
   (cursor!==null&&(cursor.length>1024||
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
    "/_p4_r33_ci/owner/"+org+"/leads/"+lead+
    "/notes/page?cursor="+encodeURIComponent(cursor??""),this.base),{
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
  const env=body as Record<string,unknown>;
  if(env.scope!=="disposable-ci-only"||!env.data||
   typeof env.data!=="object"||Array.isArray(env.data)||
   Object.keys(env.data).sort().join(",")!=="items,nextCursor")
   return fail(503,"INVALID_RESPONSE");
  const data=env.data as {items?:unknown;nextCursor?:unknown};
  if(!Array.isArray(data.items)||data.items.length>20||
   (data.nextCursor!==null&&(typeof data.nextCursor!=="string"||
    data.nextCursor.length>1024||
    !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(data.nextCursor))))
   return fail(503,"INVALID_RESPONSE");
  const rows=data.items.map(parseP4R61LeadNote);
  if(rows.some(r=>r===null))return fail(503,"INVALID_RESPONSE");
  const items=rows as P4R61LeadNote[];
  if(new Set(items.map(r=>r.noteId)).size!==items.length||
   items.some((r,i)=>r.leadId!==lead||
    (i>0&&r.createdAt>items[i-1]!.createdAt))||
   (data.nextCursor!==null&&items.length!==20))
   return fail(503,"INVALID_RESPONSE");
  return Object.freeze({items:Object.freeze(items),nextCursor:data.nextCursor});
 }
}
