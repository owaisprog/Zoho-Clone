/** R60 strict signed localhost fictional CRM lead keyset client. */
import {parseP4R57Lead,type P4R57Lead,type P4R57LeadStatus}
 from "./p4-r57-ci-crm-lead-client";
export type P4R60LeadFilter="all"|P4R57LeadStatus;
export type P4R60Page=Readonly<{items:readonly P4R57Lead[];
 nextCursor:string|null}>;
export class P4R60CiPageError extends Error{
 constructor(public readonly status:number,public readonly code:
  "INVALID_INPUT"|"IDENTITY_REQUIRED"|"ACCESS_DENIED"|"CONFLICT"|
  "UNAVAILABLE"|"INVALID_RESPONSE"){super(code);}
}
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{12}$/;
const FILTERS=new Set(["all","NEW","CONTACTED","QUALIFIED","LOST"]);
const ERRORS:Readonly<Record<number,P4R60CiPageError["code"]>>={
 400:"INVALID_INPUT",401:"IDENTITY_REQUIRED",403:"ACCESS_DENIED",
 409:"CONFLICT",503:"UNAVAILABLE",
};
const deny=(status:number,code:P4R60CiPageError["code"]):never=>{
 throw new P4R60CiPageError(status,code);
};
export class P4R60CiCrmLeadPageClient{
 constructor(private readonly baseUrl:string,private readonly token:()=>Promise<string>,
  private readonly transport:typeof fetch=fetch,
  private readonly env:NodeJS.ProcessEnv=process.env){
  this.guard();
  if(typeof token!=="function"||typeof transport!=="function")deny(503,"UNAVAILABLE");
 }
 private guard():void{
  if(this.env.CI!=="true"||this.env.GITHUB_ACTIONS!=="true"||
   this.env.NODE_ENV==="production")deny(503,"UNAVAILABLE");
  let u:URL;
  try{u=new URL(this.baseUrl);}catch{return deny(503,"UNAVAILABLE");}
  if(u.protocol!=="http:"||u.hostname!=="127.0.0.1"||!u.port||
   u.pathname!=="/"||u.search||u.hash||u.username||u.password)
   deny(503,"UNAVAILABLE");
 }
 async page(org:string,status:P4R60LeadFilter="all",search:string="",
  cursor:string|null=null):Promise<P4R60Page>{
  if(!UUID.test(org)||!FILTERS.has(status)||
   typeof search!=="string"||search.length>40||
   !/^[a-zA-Z0-9._@ -]*$/.test(search)||
   (cursor!==null&&(typeof cursor!=="string"||cursor.length>1024||
    !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(cursor))))
   return deny(400,"INVALID_INPUT");
  this.guard();
  let jwt:string;
  try{jwt=await this.token();}catch{return deny(401,"IDENTITY_REQUIRED");}
  if(typeof jwt!=="string"||jwt.length>10000||
   !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(jwt))
   return deny(401,"IDENTITY_REQUIRED");
  let response:Response;
  const q=search.toLowerCase();
  try{
   const path="/_p4_r33_ci/owner/"+org+"/leads/page?status="+status+
    "&q="+encodeURIComponent(q)+"&cursor="+encodeURIComponent(cursor??"");
   response=await this.transport(new URL(path,this.baseUrl),{
    method:"GET",headers:{"Authorization":"Bearer "+jwt,"Accept":"application/json"},
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
    Object.keys(body).join(",")!=="error")return deny(503,"INVALID_RESPONSE");
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
  const envelope=body as Record<string,unknown>;
  if(envelope.scope!=="disposable-ci-only"||!envelope.data||
   typeof envelope.data!=="object"||Array.isArray(envelope.data)||
   Object.keys(envelope.data).sort().join(",")!=="items,nextCursor")
   return deny(503,"INVALID_RESPONSE");
  const data=envelope.data as {items?:unknown;nextCursor?:unknown};
  if(!Array.isArray(data.items)||data.items.length>20||
   (data.nextCursor!==null&&(typeof data.nextCursor!=="string"||
    data.nextCursor.length>1024||
    !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(data.nextCursor))))
   return deny(503,"INVALID_RESPONSE");
  const parsed=data.items.map(parseP4R57Lead);
  if(parsed.some(x=>x===null))return deny(503,"INVALID_RESPONSE");
  const items=parsed as P4R57Lead[];
  if(new Set(items.map(x=>x.leadId)).size!==items.length||
   new Set(items.map(x=>x.contactEmail)).size!==items.length||
   items.some((x,i)=>i>0&&x.createdAt>items[i-1]!.createdAt)||
   items.some(x=>(status!=="all"&&x.status!==status)||
    (q!==""&&!x.companyName.toLowerCase().includes(q)&&
     !x.contactEmail.includes(q)))||
   (data.nextCursor!==null&&items.length!==20))
   return deny(503,"INVALID_RESPONSE");
  return Object.freeze({items:Object.freeze(items),nextCursor:data.nextCursor});
 }
}
