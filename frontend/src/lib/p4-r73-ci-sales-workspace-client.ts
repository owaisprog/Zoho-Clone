/** R54: real CI-only signed owner organization switcher client. */
export type P4R73SalesOrganization=Readonly<{
 id:string;name:string;slug:string;salesRole:"SALES_REP";
}>;
export class P4R73CiWorkspaceError extends Error{
 constructor(public readonly status:number,public readonly code:
  "INVALID_INPUT"|"IDENTITY_REQUIRED"|"ACCESS_DENIED"|"CONFLICT"|
  "UNAVAILABLE"|"INVALID_RESPONSE"){super(code);}
}
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const NAME=/^Demo [A-Za-z][A-Za-z0-9 &'-]{2,48}$/;
const SLUG=/^demo-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ERRORS:Readonly<Record<number,P4R73CiWorkspaceError["code"]>>={
 400:"INVALID_INPUT",401:"IDENTITY_REQUIRED",403:"ACCESS_DENIED",
 409:"CONFLICT",503:"UNAVAILABLE",
};
const deny=(status:number,code:P4R73CiWorkspaceError["code"]):never=>{
 throw new P4R73CiWorkspaceError(status,code);
};
export function parseP4R73SalesOrganizations(input:unknown):
 readonly P4R73SalesOrganization[]|null{
 if(!Array.isArray(input)||input.length>200)return null;
 const orgs:P4R73SalesOrganization[]=[];
 for(const row of input){
  if(!row||typeof row!=="object"||Array.isArray(row))return null;
  const v=row as Record<string,unknown>;
  if(Object.keys(v).sort().join(",")!=="id,name,salesRole,slug"||
   typeof v.id!=="string"||!UUID.test(v.id)||
   typeof v.name!=="string"||!NAME.test(v.name)||
   typeof v.slug!=="string"||!SLUG.test(v.slug)||
   v.slug.length>48||v.salesRole!=="SALES_REP")return null;
  orgs.push(Object.freeze({id:v.id,name:v.name,slug:v.slug,salesRole:"SALES_REP"}));
 }
 if(new Set(orgs.map(x=>x.id)).size!==orgs.length||
  new Set(orgs.map(x=>x.slug)).size!==orgs.length||
  orgs.some((x,i)=>i>0&&(orgs[i-1]!.id>=x.id)))return null;
 return Object.freeze(orgs);
}
export class P4R73CiSalesWorkspaceClient{
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
 async list():Promise<readonly P4R73SalesOrganization[]>{
  const orgs=parseP4R73SalesOrganizations(await this.request("/_p4_r33_ci/sales/organizations"));
  if(orgs===null)return deny(503,"INVALID_RESPONSE");return orgs;
 }
 async overview(org:string):Promise<SalesOverview>{
  if(!UUID.test(org))return deny(400,"INVALID_INPUT");
  const data=await this.request("/_p4_r33_ci/sales/"+org+"/overview");
  if(!data||typeof data!=="object"||Array.isArray(data))return deny(503,"INVALID_RESPONSE");
  const v=data as Record<string,unknown>,keys=["accounts","contacts","converted","deals","leads","lostDeals","openDeals","qualified","wonDeals"] as const;
  if(Object.keys(v).sort().join(",")!==keys.join(",")||keys.some(k=>typeof v[k]!=="number"||!Number.isSafeInteger(v[k])||(v[k] as number)<0))return deny(503,"INVALID_RESPONSE");
  const out=v as SalesOverview;
  if(out.qualified+out.converted>out.leads||out.openDeals+out.wonDeals+out.lostDeals!==out.deals)return deny(503,"INVALID_RESPONSE");
  return Object.freeze(out);
 }
}
export type SalesOverview=Readonly<{leads:number;qualified:number;converted:number;accounts:number;contacts:number;deals:number;openDeals:number;wonDeals:number;lostDeals:number}>;
