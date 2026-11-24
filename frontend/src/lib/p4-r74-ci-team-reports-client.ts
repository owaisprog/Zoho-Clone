/** R74 manager reports on synthetic localhost only. */
export type ManagedTeam=Readonly<{id:string;name:string}>;
export type TeamQuery=Readonly<{team:string;owner:string;stage:string;from:string;to:string}>;
export type TeamReport=Readonly<{rows:readonly {owner:string;stage:string;total:number}[];total:number}>;
export class P4R73CiWorkspaceError extends Error{
 constructor(public readonly status:number,public readonly code:string){super(code);}
}
const ERRORS:Readonly<Record<number,string>>={400:"INVALID_INPUT",401:"IDENTITY_REQUIRED",403:"ACCESS_DENIED",409:"CONFLICT",503:"UNAVAILABLE"};
const deny=(status:number,code:string):never=>{throw new P4R73CiWorkspaceError(status,code);};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const TEAM=/^team_demo_[a-z]{2,24}$/;
const NAME=/^Demo [A-Za-z][A-Za-z0-9 &.-]{2,80}$/;
const USER=/^user_demo_[a-z]{2,16}$/;
const STAGES=["OPEN","DISCOVERY","PROPOSAL","NEGOTIATION","WON","LOST"];
const valid=(v:unknown,re:RegExp):v is string=>typeof v==="string"&&re.test(v);
export class P4R74CiTeamReportsClient{
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
  let uri:URL;
  try{uri=new URL(this.baseUrl);}catch{return deny(503,"UNAVAILABLE");}
  if(uri.protocol!=="http:"||uri.hostname!=="127.0.0.1"||
   !uri.port||uri.pathname!=="/"||uri.search||uri.hash||
   uri.username||uri.password)deny(503,"UNAVAILABLE");
 }
 private async request(path:string):Promise<unknown>{
  this.guard();
  let jwt:string;
  try{jwt=await this.token();}catch{return deny(401,"IDENTITY_REQUIRED");}
  if(typeof jwt!=="string"||jwt.length>10000||
   !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(jwt))
   return deny(401,"IDENTITY_REQUIRED");
  let response:Response;
  try{
   response=await this.transport(new URL(
    path,this.baseUrl),{
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
   const value=(body as {error?:unknown}).error;
   if(!value||typeof value!=="object"||Array.isArray(value)||
    Object.keys(value).join(",")!=="code"||
    !ERRORS[response.status]||
    (value as {code?:unknown}).code!==ERRORS[response.status])
    return deny(503,"INVALID_RESPONSE");
   return deny(response.status,ERRORS[response.status]!);
  }
  if(response.status!==200||!body||typeof body!=="object"||
   Array.isArray(body)||Object.keys(body).sort().join(",")!=="data,scope")
   return deny(503,"INVALID_RESPONSE");
  const envelope=body as Record<string,unknown>;
  if(envelope.scope!=="disposable-ci-only")
   return deny(503,"INVALID_RESPONSE");
  return envelope.data;
 }
 async teams(org:string):Promise<readonly ManagedTeam[]>{
  if(!UUID.test(org))return deny(400,"INVALID_INPUT");
  const data=await this.request("/_p4_r33_ci/sales/"+org+"/managed-teams");
  if(!Array.isArray(data)||data.length>100)return deny(503,"INVALID_RESPONSE");
  const rows=data.map((v:unknown)=>{
   if(!v||typeof v!=="object"||Object.keys(v).sort().join(",")!=="id,name")return deny(503,"INVALID_RESPONSE");
   const x=v as Record<string,unknown>;
   if(!valid(x.id,TEAM)||!valid(x.name,NAME))return deny(503,"INVALID_RESPONSE");
   return {id:x.id,name:x.name};
  });
  if(rows.some((x,i)=>i>0&&x.id<=rows[i-1]!.id))return deny(503,"INVALID_RESPONSE");return rows;
 }
 async report(org:string,q:TeamQuery):Promise<TeamReport>{
  if(!UUID.test(org))return deny(400,"INVALID_INPUT");
  const data=await this.request("/_p4_r33_ci/sales/"+org+"/team-report?"+new URLSearchParams({...q}).toString());
  if(!data||typeof data!=="object"||Object.keys(data).sort().join(",")!=="rows,total")return deny(503,"INVALID_RESPONSE");
  const v=data as Record<string,unknown>;
  if(!Array.isArray(v.rows)||v.rows.length>600||typeof v.total!=="number"||!Number.isSafeInteger(v.total)||v.total<0)return deny(503,"INVALID_RESPONSE");
  const rows=v.rows.map((r:unknown)=>{
   if(!r||typeof r!=="object"||Object.keys(r).sort().join(",")!=="owner,stage,total")return deny(503,"INVALID_RESPONSE");
   const x=r as Record<string,unknown>;
   if(!valid(x.owner,USER)||typeof x.stage!=="string"||!STAGES.includes(x.stage)||typeof x.total!=="number"||!Number.isSafeInteger(x.total)||x.total<1||
   (q.owner!==""&&x.owner!==q.owner)||(q.stage!==""&&x.stage!==q.stage))return deny(503,"INVALID_RESPONSE");
   return {owner:x.owner,stage:x.stage,total:x.total};
  });
  if(rows.reduce((n,x)=>n+x.total,0)!==v.total||new Set(rows.map(x=>x.owner+":"+x.stage)).size!==rows.length)return deny(503,"INVALID_RESPONSE");
  return {rows,total:v.total};
 }
}
