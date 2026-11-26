import { readAuth0WebConfiguration } from "./auth0-config";
import { stagingApiOrigin } from "./staging-health";
type Env=Readonly<Record<string,string|undefined>>;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export function isStageOrgId(v:unknown):v is string{return typeof v==="string"&&UUID.test(v);}
export function readStageWebBinding(env:Env=process.env){
 const origin=stagingApiOrigin(env),web=readAuth0WebConfiguration(env);
 if(!origin||!web||env.P4_STAGE_OWNER_ACTIVATION!=="approved"||env.P4_STAGE_MEMBERSHIP_ENABLED!=="true"||
  origin.hostname!==env.P4_STAGE_API_HOST||
  web.domain!==env.P4_STAGE_AUTH0_DOMAIN||web.audience!==env.P4_STAGE_AUTH0_AUDIENCE||
  env.AUTH0_CLIENT_ID!==env.P4_STAGE_AUTH0_CLIENT_ID||
  !/^[A-Za-z0-9_-]{16,128}$/.test(env.AUTH0_CLIENT_ID??""))return null;
 return {origin,web};
}
export type MembershipResult=
 | {status:"verified";organizationId:string;membershipRole:"OWNER"|"MEMBER";applicationAccess:false}
 | {status:"disabled"|"unauthenticated"|"denied"|"unavailable";applicationAccess:false};
type SessionAccess={hasSession:()=>Promise<boolean>;getToken:()=>Promise<string>};
const blocked=(status:"disabled"|"unauthenticated"|"denied"|"unavailable"):MembershipResult=>({status,applicationAccess:false});
export async function checkStageMembership(orgId:unknown,session:SessionAccess,env:Env=process.env,transport:typeof fetch=fetch):Promise<MembershipResult>{
 if(!isStageOrgId(orgId))return blocked("denied");
 const binding=readStageWebBinding(env);
 if(!binding)return blocked("disabled");
 try{
  if(!await session.hasSession())return blocked("unauthenticated");
  const token=await session.getToken();
  if(typeof token!=="string"||token.length>8192||!/^[-A-Za-z0-9_]+\.[-A-Za-z0-9_]+\.[-A-Za-z0-9_]+$/.test(token))return blocked("unauthenticated");
  const result=await transport(new URL("/api/v1/staging/organizations/"+orgId+"/membership-check",binding.origin),{
   method:"GET",headers:{Authorization:"Bearer "+token,Accept:"application/json"},cache:"no-store",
   redirect:"error",credentials:"omit",signal:AbortSignal.timeout(5000)
  });
  if(result.status===401)return blocked("unauthenticated");
  if(result.status===403)return blocked("denied");
  if(result.status!==200||!result.headers.get("content-type")?.includes("application/json"))return blocked("unavailable");
  const stream=result.body?.getReader();if(!stream)return blocked("unavailable");
  const decoder=new TextDecoder();let body="",bytes=0;
  try{for(;;){const part=await stream.read();if(part.done)break;bytes+=part.value.byteLength;
   if(bytes>2048){await stream.cancel();return blocked("unavailable");}body+=decoder.decode(part.value,{stream:true});}body+=decoder.decode();}
  finally{stream.releaseLock();}
  const v:unknown=JSON.parse(body);
  if(!v||typeof v!=="object"||Array.isArray(v)||Object.keys(v).sort().join(",")!=="applicationAccess,membershipRole,organizationId,scope")return blocked("unavailable");
  const x=v as Record<string,unknown>;
  if(x.scope!=="staging-membership-only"||x.organizationId!==orgId||x.applicationAccess!==false||
   (x.membershipRole!=="OWNER"&&x.membershipRole!=="MEMBER"))return blocked("unavailable");
  return {status:"verified",organizationId:orgId,membershipRole:x.membershipRole,applicationAccess:false};
 }catch{return blocked("unavailable");}
}
