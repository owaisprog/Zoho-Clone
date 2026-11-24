/** R72 signed localhost sales lead and conversion client. */
export type LeadStatus="NEW"|"CONTACTED"|"QUALIFIED"|"LOST"|"CONVERTED";
export type SalesLead=Readonly<{id:string;companyName:string;contactName:string;email:string;status:LeadStatus;revision:number;accountId:string|null;contactId:string|null;dealId:string|null;createdAt:string}>;
export type LeadInput=Readonly<{companyName:string;contactName:string;email:string}>;
export type LeadPage=Readonly<{items:readonly SalesLead[];nextCursor:string|null}>;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const COMPANY=/^Demo [A-Za-z][A-Za-z0-9 &.-]{2,48}$/;
const CONTACT=/^Demo [A-Za-z][A-Za-z0-9 .-]{2,48}$/;
const EMAIL=/^[a-z][a-z0-9._-]{1,40}@example\.com$/;
const id=(v:unknown):v is string=>typeof v==="string"&&UUID.test(v);
const valid=(v:unknown,re:RegExp):v is string=>typeof v==="string"&&re.test(v);
export class SalesLeadError extends Error{constructor(public readonly status:number){super("LEAD_REQUEST_FAILED");}}
function parse(raw:unknown):SalesLead{
 if(!raw||typeof raw!=="object"||Array.isArray(raw))throw new SalesLeadError(503);
 const r=raw as Record<string,unknown>;
 if(Object.keys(r).sort().join(",")!=="accountId,companyName,contactId,contactName,createdAt,dealId,email,id,revision,status"||
 !id(r.id)||!valid(r.companyName,COMPANY)||!valid(r.contactName,CONTACT)||!valid(r.email,EMAIL)||
 typeof r.status!=="string"||!["NEW","CONTACTED","QUALIFIED","LOST","CONVERTED"].includes(r.status)||
 typeof r.revision!=="number"||!Number.isSafeInteger(r.revision)||r.revision<0||r.revision>1000000||
 typeof r.createdAt!=="string"||!Number.isFinite(Date.parse(r.createdAt))||
 new Date(r.createdAt).toISOString()!==r.createdAt||
 ![r.accountId,r.contactId,r.dealId].every(v=>r.status==="CONVERTED"?id(v):v===null))throw new SalesLeadError(503);
 return Object.freeze({id:r.id,companyName:r.companyName,contactName:r.contactName,email:r.email,status:r.status as LeadStatus,revision:r.revision,accountId:r.accountId as string|null,contactId:r.contactId as string|null,dealId:r.dealId as string|null,createdAt:r.createdAt});
}
export class P4R72CiSalesLeadsClient{
 constructor(private readonly base:string,private readonly token:()=>Promise<string>,
 private readonly fetcher:typeof fetch=fetch,private readonly env:NodeJS.ProcessEnv=process.env){this.guard();}
 private guard(){
  if(this.env.CI!=="true"||this.env.GITHUB_ACTIONS!=="true"||this.env.NODE_ENV==="production")throw new SalesLeadError(503);
  let u:URL;try{u=new URL(this.base);}catch{throw new SalesLeadError(503);}
  if(u.protocol!=="http:"||u.hostname!=="127.0.0.1"||!u.port||u.pathname!=="/"||u.search||u.hash||u.username||u.password)throw new SalesLeadError(503);
 }
 private async request(org:string,suffix:string,method:string,body?:unknown):Promise<unknown>{
  this.guard();if(!UUID.test(org))throw new SalesLeadError(400);
  const token=await this.token();if(!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)||token.length>10000)throw new SalesLeadError(401);
  let r:Response;try{r=await this.fetcher(new URL("/_p4_r33_ci/sales/"+org+"/leads"+suffix,this.base),{
   method,headers:{Authorization:"Bearer "+token,Accept:"application/json",...(body===undefined?{}:{"Content-Type":"application/json"})},
   ...(body===undefined?{}:{body:JSON.stringify(body)}),redirect:"error",credentials:"omit",cache:"no-store",signal:AbortSignal.timeout(3000)});
  }catch{throw new SalesLeadError(503);}
  if(r.headers.get("cache-control")!=="no-store, private"||r.headers.get("x-content-type-options")!=="nosniff")throw new SalesLeadError(503);
  if(!r.ok)throw new SalesLeadError([400,401,403,409,503].includes(r.status)?r.status:503);
  const envelope:unknown=await r.json();
  if(!envelope||typeof envelope!=="object"||Object.keys(envelope).sort().join(",")!=="data,scope"||(envelope as {scope?:unknown}).scope!=="disposable-ci-only")throw new SalesLeadError(503);
  return (envelope as {data:unknown}).data;
 }
 async page(org:string,after:string|null=null):Promise<LeadPage>{
  if(after!==null&&!UUID.test(after))throw new SalesLeadError(400);
  const raw=await this.request(org,"?after="+encodeURIComponent(after??""),"GET");
  if(!raw||typeof raw!=="object"||Object.keys(raw).sort().join(",")!=="items,nextCursor")throw new SalesLeadError(503);
  const p=raw as {items:unknown;nextCursor:unknown};
  if(!Array.isArray(p.items)||p.items.length>20)throw new SalesLeadError(503);
  const items=p.items.map(parse);
  if(items.some((x,i)=>(i>0&&x.id<=items[i-1]!.id)||(after!==null&&x.id<=after))||
  (p.nextCursor!==null&&(items.length!==20||p.nextCursor!==items[19]!.id)))throw new SalesLeadError(503);
  return {items,nextCursor:p.nextCursor as string|null};
 }
 async create(org:string,input:LeadInput){return parse(await this.request(org,"","POST",input));}
 async changeStage(org:string,id:string,status:LeadStatus,expectedRevision:number){
  if(!UUID.test(id)||!["CONTACTED","QUALIFIED","LOST"].includes(status))throw new SalesLeadError(400);
  return parse(await this.request(org,"/"+id+"/stage","PATCH",{status,expectedRevision}));
 }
 async convert(org:string,id:string,title:string,expectedRevision:number){
  if(!UUID.test(id))throw new SalesLeadError(400);
  return parse(await this.request(org,"/"+id+"/convert","POST",{title,expectedRevision}));
 }
}
