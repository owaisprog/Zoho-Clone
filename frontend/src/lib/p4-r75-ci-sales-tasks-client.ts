export type Task=Readonly<{id:string;parentKind:"LEAD"|"ACCOUNT"|"DEAL";parentId:string;title:string;dueDate:string;status:"OPEN"|"COMPLETED";revision:number;assignee:string}>;
export type TaskInput=Readonly<{parentKind:Task["parentKind"];parentId:string;title:string;dueDate:string;assignee:string}>;
export type TaskChange=Readonly<{action:"RESCHEDULED"|"COMPLETED";dueDate:string|null;expectedRevision:number}>;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const USER=/^user_demo_[a-z]{2,16}$/;
const TITLE=/^Demo [A-Za-z][A-Za-z0-9 &.-]{2,148}$/;
const valid=(v:unknown,re:RegExp):v is string=>typeof v==="string"&&re.test(v);
const id=(v:unknown):v is string=>valid(v,UUID);
const date=(v:unknown):v is string=>typeof v==="string"&&/^\d{4}-\d\d-\d\d$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v&&v>="2020-01-01"&&v<="2100-12-31";
const version=(v:unknown):v is number=>typeof v==="number"&&Number.isSafeInteger(v)&&v>=0&&v<1000000;
export type TaskPage=Readonly<{items:readonly Task[];nextCursor:string|null}>;
export class SalesTaskError extends Error{constructor(public readonly status:number){super("TASK_REQUEST_FAILED");}}
const invalid=():never=>{throw new SalesTaskError(503);};
function parseTask(raw:unknown):Task{
 if(!raw||typeof raw!=="object"||Array.isArray(raw))return invalid();
 const v=raw as Record<string,unknown>;
 if(Object.keys(v).sort().join(",")!=="assignee,dueDate,id,parentId,parentKind,revision,status,title"||
 !id(v.id)||!id(v.parentId)||!["LEAD","ACCOUNT","DEAL"].includes(v.parentKind as string)||
 !valid(v.title,TITLE)||!date(v.dueDate)||!["OPEN","COMPLETED"].includes(v.status as string)||
 typeof v.revision!=="number"||!Number.isSafeInteger(v.revision)||v.revision<0||v.revision>1000000||!valid(v.assignee,USER))return invalid();
 return Object.freeze(v as Task);
}
export class P4R75CiSalesTasksClient{
 constructor(private readonly base:string,private readonly token:()=>Promise<string>,
 private readonly fetcher:typeof fetch=fetch,private readonly env:NodeJS.ProcessEnv=process.env){this.guard();}
 private guard(){
  if(this.env.CI!=="true"||this.env.GITHUB_ACTIONS!=="true"||this.env.NODE_ENV==="production")throw new SalesTaskError(503);
  let u:URL;try{u=new URL(this.base);}catch{throw new SalesTaskError(503);}
  if(u.protocol!=="http:"||u.hostname!=="127.0.0.1"||!u.port||u.pathname!=="/"||u.search||u.hash||u.username||u.password)throw new SalesTaskError(503);
 }
 private async request(org:string,suffix:string,method:string,body?:unknown):Promise<unknown>{
  this.guard();if(!UUID.test(org))throw new SalesTaskError(400);
  const token=await this.token();if(!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)||token.length>10000)throw new SalesTaskError(401);
  let r:Response;try{r=await this.fetcher(new URL("/_p4_r33_ci/sales/"+org+"/tasks"+suffix,this.base),{
   method,headers:{Authorization:"Bearer "+token,Accept:"application/json",...(body===undefined?{}:{"Content-Type":"application/json"})},
   ...(body===undefined?{}:{body:JSON.stringify(body)}),redirect:"error",credentials:"omit",cache:"no-store",signal:AbortSignal.timeout(3000)});
  }catch{throw new SalesTaskError(503);}
  if(r.headers.get("cache-control")!=="no-store, private"||r.headers.get("x-content-type-options")!=="nosniff")throw new SalesTaskError(503);
  if(!r.ok)throw new SalesTaskError([400,401,403,409,503].includes(r.status)?r.status:503);
  const envelope:unknown=await r.json();
  if(!envelope||typeof envelope!=="object"||Object.keys(envelope).sort().join(",")!=="data,scope"||(envelope as {scope?:unknown}).scope!=="disposable-ci-only")throw new SalesTaskError(503);
  return (envelope as {data:unknown}).data;
 }
 async page(org:string,after:string|null=null):Promise<TaskPage>{
  if(after!==null&&!UUID.test(after))throw new SalesTaskError(400);
  const raw=await this.request(org,"?after="+encodeURIComponent(after??""),"GET");
  if(!raw||typeof raw!=="object"||Object.keys(raw).sort().join(",")!=="items,nextCursor")throw new SalesTaskError(503);
  const p=raw as {items:unknown;nextCursor:unknown};
  if(!Array.isArray(p.items)||p.items.length>20)throw new SalesTaskError(503);
  const items=p.items.map(parseTask);
  if(items.some((x,i)=>(i>0&&x.id<=items[i-1]!.id)||(after!==null&&x.id<=after))||
  (p.nextCursor!==null&&(items.length!==20||p.nextCursor!==items[19]!.id)))throw new SalesTaskError(503);
  return {items,nextCursor:p.nextCursor as string|null};
 }
 async create(org:string,input:TaskInput){return parseTask(await this.request(org,"","POST",input));}
 async change(org:string,id:string,input:TaskChange){if(!UUID.test(id))throw new SalesTaskError(400);return parseTask(await this.request(org,"/"+id,"PATCH",input));}
}
