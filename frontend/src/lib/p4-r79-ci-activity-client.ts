export type HistoryKind="LEAD"|"ACCOUNT"|"CONTACT"|"DEAL"|"TASK";
export type HistoryEvent=Readonly<{revision:number;actor:string;action:string;occurredAt:string;beforeValue:string|null;afterValue:string|null}>;
export type HistoryPage=Readonly<{items:readonly HistoryEvent[];nextCursor:number|null}>;
export type WorkloadRow=Readonly<{owner:string;overdue:number;dueToday:number;upcoming:number;completed:number}>;
export type Workload=Readonly<{rows:readonly WorkloadRow[];total:number}>;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const USER=/^user_demo_[a-z]{2,16}$/;
const TEAM=/^team_demo_[a-z]{2,24}$/;
const valid=(v:unknown,re:RegExp):v is string=>typeof v==="string"&&re.test(v);
const id=(v:unknown):v is string=>valid(v,UUID);
const date=(v:unknown):v is string=>typeof v==="string"&&/^\d{4}-\d\d-\d\d$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v&&v>="2020-01-01"&&v<="2100-12-31";
const count=(v:unknown):v is number=>typeof v==="number"&&Number.isSafeInteger(v)&&v>=0;
const kind=(v:unknown):v is HistoryKind=>typeof v==="string"&&["LEAD","ACCOUNT","CONTACT","DEAL","TASK"].includes(v);
const object=(v:unknown,keys:string):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v)&&Object.keys(v).sort().join(",")===keys;
const status=["NEW","CONTACTED","QUALIFIED","LOST","CONVERTED","OPEN","DISCOVERY","PROPOSAL","NEGOTIATION","WON"];
const value=(v:unknown)=>v===null||date(v)||(typeof v==="string"&&status.includes(v));
function parseHistory(v:unknown,before:number|null):HistoryPage{
 if(!object(v,"items,nextCursor")||!Array.isArray(v.items)||v.items.length>20)return invalid();
 const items=v.items.map(x=>{if(!object(x,"action,actor,afterValue,beforeValue,occurredAt,revision")||!count(x.revision)||x.revision>1000000||!valid(x.actor,USER)||typeof x.action!=="string"||!["CREATED","UPDATED","STAGE_CHANGED","RESCHEDULED","COMPLETED","REASSIGNED"].includes(x.action)||typeof x.occurredAt!=="string"||!Number.isFinite(Date.parse(x.occurredAt))||new Date(x.occurredAt).toISOString()!==x.occurredAt||!value(x.beforeValue)||!value(x.afterValue))return invalid();return x as HistoryEvent;});
 if(items.some((x,i)=>(i>0&&x.revision>=items[i-1]!.revision)||(before!==null&&x.revision>=before))||(v.nextCursor!==null&&(items.length!==20||v.nextCursor!==items[19]!.revision)))return invalid();
 return {items,nextCursor:v.nextCursor as number|null};
}
function parseWorkload(v:unknown):Workload{
 if(!object(v,"rows,total")||!Array.isArray(v.rows)||v.rows.length>100||!count(v.total))return invalid();
 const rows=v.rows.map(x=>{if(!object(x,"completed,dueToday,overdue,owner,upcoming")||!valid(x.owner,USER)||![x.overdue,x.dueToday,x.upcoming,x.completed].every(count))return invalid();return x as WorkloadRow;});
 const total=rows.reduce((n,r)=>n+r.overdue+r.dueToday+r.upcoming+r.completed,0);
 if(total!==v.total||!Number.isSafeInteger(total)||rows.some((x,i)=>i>0&&x.owner<=rows[i-1]!.owner))return invalid();return {rows,total};
}
export class ActivityError extends Error{constructor(public readonly status:number){super("ACTIVITY_REQUEST_FAILED");}}
const invalid=():never=>{throw new ActivityError(503);};
export class P4R79CiActivityClient{
 constructor(private readonly base:string,private readonly token:()=>Promise<string>,
 private readonly fetcher:typeof fetch=fetch,private readonly env:NodeJS.ProcessEnv=process.env){this.guard();}
 private guard(){
  if(this.env.CI!=="true"||this.env.GITHUB_ACTIONS!=="true"||this.env.NODE_ENV==="production")throw new ActivityError(503);
  let u:URL;try{u=new URL(this.base);}catch{throw new ActivityError(503);}
  if(u.protocol!=="http:"||u.hostname!=="127.0.0.1"||!u.port||u.pathname!=="/"||u.search||u.hash||u.username||u.password)throw new ActivityError(503);
 }
 private async request(org:string,suffix:string,method:string,body?:unknown):Promise<unknown>{
  this.guard();if(!UUID.test(org))throw new ActivityError(400);
  const token=await this.token();if(!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)||token.length>10000)throw new ActivityError(401);
  let r:Response;try{r=await this.fetcher(new URL("/_p4_r33_ci/sales/"+org+suffix,this.base),{
   method,headers:{Authorization:"Bearer "+token,Accept:"application/json",...(body===undefined?{}:{"Content-Type":"application/json"})},
   ...(body===undefined?{}:{body:JSON.stringify(body)}),redirect:"error",credentials:"omit",cache:"no-store",signal:AbortSignal.timeout(3000)});
  }catch{throw new ActivityError(503);}
  if(r.headers.get("cache-control")!=="no-store, private"||r.headers.get("x-content-type-options")!=="nosniff")throw new ActivityError(503);
  if(!r.ok)throw new ActivityError([400,401,403,409,503].includes(r.status)?r.status:503);
  const envelope:unknown=await r.json();
  if(!envelope||typeof envelope!=="object"||Object.keys(envelope).sort().join(",")!=="data,scope"||(envelope as {scope?:unknown}).scope!=="disposable-ci-only")throw new ActivityError(503);
  return (envelope as {data:unknown}).data;
 }
 async history(org:string,k:HistoryKind,record:string,team="",before:number|null=null){
 if(!kind(k)||!id(record)||!(team===""||valid(team,TEAM))||(before!==null&&(!count(before)||before>1000001)))throw new ActivityError(400);
 return parseHistory(await this.request(org,"/activity?"+new URLSearchParams({kind:k,record,team,before:before===null?"":String(before)}),"GET"),before);
 }
 async workload(org:string,team:string,asOf:string,owner=""){
 if(!valid(team,TEAM)||!date(asOf)||!(owner===""||valid(owner,USER)))throw new ActivityError(400);
 const v=parseWorkload(await this.request(org,"/workload?"+new URLSearchParams({team,asOf,owner}),"GET"));
 if(owner!==""&&v.rows.some(x=>x.owner!==owner))return invalid();return v;
 }
}
