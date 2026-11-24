/**
 * P4 R34: REAL localhost HTTP client for CI integration only.
 * NO live Auth0, real email, staging or production API activation.
 * Credentials are passed by the injected test token provider and are never
 * logged, persisted or returned. Not imported by any normal Next.js page.
 */
import {parseSafeInvitationDraft,type SafeInvitationDraft}
 from "./p4-invitation-api-contract";
import {parseP4RecipientAcceptance,type P4RecipientAcceptance}
 from "./p4-invitation-acceptance-contract";
export type P4R34Actor="owner"|"recipient";
export type P4R34CiTokenProvider=(actor:P4R34Actor)=>Promise<string>;
export class P4R34CiClientError extends Error{
 constructor(public readonly status:number,public readonly code:
  "INVALID_INPUT"|"IDENTITY_REQUIRED"|"ACCESS_DENIED"|"CONFLICT"|"UNAVAILABLE"|"INVALID_RESPONSE"){
  super(code);
 }
}
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const EMAIL=/^[a-z0-9][a-z0-9._-]{0,60}@example\.com$/;
const TOKEN=/^[0-9a-f]{64}$/;
const ERRORS=new Set(["INVALID_INPUT","IDENTITY_REQUIRED",
 "ACCESS_DENIED","CONFLICT","UNAVAILABLE"]);
function guard(env:NodeJS.ProcessEnv,baseUrl:string){
 if(env.CI!=="true"||env.GITHUB_ACTIONS!=="true"||
  env.NODE_ENV==="production")throw new P4R34CiClientError(503,"UNAVAILABLE");
 let parsed:URL;
 try{parsed=new URL(baseUrl);}catch{throw new P4R34CiClientError(503,"UNAVAILABLE");}
 if(parsed.protocol!=="http:"||parsed.hostname!=="127.0.0.1"||
  !parsed.port||parsed.pathname!=="/"||parsed.search||
  parsed.hash||parsed.username||parsed.password)
  throw new P4R34CiClientError(503,"UNAVAILABLE");
}
const denied=(status:number,code:P4R34CiClientError["code"]):never=>{
 throw new P4R34CiClientError(status,code);
};
export class P4R34CiHttpClient{
 constructor(private readonly baseUrl:string,
  private readonly tokenProvider:P4R34CiTokenProvider,
  private readonly transport:typeof fetch=fetch,
  private readonly env:NodeJS.ProcessEnv=process.env){
  guard(env,baseUrl);
  if(typeof tokenProvider!=="function"||typeof transport!=="function")
   denied(503,"UNAVAILABLE");
 }
 private async post(path:string,actor:P4R34Actor,body:unknown):
  Promise<{status:number;json:unknown}>{
  guard(this.env,this.baseUrl);
  let jwt:string;
  try{jwt=await this.tokenProvider(actor);}
  catch{return denied(401,"IDENTITY_REQUIRED");}
  if(typeof jwt!=="string"||jwt.length>10000||
   !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(jwt))
   return denied(401,"IDENTITY_REQUIRED");
  try{
   const res=await this.transport(new URL(path,this.baseUrl),{
    method:"POST",
    headers:{"Authorization":"Bearer "+jwt,
     "Content-Type":"application/json","Accept":"application/json"},
    body:JSON.stringify(body),redirect:"error",cache:"no-store",
    credentials:"omit",signal:AbortSignal.timeout(3000),
   });
   if(res.headers.get("cache-control")!=="no-store, private"||
    res.headers.get("x-content-type-options")!=="nosniff")
    return denied(503,"INVALID_RESPONSE");
   let json:unknown;
   try{json=await res.json();}catch{return denied(503,"INVALID_RESPONSE");}
   if(!res.ok){
    if(!json||typeof json!=="object"||Array.isArray(json))
     return denied(503,"INVALID_RESPONSE");
    const error=(json as {error?:unknown}).error;
    if(!error||typeof error!=="object"||Array.isArray(error)||
     Object.keys(error).join(",")!=="code"||
     !ERRORS.has(String((error as {code?:unknown}).code)))
     return denied(503,"INVALID_RESPONSE");
    const code=(error as {code:P4R34CiClientError["code"]}).code;
    if(![400,401,403,409,503].includes(res.status))
     return denied(503,"INVALID_RESPONSE");
    return denied(res.status,code);
   }
   return {status:res.status,json};
  }catch(e){
   if(e instanceof P4R34CiClientError)throw e;
   return denied(503,"UNAVAILABLE");
  }
 }
 async issue(orgId:string,email:string):Promise<SafeInvitationDraft>{
  if(!UUID.test(orgId)||!EMAIL.test(email))
   return denied(400,"INVALID_INPUT");
  const res=await this.post(
   "/_p4_r33_ci/owner/"+orgId+"/issue","owner",{recipientEmail:email});
  if(res.status!==201||!res.json||typeof res.json!=="object"||
   Array.isArray(res.json))return denied(503,"INVALID_RESPONSE");
  const envelope=res.json as Record<string,unknown>;
  if(Object.keys(envelope).sort().join(",")!=="data,scope"||
   envelope.scope!=="disposable-ci-only")
   return denied(503,"INVALID_RESPONSE");
  const parsed=parseSafeInvitationDraft(envelope.data);
  if(!parsed||parsed.status!=="pending"||
   parsed.organizationId!==orgId||parsed.recipientEmail!==email)
   return denied(503,"INVALID_RESPONSE");
  return parsed;
 }
 async renew(orgId:string,invitationId:string,expectedVersion:number):
  Promise<SafeInvitationDraft>{
  if(!UUID.test(orgId)||!UUID.test(invitationId)||
   !Number.isSafeInteger(expectedVersion)||expectedVersion<1||
   expectedVersion>10000000)return denied(400,"INVALID_INPUT");
  const res=await this.post(
   "/_p4_r33_ci/owner/"+orgId+"/invitations/renew",
   "owner",{invitationId,expectedVersion});
  if(res.status!==201||!res.json||typeof res.json!=="object"||
   Array.isArray(res.json))return denied(503,"INVALID_RESPONSE");
  const envelope=res.json as Record<string,unknown>;
  if(Object.keys(envelope).sort().join(",")!=="data,scope"||
   envelope.scope!=="disposable-ci-only")
   return denied(503,"INVALID_RESPONSE");
  const parsed=parseSafeInvitationDraft(envelope.data);
  if(!parsed||parsed.status!=="pending"||
   parsed.organizationId!==orgId||parsed.id===invitationId)
   return denied(503,"INVALID_RESPONSE");
  return parsed;
 }
 async accept(token:string):Promise<P4RecipientAcceptance>{
  if(typeof token!=="string"||!TOKEN.test(token))
   return denied(400,"INVALID_INPUT");
  const res=await this.post(
   "/_p4_r33_ci/recipient/accept","recipient",{token});
  if(res.status!==200)return denied(503,"INVALID_RESPONSE");
  const parsed=parseP4RecipientAcceptance(res.json);
  if(!parsed)return denied(503,"INVALID_RESPONSE");
  return parsed;
 }
}
