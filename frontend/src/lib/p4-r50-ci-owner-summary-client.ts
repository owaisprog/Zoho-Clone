/** R50 aggregate-only signed CI owner dashboard HTTP boundary. */
export type P4R50OwnerCounts=Readonly<{
 activeMembers:number;revokedMembers:number;salesManagers:number;
 pendingInvites:number;acceptedInvites:number;revokedInvites:number;
 expiredInvites:number;roleChanges:number;membershipEvents:number;
 renewals:number;cancellations:number;
}>;
const FIELDS=[
 "activeMembers","revokedMembers","salesManagers",
 "pendingInvites","acceptedInvites","revokedInvites","expiredInvites",
 "roleChanges","membershipEvents","renewals","cancellations",
] as const;
export function parseP4R50OwnerCounts(input:unknown):P4R50OwnerCounts|null{
 if(!input||typeof input!=="object"||Array.isArray(input))return null;
 const v=input as Record<string,unknown>;
 if(Object.keys(v).sort().join(",")!==[...FIELDS].sort().join(","))
  return null;
 for(const key of FIELDS){
  if(!Number.isSafeInteger(v[key])||(v[key] as number)<0||
   (v[key] as number)>1000000)return null;
 }
 if((v.salesManagers as number)>(v.activeMembers as number))return null;
 return Object.freeze(v) as P4R50OwnerCounts;
}
export class P4R50CiOwnerSummaryError extends Error{
 constructor(public readonly status:number,public readonly code:
  "INVALID_INPUT"|"IDENTITY_REQUIRED"|"ACCESS_DENIED"|"CONFLICT"|
  "UNAVAILABLE"|"INVALID_RESPONSE"){super(code);}
}
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const CODES:Readonly<Record<number,P4R50CiOwnerSummaryError["code"]>>={
 400:"INVALID_INPUT",401:"IDENTITY_REQUIRED",403:"ACCESS_DENIED",
 409:"CONFLICT",503:"UNAVAILABLE",
};
const deny=(status:number,code:P4R50CiOwnerSummaryError["code"]):never=>{
 throw new P4R50CiOwnerSummaryError(status,code);
};
export class P4R50CiOwnerSummaryClient{
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
 async summary(org:string):Promise<P4R50OwnerCounts>{
  if(!UUID.test(org))return deny(400,"INVALID_INPUT");
  this.guard();
  let jwt:string;
  try{jwt=await this.token();}catch{return deny(401,"IDENTITY_REQUIRED");}
  if(typeof jwt!=="string"||jwt.length>10000||
   !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(jwt))
   return deny(401,"IDENTITY_REQUIRED");
  let response:Response;
  try{
   response=await this.transport(new URL(
    "/_p4_r33_ci/owner/"+org+"/operations-summary",this.baseUrl),{
    method:"GET",headers:{"Authorization":"Bearer "+jwt,
     "Accept":"application/json"},credentials:"omit",redirect:"error",
    cache:"no-store",signal:AbortSignal.timeout(3000),
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
    !CODES[response.status]||
    (e as {code?:unknown}).code!==CODES[response.status])
    return deny(503,"INVALID_RESPONSE");
   return deny(response.status,CODES[response.status]!);
  }
  if(response.status!==200||!json||typeof json!=="object"||
   Array.isArray(json)||Object.keys(json).sort().join(",")!=="data,scope")
   return deny(503,"INVALID_RESPONSE");
  const env=json as Record<string,unknown>;
  if(env.scope!=="disposable-ci-only")return deny(503,"INVALID_RESPONSE");
  const counts=parseP4R50OwnerCounts(env.data);
  if(counts===null)return deny(503,"INVALID_RESPONSE");
  return counts;
 }
}
