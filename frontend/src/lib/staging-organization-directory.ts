import {isStageOrgId,readStageWebBinding} from "./staging-membership";
type Env=Readonly<Record<string,string|undefined>>;
export type OrganizationItem={organizationId:string;membershipRole:"OWNER"|"MEMBER"};
export type DirectoryResult={status:"verified";items:OrganizationItem[];nextCursor:string|null;applicationAccess:false}|
 {status:"disabled"|"unauthenticated"|"denied"|"unavailable";applicationAccess:false};
const blocked=(status:"disabled"|"unauthenticated"|"denied"|"unavailable"):DirectoryResult=>({status,applicationAccess:false});
export function parseDirectoryPage(value:unknown,after:string|null):DirectoryResult{
 if(!value||typeof value!=="object"||Array.isArray(value)||Object.keys(value).sort().join(",")!=="applicationAccess,items,nextCursor,scope")return blocked("unavailable");
 const x=value as Record<string,unknown>;
 if(x.scope!=="staging-organization-directory"||x.applicationAccess!==false||!Array.isArray(x.items)||x.items.length>20)return blocked("unavailable");
 let prior=after;const items:OrganizationItem[]=[];
 for(const v of x.items){
  if(!v||typeof v!=="object"||Object.keys(v).sort().join(",")!=="membershipRole,organizationId"||
     !isStageOrgId(v.organizationId)||(prior!==null&&v.organizationId<=prior)||
     (v.membershipRole!=="OWNER"&&v.membershipRole!=="MEMBER"))return blocked("unavailable");
  prior=v.organizationId;items.push({organizationId:v.organizationId,membershipRole:v.membershipRole});
 }
 if(x.nextCursor!==null&&(!isStageOrgId(x.nextCursor)||items.length!==20||x.nextCursor!==prior))return blocked("unavailable");
 return {status:"verified",items,nextCursor:x.nextCursor as string|null,applicationAccess:false};
}
export async function listStageOrganizations(after:unknown,session:{hasSession:()=>Promise<boolean>;getToken:()=>Promise<string>},env:Env=process.env,transport:typeof fetch=fetch):Promise<DirectoryResult>{
 if(after!==null&&!isStageOrgId(after))return blocked("denied");
 const binding=readStageWebBinding(env);
 if(!binding||env.P4_STAGE_ORG_DIRECTORY_ENABLED!=="true")return blocked("disabled");
 try{
  if(!await session.hasSession())return blocked("unauthenticated");
  const token=await session.getToken();
  if(typeof token!=="string"||token.length>8192||!/^[-A-Za-z0-9_]+\.[-A-Za-z0-9_]+\.[-A-Za-z0-9_]+$/.test(token))return blocked("unauthenticated");
  const url=new URL("/api/v1/staging/organizations/directory",binding.origin);
  if(after!==null)url.searchParams.set("after",after);
  const r=await transport(url,{method:"GET",headers:{Authorization:"Bearer "+token,Accept:"application/json"},cache:"no-store",credentials:"omit",redirect:"error",signal:AbortSignal.timeout(5000)});
  if(r.status===401)return blocked("unauthenticated");if(r.status===403)return blocked("denied");
  if(r.status!==200||!r.headers.get("content-type")?.includes("application/json"))return blocked("unavailable");
  const reader=r.body?.getReader();if(!reader)return blocked("unavailable");
  let bytes=0;const chunks:Uint8Array[]=[];
  try{for(;;){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>4096){await reader.cancel();return blocked("unavailable");}chunks.push(part.value);}}
  finally{reader.releaseLock();}
  const joined=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){joined.set(chunk,offset);offset+=chunk.length;}
  return parseDirectoryPage(JSON.parse(new TextDecoder().decode(joined)),after);
 }catch{return blocked("unavailable");}
}
