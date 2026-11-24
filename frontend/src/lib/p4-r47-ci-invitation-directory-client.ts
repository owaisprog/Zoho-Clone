/**
 * R47 signed owner invitation directory typed GET over disposable localhost.
 * No browser production mounting, no real Auth0 or customer invitation data.
 */
import {parseSafeInvitationDraft,type SafeInvitationDraft}
 from "./p4-invitation-api-contract";
export type P4R47CiInviteFilter=
 "all"|"pending"|"accepted"|"revoked"|"expired";
export class P4R47CiInvitationError extends Error{
 constructor(public readonly status:number,public readonly code:
  "INVALID_INPUT"|"IDENTITY_REQUIRED"|"ACCESS_DENIED"|"CONFLICT"|
  "UNAVAILABLE"|"INVALID_RESPONSE"){
  super(code);
 }
}
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const CODE:Readonly<Record<number,P4R47CiInvitationError["code"]>>={
 400:"INVALID_INPUT",401:"IDENTITY_REQUIRED",403:"ACCESS_DENIED",
 409:"CONFLICT",503:"UNAVAILABLE",
};
const deny=(status:number,code:P4R47CiInvitationError["code"]):never=>{
 throw new P4R47CiInvitationError(status,code);
};
export class P4R47CiInvitationDirectoryClient{
 constructor(private readonly baseUrl:string,
  private readonly token:()=>Promise<string>,
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
 async list(orgId:string,filter:P4R47CiInviteFilter,search:string=""):
  Promise<readonly SafeInvitationDraft[]>{
  if(!UUID.test(orgId)||
   !["all","pending","accepted","revoked","expired"].includes(filter)||
   typeof search!=="string"||search.length>40||
   !/^[a-zA-Z0-9._@-]*$/.test(search))
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
   const path="/_p4_r33_ci/owner/"+orgId+
    "/invitations?status="+filter+"&q="+encodeURIComponent(q);
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
  let json:unknown;
  try{json=await response.json();}catch{return deny(503,"INVALID_RESPONSE");}
  if(!response.ok){
   if(!json||typeof json!=="object"||Array.isArray(json)||
    Object.keys(json).join(",")!=="error")
    return deny(503,"INVALID_RESPONSE");
   const error=(json as {error?:unknown}).error;
   if(!error||typeof error!=="object"||Array.isArray(error)||
    Object.keys(error).join(",")!=="code"||
    !CODE[response.status]||
    (error as {code?:unknown}).code!==CODE[response.status])
    return deny(503,"INVALID_RESPONSE");
   return deny(response.status,CODE[response.status]!);
  }
  if(response.status!==200||!json||typeof json!=="object"||
   Array.isArray(json))return deny(503,"INVALID_RESPONSE");
  const envelope=json as Record<string,unknown>;
  if(Object.keys(envelope).sort().join(",")!=="data,scope"||
   envelope.scope!=="disposable-ci-only"||
   !Array.isArray(envelope.data)||envelope.data.length>20)
   return deny(503,"INVALID_RESPONSE");
  const values=envelope.data.map(parseSafeInvitationDraft);
  if(values.some(x=>x===null))return deny(503,"INVALID_RESPONSE");
  const results=values as SafeInvitationDraft[];
  if(new Set(results.map(x=>x.id)).size!==results.length||
   results.some(x=>x.organizationId!==orgId||
    (filter!=="all"&&x.status!==filter)||
    (q!==""&&!x.recipientEmail.includes(q))))
   return deny(503,"INVALID_RESPONSE");
  return Object.freeze(results);
 }
}
