/** Local disposable browser fixture only; never mount in Next production routes. */
export type FileRow=Readonly<{id:string;revision:number;state:"quarantined"|"scan_clean"|"rejected"}>;
export type Navigation=Readonly<{organizationId:string;membershipRole:"OWNER"|"MEMBER";crmAvailable:boolean}>;
export type FilePage=Readonly<{items:readonly FileRow[];nextCursor:string|null}>;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const id=(v:unknown):v is string=>typeof v==="string"&&uuid.test(v);
const obj=(v:unknown,keys:string):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v)&&Object.keys(v).sort().join(",")===keys;
const fail=()=>{throw Error("WORKSPACE_UNAVAILABLE");};
const fixture=/^Demo (blocked )?attachment [A-Za-z0-9 .-]{1,120}$/;
function row(v:unknown):FileRow{
 if(!obj(v,"id,revision,state")||!id(v.id)||typeof v.revision!=="number"||!Number.isSafeInteger(v.revision)||v.revision<0||!["quarantined","scan_clean","rejected"].includes(v.state as string))return fail();
 return {id:v.id,revision:v.revision,state:v.state as FileRow["state"]};
}
export class P4R89CiWorkspaceClient{
 constructor(private readonly base:string,private readonly token:()=>Promise<string>,private readonly env:NodeJS.ProcessEnv){this.guard();}
 private guard(){
  if(this.env.CI!=="true"||this.env.GITHUB_ACTIONS!=="true"||this.env.P4_R89_BROWSER_CI!=="true"||this.env.NODE_ENV==="production")return fail();
  const u=new URL(this.base);if(u.protocol!=="http:"||u.hostname!=="127.0.0.1"||!u.port||u.pathname!=="/"||u.search||u.hash||u.username||u.password)return fail();
 }
 private async request(path:string,method="GET",body?:unknown){
  this.guard();const token=await this.token();if(token.length>10000||!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token))return fail();
  const r=await fetch(new URL(path,this.base),{method,headers:{Authorization:"Bearer "+token,...(body===undefined?{}:{"Content-Type":"application/json"})},...(body===undefined?{}:{body:JSON.stringify(body)}),redirect:"error",credentials:"omit",cache:"no-store",signal:AbortSignal.timeout(5000)});
  if(!r.ok||r.headers.get("cache-control")!=="no-store, private"||r.headers.get("x-content-type-options")!=="nosniff")return fail();return r;
 }
 private async json(path:string,method="GET",body?:unknown):Promise<unknown>{
  const r=await this.request(path,method,body);
  if(!r.headers.get("content-type")?.startsWith("application/json"))return fail();
  const v:unknown=await r.json();if(!obj(v,"data,scope")||v.scope!=="disposable-ci-only")return fail();return v.data;
 }
 async navigation(org:string):Promise<Navigation>{
  if(!id(org))return fail();const v=await this.json("/platform/"+org+"/navigation");
  if(!obj(v,"crmAvailable,membershipRole,organizationId")||v.organizationId!==org||(v.membershipRole!=="OWNER"&&v.membershipRole!=="MEMBER")||typeof v.crmAvailable!=="boolean"||(v.membershipRole==="OWNER"&&v.crmAvailable))return fail();
  return {organizationId:org,membershipRole:v.membershipRole,crmAvailable:v.crmAvailable};
 }
 async files(org:string,parent:string,after:string|null=null):Promise<FilePage>{
  if(!id(org)||!id(parent)||(after!==null&&!id(after)))return fail();
  const v=await this.json("/files/"+org+"/parents/"+parent+"/files"+(after?"?after="+after:""));
  if(!obj(v,"items,nextCursor")||!Array.isArray(v.items)||v.items.length>20)return fail();
  const items=v.items.map(row);let prior=after??"";for(const x of items){if(x.id<=prior)return fail();prior=x.id;}
  if(v.nextCursor!==null&&(items.length!==20||v.nextCursor!==prior))return fail();
  return {items,nextCursor:v.nextCursor as string|null};
 }
 async create(org:string,parent:string,content:string){if(!id(org)||!id(parent)||!fixture.test(content))return fail();const v=row(await this.json("/files/"+org+"/parents/"+parent+"/files","POST",{content}));if(v.state!=="quarantined"||v.revision!==0)return fail();return v;}
 async download(org:string,file:string):Promise<Blob>{
  if(!id(org)||!id(file))return fail();const base="/files/"+org+"/files/"+file;
  const v=await this.json(base+"/grant","POST",{});
  if(!obj(v,"expiresAt,token")||typeof v.token!=="string"||! /^[a-f0-9]{64}$/.test(v.token)||typeof v.expiresAt!=="string"||!Number.isFinite(Date.parse(v.expiresAt))||Date.parse(v.expiresAt)<=Date.now()||Date.parse(v.expiresAt)>Date.now()+65000)return fail();
  const r=await this.request(base+"/redeem","POST",{token:v.token});
  if(!r.headers.get("content-type")?.startsWith("text/plain")||r.headers.get("content-disposition")!=='attachment; filename="demo-attachment.txt"')return fail();
  const content=await r.text();if(!/^Demo attachment [A-Za-z0-9 .-]{1,120}$/.test(content))return fail();return new Blob([content],{type:"text/plain"});
 }
 async remove(org:string,file:FileRow){
  if(!id(org)||!id(file.id)||!Number.isSafeInteger(file.revision)||file.revision<0)return fail();
  const v=await this.json("/files/"+org+"/files/"+file.id,"DELETE",{expectedRevision:file.revision});
  if(!obj(v,"id,revision,state")||v.id!==file.id||v.revision!==file.revision+1||v.state!=="soft_deleted")return fail();
 }
}
