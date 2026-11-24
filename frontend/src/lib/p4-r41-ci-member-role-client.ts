/**
 * P4 R41 CI-only frontend typed member role client.
 * No page imports, no browser access, no real Auth0 or production activation.
 */
import {parseP4R41Member,parseP4R41Members,type P4R41Role,
 type P4R41Member} from "./p4-r41-ci-member-role-contract";
export class P4R41CiError extends Error{
 constructor(public readonly status:number,public readonly code:
 "INVALID_INPUT"|"IDENTITY_REQUIRED"|"ACCESS_DENIED"|"CONFLICT"|"UNAVAILABLE"|"INVALID_RESPONSE"){
  super(code);
 }
}
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const USER=/^user_demo_[a-z]{2,16}$/;
const STATUS:Readonly<Record<number,P4R41CiError["code"]>>={
 400:"INVALID_INPUT",401:"IDENTITY_REQUIRED",403:"ACCESS_DENIED",
 409:"CONFLICT",503:"UNAVAILABLE",
};
const deny=(status:number,code:P4R41CiError["code"]):never=>{throw new P4R41CiError(status,code);};
export class P4R41CiMemberRoleClient{
 constructor(private readonly url:string,private readonly token:()=>Promise<string>,
  private readonly transport:typeof fetch=fetch,
  private readonly env:NodeJS.ProcessEnv=process.env){
  this.guard();
  if(typeof token!=="function"||typeof transport!=="function")deny(503,"UNAVAILABLE");
 }
 private guard(){
  if(this.env.CI!=="true"||this.env.GITHUB_ACTIONS!=="true"||
   this.env.NODE_ENV==="production")deny(503,"UNAVAILABLE");
  let x:URL;
  try{x=new URL(this.url);}catch{return deny(503,"UNAVAILABLE");}
  if(x.protocol!=="http:"||x.hostname!=="127.0.0.1"||!x.port||
   x.pathname!=="/"||x.search||x.hash||x.username||x.password)
   deny(503,"UNAVAILABLE");
 }
 private async call(path:string,method:"GET"|"PATCH",body?:unknown):Promise<unknown>{
  this.guard();
  let jwt:string;
  try{jwt=await this.token();}catch{return deny(401,"IDENTITY_REQUIRED");}
  if(typeof jwt!=="string"||jwt.length>10000||
   !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(jwt))
   deny(401,"IDENTITY_REQUIRED");
  try{
   const response=await this.transport(new URL(path,this.url),{
    method,headers:{"Authorization":"Bearer "+jwt,"Accept":"application/json",
     ...(method==="PATCH"?{"Content-Type":"application/json"}:{})},
    ...(method==="PATCH"?{body:JSON.stringify(body)}:{}),
    credentials:"omit",redirect:"error",cache:"no-store",
    signal:AbortSignal.timeout(3000),
   });
   if(response.headers.get("cache-control")!=="no-store, private"||
    response.headers.get("x-content-type-options")!=="nosniff")deny(503,"INVALID_RESPONSE");
   let result:unknown;
   try{result=await response.json();}catch{return deny(503,"INVALID_RESPONSE");}
   if(!response.ok){
    if(!result||typeof result!=="object"||Array.isArray(result)||
     Object.keys(result).join(",")!=="error")deny(503,"INVALID_RESPONSE");
    const e=(result as {error?:unknown}).error;
    if(!e||typeof e!=="object"||Array.isArray(e)||
     Object.keys(e).join(",")!=="code"||!STATUS[response.status]||
     (e as {code?:unknown}).code!==STATUS[response.status])
      deny(503,"INVALID_RESPONSE");
    deny(response.status,STATUS[response.status]!);
   }
   if(response.status!==200||!result||typeof result!=="object"||
    Array.isArray(result))deny(503,"INVALID_RESPONSE");
   const obj=result as Record<string,unknown>;
   if(Object.keys(obj).sort().join(",")!=="data,scope"||
    obj.scope!=="disposable-ci-only")deny(503,"INVALID_RESPONSE");
   return obj.data;
  }catch(e){
   if(e instanceof P4R41CiError)throw e;
   return deny(503,"UNAVAILABLE");
  }
 }
 async members(orgId:string):Promise<readonly P4R41Member[]>{
  if(!UUID.test(orgId))deny(400,"INVALID_INPUT");
  const raw=await this.call("/_p4_r33_ci/owner/"+orgId+"/members","GET");
  const rows=parseP4R41Members(raw);
  if(!rows)deny(503,"INVALID_RESPONSE");
  return rows;
 }
 async change(orgId:string,userId:string,role:P4R41Role,
  expectedRevision:number):Promise<P4R41Member>{
  if(!UUID.test(orgId)||!USER.test(userId)||
   (role!=="SALES_REP"&&role!=="SALES_MANAGER")||
   !Number.isSafeInteger(expectedRevision)||expectedRevision<0||
   expectedRevision>=10000000)deny(400,"INVALID_INPUT");
  const raw=await this.call(
   "/_p4_r33_ci/owner/"+orgId+"/members/"+userId+"/role",
   "PATCH",{role,expectedRevision});
  const item=parseP4R41Member(raw);
  if(!item||item.userId!==userId||item.role!==role||
   item.revision!==expectedRevision+1)deny(503,"INVALID_RESPONSE");
  return item;
 }
}
