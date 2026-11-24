/** R71 signed synthetic sales Deal client. */
export const DEAL_STAGES=["OPEN","DISCOVERY","PROPOSAL","NEGOTIATION","WON","LOST"] as const;
export type DealStage=typeof DEAL_STAGES[number];
export type Deal=Readonly<{id:string;title:string;accountId:string;contactId:string;pipelineId:string;stageId:string;stage:DealStage;revision:number;createdAt:string}>;
export type DealInput=Readonly<{title:string;accountId:string;contactId:string}>;
export type DealPage=Readonly<{items:readonly Deal[];nextCursor:string|null}>;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const NAME=/^Demo [A-Za-z][A-Za-z0-9 &.-]{2,148}$/;
export class SalesDealError extends Error{constructor(public readonly status:number){super("DEAL_REQUEST_FAILED");}}
const id=(v:unknown):v is string=>typeof v==="string"&&UUID.test(v);
function parse(raw:unknown):Deal{
 if(!raw||typeof raw!=="object"||Array.isArray(raw))throw new SalesDealError(503);
 const r=raw as Record<string,unknown>;
 if(Object.keys(r).sort().join(",")!=="accountId,contactId,createdAt,id,pipelineId,revision,stage,stageId,title"||
 !id(r.id)||!id(r.accountId)||!id(r.contactId)||!id(r.pipelineId)||!id(r.stageId)||
 typeof r.title!=="string"||!NAME.test(r.title)||typeof r.stage!=="string"||!(DEAL_STAGES as readonly string[]).includes(r.stage)||
 typeof r.revision!=="number"||!Number.isSafeInteger(r.revision)||r.revision<0||r.revision>1000000||
 typeof r.createdAt!=="string"||!Number.isFinite(Date.parse(r.createdAt))||
 new Date(r.createdAt).toISOString()!==r.createdAt)throw new SalesDealError(503);
 return Object.freeze({id:r.id,title:r.title,accountId:r.accountId,contactId:r.contactId,pipelineId:r.pipelineId,stageId:r.stageId,stage:r.stage as DealStage,revision:r.revision,createdAt:r.createdAt});
}
export class P4R71CiDealsClient{
 constructor(private readonly base:string,private readonly token:()=>Promise<string>,
 private readonly fetcher:typeof fetch=fetch,private readonly env:NodeJS.ProcessEnv=process.env){this.guard();}
 private guard(){
  if(this.env.CI!=="true"||this.env.GITHUB_ACTIONS!=="true"||this.env.NODE_ENV==="production")throw new SalesDealError(503);
  let u:URL;try{u=new URL(this.base);}catch{throw new SalesDealError(503);}
  if(u.protocol!=="http:"||u.hostname!=="127.0.0.1"||!u.port||u.pathname!=="/"||u.search||u.hash||u.username||u.password)throw new SalesDealError(503);
 }
 private async request(org:string,suffix:string,method:string,body?:unknown):Promise<unknown>{
  this.guard();if(!UUID.test(org))throw new SalesDealError(400);
  const token=await this.token();if(!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)||token.length>10000)throw new SalesDealError(401);
  let r:Response;try{r=await this.fetcher(new URL("/_p4_r33_ci/sales/"+org+"/deals"+suffix,this.base),{
   method,headers:{Authorization:"Bearer "+token,Accept:"application/json",...(body===undefined?{}:{"Content-Type":"application/json"})},
   ...(body===undefined?{}:{body:JSON.stringify(body)}),redirect:"error",credentials:"omit",cache:"no-store",signal:AbortSignal.timeout(3000)});
  }catch{throw new SalesDealError(503);}
  if(r.headers.get("cache-control")!=="no-store, private"||r.headers.get("x-content-type-options")!=="nosniff")throw new SalesDealError(503);
  if(!r.ok)throw new SalesDealError([400,401,403,409,503].includes(r.status)?r.status:503);
  const envelope:unknown=await r.json();
  if(!envelope||typeof envelope!=="object"||Object.keys(envelope).sort().join(",")!=="data,scope"||(envelope as {scope?:unknown}).scope!=="disposable-ci-only")throw new SalesDealError(503);
  return (envelope as {data:unknown}).data;
 }
 async page(org:string,after:string|null=null):Promise<DealPage>{
  if(after!==null&&!UUID.test(after))throw new SalesDealError(400);
  const raw=await this.request(org,"?after="+encodeURIComponent(after??""),"GET");
  if(!raw||typeof raw!=="object"||Object.keys(raw).sort().join(",")!=="items,nextCursor")throw new SalesDealError(503);
  const p=raw as {items:unknown;nextCursor:unknown};
  if(!Array.isArray(p.items)||p.items.length>20)throw new SalesDealError(503);
  const items=p.items.map(parse);
  if(items.some((x,i)=>(i>0&&x.id<=items[i-1]!.id)||(after!==null&&x.id<=after))||
  (p.nextCursor!==null&&(items.length!==20||p.nextCursor!==items[19]!.id)))throw new SalesDealError(503);
  return {items,nextCursor:p.nextCursor as string|null};
 }
 async create(org:string,input:DealInput){return parse(await this.request(org,"","POST",input));}
 async changeStage(org:string,id:string,stage:DealStage,expectedRevision:number){
  if(!UUID.test(id)||stage==="OPEN")throw new SalesDealError(400);
  return parse(await this.request(org,"/"+id+"/stage","PATCH",{stage,expectedRevision}));
 }
}
