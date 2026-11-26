import {isStageOrgId} from "./staging-membership";
import {parseSalesGrants,type RoleEditorTransport} from "./stage-role-editor";
import {parseTeamPage,type TeamEditorTransport} from "./stage-team-editor";
import {parseDirectoryPage,type OrganizationItem} from "./staging-organization-directory";
export type PermissionWorkspaceTransport={
 directory(after:string|null):Promise<{items:OrganizationItem[];nextCursor:string|null}>;
 roles:RoleEditorTransport;teams:TeamEditorTransport;
};
type Outcome="applied"|"replay"|"conflict"|"denied"|"unavailable";
export function parseGrantOutcome(value:unknown,status:number):Outcome{
 if(!value||typeof value!=="object"||Array.isArray(value)||Object.keys(value).sort().join(",")!=="applicationAccess,status")return "unavailable";
 const x=value as Record<string,unknown>;
 if(x.applicationAccess!==false)return "unavailable";
 if(status===200&&(x.status==="applied"||x.status==="replay"))return x.status;
 if(status===409&&x.status==="conflict")return "conflict";
 if((status===401||status===403)&&["denied","unauthenticated"].includes(String(x.status)))return "denied";
 return "unavailable";
}
/** Same-origin browser bridge. No bearer, actor or role claims accepted from browser. */
export function createPermissionWorkspaceTransport(request:typeof fetch=(url,options)=>fetch(url,options)):PermissionWorkspaceTransport{
 async function call(path:string,body?:unknown){
  const response=await request(path,{method:body===undefined?"GET":"POST",headers:{"X-P4-Permission-Workspace":"1",Accept:"application/json",...(body===undefined?{}:{"Content-Type":"application/json"})},...(body===undefined?{}:{body:JSON.stringify(body)}),credentials:"same-origin",cache:"no-store",redirect:"error",signal:AbortSignal.timeout(8000)});
  if(!response.headers.get("content-type")?.includes("application/json"))throw Error("UNAVAILABLE");
  const reader=response.body?.getReader();if(!reader)throw Error("UNAVAILABLE");
  let bytes=0;const parts:Uint8Array[]=[];
  try{for(;;){const x=await reader.read();if(x.done)break;bytes+=x.value.byteLength;if(bytes>4096){await reader.cancel();throw Error("UNAVAILABLE");}parts.push(x.value);}}finally{reader.releaseLock();}
  const all=new Uint8Array(bytes);let offset=0;for(const x of parts){all.set(x,offset);offset+=x.length;}
  return {status:response.status,value:JSON.parse(new TextDecoder().decode(all)) as unknown};
 }
 function target(org:string,user:string,kind:"sales-grants"|"team-grants"){
  if(!isStageOrgId(org)||!isStageOrgId(user))throw Error("DENIED");
  return "/api/permission-workspace/"+org+"/targets/"+user+"/"+kind;
 }
 function query(after:string|null){if(after===null)return "";if(!isStageOrgId(after))throw Error("DENIED");return "?after="+encodeURIComponent(after);}
 return {
  async directory(after){const r=await call("/api/permission-workspace/directory"+query(after));const p=parseDirectoryPage(r.value,after);if(r.status!==200||p.status!=="verified")throw Error("DENIED");return {items:p.items,nextCursor:p.nextCursor};},
  roles:{
   async list(org,user){const r=await call(target(org,user,"sales-grants"));if(r.status!==200)throw Error("DENIED");return parseSalesGrants(r.value);},
   async toggle(org,user,cmd){const r=await call(target(org,user,"sales-grants"),cmd);return parseGrantOutcome(r.value,r.status);}
  },
  teams:{
   async list(org,user,after){const r=await call(target(org,user,"team-grants")+query(after));if(r.status!==200)throw Error("DENIED");parseTeamPage(r.value,after);return r.value;},
   async toggle(org,user,cmd){const r=await call(target(org,user,"team-grants"),cmd);return parseGrantOutcome(r.value,r.status);}
  }
 };
}
