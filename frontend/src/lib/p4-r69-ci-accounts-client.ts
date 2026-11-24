/** R69 strict synthetic localhost sales Accounts client. */
export type Account=Readonly<{id:string;name:string;websiteLabel:string|null;revision:number;createdAt:string}>;
export type AccountInput=Readonly<{name:string;websiteLabel:string|null}>;
export type AccountPage=Readonly<{items:readonly Account[];nextCursor:string|null}>;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const NAME=/^Demo [A-Za-z][A-Za-z0-9 &.-]{2,148}$/;
const WEB=/^https:\/\/[a-z0-9-]{1,63}\.example\.com$/;
export class SalesAccountError extends Error{constructor(public readonly status:number){super("ACCOUNT_REQUEST_FAILED");}}
function parse(raw:unknown):Account{
 if(!raw||typeof raw!=="object"||Array.isArray(raw))throw new SalesAccountError(503);
 const r=raw as Record<string,unknown>;
 if(Object.keys(r).sort().join(",")!=="createdAt,id,name,revision,websiteLabel"||
 typeof r.id!=="string"||!UUID.test(r.id)||typeof r.name!=="string"||!NAME.test(r.name)||
 (r.websiteLabel!==null&&(typeof r.websiteLabel!=="string"||!WEB.test(r.websiteLabel)))||
 typeof r.revision!=="number"||!Number.isSafeInteger(r.revision)||r.revision<0||r.revision>1000000||
 typeof r.createdAt!=="string"||!Number.isFinite(Date.parse(r.createdAt))||
 new Date(r.createdAt).toISOString()!==r.createdAt)throw new SalesAccountError(503);
 return Object.freeze({id:r.id,name:r.name,websiteLabel:r.websiteLabel,revision:r.revision,createdAt:r.createdAt});
}
export class P4R69CiAccountsClient{
 constructor(private readonly base:string,private readonly token:()=>Promise<string>,
 private readonly fetcher:typeof fetch=fetch,private readonly env:NodeJS.ProcessEnv=process.env){this.guard();}
 private guard(){
  if(this.env.CI!=="true"||this.env.GITHUB_ACTIONS!=="true"||this.env.NODE_ENV==="production")throw new SalesAccountError(503);
  let u:URL;try{u=new URL(this.base);}catch{throw new SalesAccountError(503);}
  if(u.protocol!=="http:"||u.hostname!=="127.0.0.1"||!u.port||u.pathname!=="/"||u.search||u.hash||u.username||u.password)throw new SalesAccountError(503);
 }
 private async request(org:string,suffix:string,method:string,body?:unknown):Promise<unknown>{
  this.guard();if(!UUID.test(org))throw new SalesAccountError(400);
  const token=await this.token();if(!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)||token.length>10000)throw new SalesAccountError(401);
  let r:Response;try{r=await this.fetcher(new URL("/_p4_r33_ci/sales/"+org+"/accounts"+suffix,this.base),{
   method,headers:{Authorization:"Bearer "+token,Accept:"application/json",...(body===undefined?{}:{"Content-Type":"application/json"})},
   ...(body===undefined?{}:{body:JSON.stringify(body)}),redirect:"error",credentials:"omit",cache:"no-store",signal:AbortSignal.timeout(3000)});
  }catch{throw new SalesAccountError(503);}
  if(r.headers.get("cache-control")!=="no-store, private"||r.headers.get("x-content-type-options")!=="nosniff")throw new SalesAccountError(503);
  if(!r.ok)throw new SalesAccountError([400,401,403,409,503].includes(r.status)?r.status:503);
  const envelope:unknown=await r.json();
  if(!envelope||typeof envelope!=="object"||Object.keys(envelope).sort().join(",")!=="data,scope"||(envelope as {scope?:unknown}).scope!=="disposable-ci-only")throw new SalesAccountError(503);
  return (envelope as {data:unknown}).data;
 }
 async page(org:string,after:string|null=null):Promise<AccountPage>{
  if(after!==null&&!UUID.test(after))throw new SalesAccountError(400);
  const raw=await this.request(org,"?after="+encodeURIComponent(after??""),"GET");
  if(!raw||typeof raw!=="object"||Object.keys(raw).sort().join(",")!=="items,nextCursor")throw new SalesAccountError(503);
  const p=raw as {items:unknown;nextCursor:unknown};
  if(!Array.isArray(p.items)||p.items.length>20)throw new SalesAccountError(503);
  const items=p.items.map(parse);
  if(items.some((x,i)=>(i>0&&x.id<=items[i-1]!.id)||(after!==null&&x.id<=after))||
  (p.nextCursor!==null&&(items.length!==20||p.nextCursor!==items[19]!.id)))throw new SalesAccountError(503);
  return {items,nextCursor:p.nextCursor as string|null};
 }
 async create(org:string,input:AccountInput){return parse(await this.request(org,"","POST",input));}
 async update(org:string,id:string,input:AccountInput,expectedRevision:number){
  if(!UUID.test(id))throw new SalesAccountError(400);
  return parse(await this.request(org,"/"+id,"PATCH",{...input,expectedRevision}));
 }
}
