export type WorkKind="DEAL"|"TASK";
export type WorkRow=Readonly<{id:string;label:string;status:string;owner:string;revision:number;parentId:string|null;dueDate:string|null}>;
export type WorkPage=Readonly<{items:readonly WorkRow[];nextCursor:string|null}>;
export type TaskCreate=Readonly<{team:string;dealId:string;title:string;dueDate:string;assignee:string}>;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const USER=/^user_demo_[a-z]{2,16}$/;
const TEAM=/^team_demo_[a-z]{2,24}$/;
const LABEL=/^Demo [A-Za-z][A-Za-z0-9 &.-]{2,148}$/;
const NEXT=["DISCOVERY","PROPOSAL","NEGOTIATION","WON","LOST"];
const valid=(v:unknown,re:RegExp):v is string=>typeof v==="string"&&re.test(v);
const id=(v:unknown):v is string=>valid(v,UUID);
const date=(v:unknown):v is string=>typeof v==="string"&&/^\d{4}-\d\d-\d\d$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v&&v>="2020-01-01"&&v<="2100-12-31";
const version=(v:unknown):v is number=>typeof v==="number"&&Number.isSafeInteger(v)&&v>=0&&v<1000000;
const object=(v:unknown,keys:string):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v)&&Object.keys(v).sort().join(",")===keys;
function parseRow(v:unknown,k:WorkKind):WorkRow{
 if(!object(v,"dueDate,id,label,owner,parentId,revision,status")||!id(v.id)||!valid(v.label,LABEL)||!valid(v.owner,USER)||typeof v.revision!=="number"||!Number.isSafeInteger(v.revision)||v.revision<0||v.revision>1000000||
 (k==="DEAL"?v.parentId!==null||v.dueDate!==null||!["OPEN",...NEXT].includes(v.status as string):!id(v.parentId)||!date(v.dueDate)||!["OPEN","COMPLETED"].includes(v.status as string)))return invalid();
 return v as WorkRow;
}
function parseMembers(v:unknown):readonly string[]{if(!Array.isArray(v)||v.length>100||!v.every(x=>valid(x,USER))||v.some((x,i)=>i>0&&x<=v[i-1]))return invalid();return v;}
function parsePage(v:unknown,k:WorkKind,after:string|null):WorkPage{
 if(!object(v,"items,nextCursor")||!Array.isArray(v.items)||v.items.length>20)return invalid();
 const items=v.items.map(x=>parseRow(x,k));if(items.some((x,i)=>(i>0&&x.id<=items[i-1]!.id)||(after!==null&&x.id<=after))||(v.nextCursor!==null&&(items.length!==20||v.nextCursor!==items[19]!.id)))return invalid();return {items,nextCursor:v.nextCursor as string|null};
}
export class ManagerWorkError extends Error{constructor(public readonly status:number){super("MANAGER_WORK_REQUEST_FAILED");}}
const invalid=():never=>{throw new ManagerWorkError(503);};
export class P4R78CiManagerWorkClient{
 constructor(private readonly base:string,private readonly token:()=>Promise<string>,
 private readonly fetcher:typeof fetch=fetch,private readonly env:NodeJS.ProcessEnv=process.env){this.guard();}
 private guard(){
  if(this.env.CI!=="true"||this.env.GITHUB_ACTIONS!=="true"||this.env.NODE_ENV==="production")throw new ManagerWorkError(503);
  let u:URL;try{u=new URL(this.base);}catch{throw new ManagerWorkError(503);}
  if(u.protocol!=="http:"||u.hostname!=="127.0.0.1"||!u.port||u.pathname!=="/"||u.search||u.hash||u.username||u.password)throw new ManagerWorkError(503);
 }
 private async request(org:string,suffix:string,method:string,body?:unknown):Promise<unknown>{
  this.guard();if(!UUID.test(org))throw new ManagerWorkError(400);
  const token=await this.token();if(!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)||token.length>10000)throw new ManagerWorkError(401);
  let r:Response;try{r=await this.fetcher(new URL("/_p4_r33_ci/sales/"+org+suffix,this.base),{
   method,headers:{Authorization:"Bearer "+token,Accept:"application/json",...(body===undefined?{}:{"Content-Type":"application/json"})},
   ...(body===undefined?{}:{body:JSON.stringify(body)}),redirect:"error",credentials:"omit",cache:"no-store",signal:AbortSignal.timeout(3000)});
  }catch{throw new ManagerWorkError(503);}
  if(r.headers.get("cache-control")!=="no-store, private"||r.headers.get("x-content-type-options")!=="nosniff")throw new ManagerWorkError(503);
  if(!r.ok)throw new ManagerWorkError([400,401,403,409,503].includes(r.status)?r.status:503);
  const envelope:unknown=await r.json();
  if(!envelope||typeof envelope!=="object"||Object.keys(envelope).sort().join(",")!=="data,scope"||(envelope as {scope?:unknown}).scope!=="disposable-ci-only")throw new ManagerWorkError(503);
  return (envelope as {data:unknown}).data;
 }
 async members(org:string,team:string){return parseMembers(await this.request(org,"/manager-members?"+new URLSearchParams({team}),"GET"));}
 async work(org:string,team:string,kind:WorkKind,after:string|null=null){return parsePage(await this.request(org,"/manager-work?"+new URLSearchParams({team,kind,after:after??""}),"GET"),kind,after);}
 async create(org:string,input:TaskCreate){return parseRow(await this.request(org,"/manager-tasks","POST",input),"TASK");}
 async reassign(org:string,task:string,team:string,assignee:string,expectedRevision:number){if(!id(task))throw new ManagerWorkError(400);return parseRow(await this.request(org,"/manager-tasks/"+task,"PATCH",{team,assignee,expectedRevision}),"TASK");}
 async stage(org:string,deal:string,team:string,stage:string,expectedRevision:number){if(!id(deal))throw new ManagerWorkError(400);const v=await this.request(org,"/manager-deals/"+deal+"/stage","PATCH",{team,stage,expectedRevision});if(!object(v,"id,revision,stage")||v.id!==deal||v.stage!==stage||v.revision!==expectedRevision+1)return invalid();return {id:deal,stage,revision:expectedRevision+1};}
}
