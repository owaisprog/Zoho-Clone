/** P4 R48 typed fictional owner cursor page; strictly loopback CI. */
import {parseSafeInvitationDraft,type SafeInvitationDraft}
 from "./p4-invitation-api-contract";
import type {P4R47CiInviteFilter} from "./p4-r47-ci-invitation-directory-client";
export type P4R48Page=Readonly<{items:readonly SafeInvitationDraft[];
 nextCursor:string|null}>;
export class P4R48CiPageError extends Error{
 constructor(public readonly status:number,public readonly code:
  "INVALID_INPUT"|"IDENTITY_REQUIRED"|"ACCESS_DENIED"|"CONFLICT"|
  "UNAVAILABLE"|"INVALID_RESPONSE"){super(code);}
}
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ERROR:Readonly<Record<number,P4R48CiPageError["code"]>>={
 400:"INVALID_INPUT",401:"IDENTITY_REQUIRED",403:"ACCESS_DENIED",
 409:"CONFLICT",503:"UNAVAILABLE",
};
const deny=(status:number,code:P4R48CiPageError["code"]):never=>{
 throw new P4R48CiPageError(status,code);
};
export class P4R48CiInvitationPageClient{
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
  let url:URL;
  try{url=new URL(this.baseUrl);}catch{return deny(503,"UNAVAILABLE");}
  if(url.protocol!=="http:"||url.hostname!=="127.0.0.1"||
   !url.port||url.pathname!=="/"||url.search||url.hash||
   url.username||url.password)deny(503,"UNAVAILABLE");
 }
 async page(org:string,status:P4R47CiInviteFilter,search:string,
  cursor:string|null=null):Promise<P4R48Page>{
  if(!UUID.test(org)||!["all","pending","accepted","revoked","expired"].includes(status)||
   typeof search!=="string"||search.length>40||
   !/^[a-zA-Z0-9._@-]*$/.test(search)||
   (cursor!==null&&(typeof cursor!=="string"||cursor.length>1024||
    !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(cursor))))
   return deny(400,"INVALID_INPUT");
  this.guard();
  let jwt:string;
  try{jwt=await this.token();}catch{return deny(401,"IDENTITY_REQUIRED");}
  if(typeof jwt!=="string"||jwt.length>10000||
   !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(jwt))
   return deny(401,"IDENTITY_REQUIRED");
  const q=search.toLowerCase();
  let response:Response;
  try{
   const path="/_p4_r33_ci/owner/"+org+
    "/invitations/page?status="+status+"&q="+encodeURIComponent(q)+
    "&cursor="+encodeURIComponent(cursor??"");
   response=await this.transport(new URL(path,this.baseUrl),{
    method:"GET",headers:{"Authorization":"Bearer "+jwt,
     "Accept":"application/json"},
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
    !ERROR[response.status]||(e as {code?:unknown}).code!==ERROR[response.status])
    return deny(503,"INVALID_RESPONSE");
   return deny(response.status,ERROR[response.status]!);
  }
  if(response.status!==200||!body||typeof body!=="object"||
   Array.isArray(body)||Object.keys(body).sort().join(",")!=="data,scope")
   return deny(503,"INVALID_RESPONSE");
  const env=body as Record<string,unknown>;
  if(env.scope!=="disposable-ci-only"||!env.data||
   typeof env.data!=="object"||Array.isArray(env.data)||
   Object.keys(env.data).sort().join(",")!=="items,nextCursor")
   return deny(503,"INVALID_RESPONSE");
  const data=env.data as {items?:unknown;nextCursor?:unknown};
  if(!Array.isArray(data.items)||data.items.length>20||
   (data.nextCursor!==null&&(typeof data.nextCursor!=="string"||
    data.nextCursor.length>1024||
    !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(data.nextCursor))))
   return deny(503,"INVALID_RESPONSE");
  const entries=data.items.map(parseSafeInvitationDraft);
  if(entries.some(x=>x===null))return deny(503,"INVALID_RESPONSE");
  const safe=entries as SafeInvitationDraft[];
  if(new Set(safe.map(x=>x.id)).size!==safe.length||
   safe.some(x=>x.organizationId!==org||(status!=="all"&&x.status!==status)||
    (q!==""&&!x.recipientEmail.includes(q)))||
   (data.nextCursor!==null&&safe.length!==20))
   return deny(503,"INVALID_RESPONSE");
  return Object.freeze({items:Object.freeze(safe),nextCursor:data.nextCursor});
 }
}
