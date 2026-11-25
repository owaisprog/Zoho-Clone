export const SEARCH_KINDS=["LEAD","ACCOUNT","CONTACT","DEAL","TASK"] as const;
export type SearchKind=typeof SEARCH_KINDS[number];
export const SEARCH_STATUSES:Readonly<Record<SearchKind,readonly string[]>>={LEAD:["NEW","CONTACTED","QUALIFIED","LOST","CONVERTED"],ACCOUNT:[],CONTACT:[],DEAL:["OPEN","DISCOVERY","PROPOSAL","NEGOTIATION","WON","LOST"],TASK:["OPEN","COMPLETED"]};
export type SearchQuery=Readonly<{kind:SearchKind;q:string;status:string;after:string|null}>;
export type SearchRecord=Readonly<{id:string;label:string;status:string|null}>;
export type SearchPage=Readonly<{actorId:string;items:readonly SearchRecord[];nextCursor:string|null}>;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const USER=/^user_demo_[a-z]{2,16}$/;
const LABEL=/^Demo [A-Za-z][A-Za-z0-9 &.-]{2,148}$/;
const Q=/^[A-Za-z0-9 .&-]{0,64}$/;
const valid=(v:unknown,re:RegExp):v is string=>typeof v==="string"&&re.test(v);
const id=(v:unknown):v is string=>valid(v,UUID);
const kind=(v:unknown):v is SearchKind=>typeof v==="string"&&(SEARCH_KINDS as readonly string[]).includes(v);
function parseRow(raw:unknown,k:SearchKind,q:string,s:string):SearchRecord{
 if(!raw||typeof raw!=="object"||Array.isArray(raw)||Object.keys(raw).sort().join(",")!=="id,label,status")return invalid();
 const v=raw as Record<string,unknown>;
 if(!id(v.id)||!valid(v.label,LABEL)||!v.label.toLowerCase().includes(q.toLowerCase())||
 (SEARCH_STATUSES[k].length===0?v.status!==null:typeof v.status!=="string"||!SEARCH_STATUSES[k].includes(v.status))||
 (s!==""&&v.status!==s))return invalid();
 return {id:v.id,label:v.label,status:v.status as string|null};
}
export class SearchError extends Error{constructor(public readonly status:number){super("SEARCH_REQUEST_FAILED");}}
const invalid=():never=>{throw new SearchError(503);};
export class P4R77CiSearchClient{
 constructor(private readonly base:string,private readonly token:()=>Promise<string>,
 private readonly fetcher:typeof fetch=fetch,private readonly env:NodeJS.ProcessEnv=process.env){this.guard();}
 private guard(){
  if(this.env.CI!=="true"||this.env.GITHUB_ACTIONS!=="true"||this.env.NODE_ENV==="production")throw new SearchError(503);
  let u:URL;try{u=new URL(this.base);}catch{throw new SearchError(503);}
  if(u.protocol!=="http:"||u.hostname!=="127.0.0.1"||!u.port||u.pathname!=="/"||u.search||u.hash||u.username||u.password)throw new SearchError(503);
 }
 private async request(org:string,suffix:string,method:string,body?:unknown):Promise<unknown>{
  this.guard();if(!UUID.test(org))throw new SearchError(400);
  const token=await this.token();if(!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)||token.length>10000)throw new SearchError(401);
  let r:Response;try{r=await this.fetcher(new URL("/_p4_r33_ci/sales/"+org+suffix,this.base),{
   method,headers:{Authorization:"Bearer "+token,Accept:"application/json",...(body===undefined?{}:{"Content-Type":"application/json"})},
   ...(body===undefined?{}:{body:JSON.stringify(body)}),redirect:"error",credentials:"omit",cache:"no-store",signal:AbortSignal.timeout(3000)});
  }catch{throw new SearchError(503);}
  if(r.headers.get("cache-control")!=="no-store, private"||r.headers.get("x-content-type-options")!=="nosniff")throw new SearchError(503);
  if(!r.ok)throw new SearchError([400,401,403,409,503].includes(r.status)?r.status:503);
  const envelope:unknown=await r.json();
  if(!envelope||typeof envelope!=="object"||Object.keys(envelope).sort().join(",")!=="data,scope"||(envelope as {scope?:unknown}).scope!=="disposable-ci-only")throw new SearchError(503);
  return (envelope as {data:unknown}).data;
 }
 async search(org:string,q:SearchQuery):Promise<SearchPage>{
 if(!kind(q.kind)||!valid(q.q,Q)||typeof q.status!=="string"||(q.status!==""&&!SEARCH_STATUSES[q.kind].includes(q.status))||(q.after!==null&&!id(q.after)))throw new SearchError(400);
 const raw=await this.request(org,"/search?"+new URLSearchParams({kind:q.kind,q:q.q,status:q.status,after:q.after??""}),"GET");
 if(!raw||typeof raw!=="object"||Array.isArray(raw)||Object.keys(raw).sort().join(",")!=="actorId,items,nextCursor")return invalid();
 const v=raw as Record<string,unknown>;if(!valid(v.actorId,USER)||!Array.isArray(v.items)||v.items.length>20)return invalid();
 const items=v.items.map(x=>parseRow(x,q.kind,q.q,q.status));
 if(items.some((x,i)=>(i>0&&x.id<=items[i-1]!.id)||(q.after!==null&&x.id<=q.after))||(v.nextCursor!==null&&(items.length!==20||v.nextCursor!==items[19]!.id)))return invalid();
 return {actorId:v.actorId,items,nextCursor:v.nextCursor as string|null};
 }
}
