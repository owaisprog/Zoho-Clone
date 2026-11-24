/** R57 strictly typed owner CRM HTTP client, signed localhost synthetic CI only. */
export type P4R57LeadSource="WEBSITE"|"REFERRAL"|"EVENT";
export type P4R57LeadStatus="NEW"|"CONTACTED"|"QUALIFIED"|"LOST";
export type P4R57Lead=Readonly<{
 leadId:string;companyName:string;contactEmail:string;
 source:P4R57LeadSource;status:P4R57LeadStatus;
 revision:number;createdAt:string;
}>;
export type P4R57NewLead=Readonly<{
 companyName:string;contactEmail:string;source:P4R57LeadSource;
}>;
export class P4R57CiCrmError extends Error{
 constructor(public readonly status:number,public readonly code:
  "INVALID_INPUT"|"IDENTITY_REQUIRED"|"ACCESS_DENIED"|"CONFLICT"|
  "UNAVAILABLE"|"INVALID_RESPONSE"){super(code);}
}
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const NAME=/^Demo [A-Za-z][A-Za-z0-9 &.-]{2,48}$/;
const EMAIL=/^[a-z][a-z0-9._-]{1,40}@example\.com$/;
const SOURCES=new Set<P4R57LeadSource>(["WEBSITE","REFERRAL","EVENT"]);
const STATUSES=new Set<P4R57LeadStatus>(["NEW","CONTACTED","QUALIFIED","LOST"]);
const ERRORS:Readonly<Record<number,P4R57CiCrmError["code"]>>={
 400:"INVALID_INPUT",401:"IDENTITY_REQUIRED",403:"ACCESS_DENIED",
 409:"CONFLICT",503:"UNAVAILABLE",
};
const deny=(status:number,code:P4R57CiCrmError["code"]):never=>{
 throw new P4R57CiCrmError(status,code);
};
export function parseP4R57Lead(input:unknown):P4R57Lead|null{
 if(!input||typeof input!=="object"||Array.isArray(input))return null;
 const v=input as Record<string,unknown>;
 if(Object.keys(v).sort().join(",")!==
  "companyName,contactEmail,createdAt,leadId,revision,source,status"||
  typeof v.leadId!=="string"||!UUID.test(v.leadId)||
  typeof v.companyName!=="string"||!NAME.test(v.companyName)||
  typeof v.contactEmail!=="string"||!EMAIL.test(v.contactEmail)||
  !SOURCES.has(v.source as P4R57LeadSource)||
  !STATUSES.has(v.status as P4R57LeadStatus)||
  !Number.isSafeInteger(v.revision)||(v.revision as number)<0||
  (v.revision as number)>1000000||typeof v.createdAt!=="string"||
  !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v.createdAt)||
  !Number.isFinite(Date.parse(v.createdAt))||
  new Date(v.createdAt).toISOString()!==v.createdAt)
  return null;
 return Object.freeze({
  leadId:v.leadId,companyName:v.companyName,contactEmail:v.contactEmail,
  source:v.source,status:v.status,revision:v.revision,createdAt:v.createdAt,
 } as P4R57Lead);
}
export function parseP4R57LeadList(input:unknown):readonly P4R57Lead[]|null{
 if(!Array.isArray(input)||input.length>20)return null;
 const rows=input.map(parseP4R57Lead);
 if(rows.some(x=>x===null))return null;
 const leads=rows as P4R57Lead[];
 if(new Set(leads.map(x=>x.leadId)).size!==leads.length||
  new Set(leads.map(x=>x.contactEmail)).size!==leads.length||
  leads.some((x,i)=>i>0&&x.createdAt>leads[i-1]!.createdAt))
  return null;
 return Object.freeze(leads);
}
export class P4R57CiCrmLeadClient{
 constructor(private readonly baseUrl:string,
  private readonly token:()=>Promise<string>,
  private readonly transport:typeof fetch=fetch,
  private readonly env:NodeJS.ProcessEnv=process.env){
  this.guard();
  if(typeof token!=="function"||typeof transport!=="function")
   deny(503,"UNAVAILABLE");
 }
 private guard():void{
  if(this.env.CI!=="true"||this.env.GITHUB_ACTIONS!=="true"||
   this.env.NODE_ENV==="production")deny(503,"UNAVAILABLE");
  let uri:URL;
  try{uri=new URL(this.baseUrl);}catch{return deny(503,"UNAVAILABLE");}
  if(uri.protocol!=="http:"||uri.hostname!=="127.0.0.1"||
   !uri.port||uri.pathname!=="/"||uri.search||uri.hash||
   uri.username||uri.password)deny(503,"UNAVAILABLE");
 }
 private async call(org:string,method:"GET"|"POST",input?:P4R57NewLead):Promise<unknown>{
  this.guard();
  if(!UUID.test(org))return deny(400,"INVALID_INPUT");
  let jwt:string;
  try{jwt=await this.token();}catch{return deny(401,"IDENTITY_REQUIRED");}
  if(typeof jwt!=="string"||jwt.length>10000||
   !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(jwt))
   return deny(401,"IDENTITY_REQUIRED");
  let response:Response;
  try{
   response=await this.transport(new URL(
    "/_p4_r33_ci/owner/"+org+"/leads",this.baseUrl),{
    method,headers:{"Authorization":"Bearer "+jwt,"Accept":"application/json",
     ...(method==="POST"?{"Content-Type":"application/json"}:{})},
    ...(method==="POST"?{body:JSON.stringify(input)}:{}),
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
   const e=(body as {error?:unknown}).error;
   if(!e||typeof e!=="object"||Array.isArray(e)||
    Object.keys(e).join(",")!=="code"||
    !ERRORS[response.status]||
    (e as {code?:unknown}).code!==ERRORS[response.status])
    return deny(503,"INVALID_RESPONSE");
   return deny(response.status,ERRORS[response.status]!);
  }
  if(response.status!==200||!body||typeof body!=="object"||
   Array.isArray(body)||Object.keys(body).sort().join(",")!=="data,scope")
   return deny(503,"INVALID_RESPONSE");
  const data=body as Record<string,unknown>;
  if(data.scope!=="disposable-ci-only")return deny(503,"INVALID_RESPONSE");
  return data.data;
 }
 async list(org:string):Promise<readonly P4R57Lead[]>{
  const result=parseP4R57LeadList(await this.call(org,"GET"));
  if(result===null)return deny(503,"INVALID_RESPONSE");
  return result;
 }
 async create(org:string,input:P4R57NewLead):Promise<P4R57Lead>{
  if(!input||typeof input!=="object"||Array.isArray(input)||
   Object.keys(input).sort().join(",")!=="companyName,contactEmail,source"||
   typeof input.companyName!=="string"||!NAME.test(input.companyName)||
   typeof input.contactEmail!=="string"||!EMAIL.test(input.contactEmail)||
   !SOURCES.has(input.source))
   return deny(400,"INVALID_INPUT");
  const result=parseP4R57Lead(await this.call(org,"POST",input));
  if(!result||result.status!=="NEW"||result.revision!==0||
   result.companyName!==input.companyName||
   result.contactEmail!==input.contactEmail||result.source!==input.source)
   return deny(503,"INVALID_RESPONSE");
  return result;
 }
}
