export type Kind="LEAD"|"ACCOUNT"|"CONTACT"|"DEAL";
export type Team=Readonly<{id:string;name:string}>;
export type Assignment=Readonly<{teamId:string;active:boolean;revision:number}>;
export type AssignmentInput=Readonly<{teamId:string;active:boolean;expectedRevision:number|null}>;
export type SharedRecord=Readonly<{id:string;label:string;status:string|null;owner:string}>;
export type SharedPage=Readonly<{items:readonly SharedRecord[];nextCursor:string|null}>;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const USER=/^user_demo_[a-z]{2,16}$/;
const TEAM=/^team_demo_[a-z]{2,24}$/;
const NAME=/^Demo [A-Za-z][A-Za-z0-9 &.-]{2,148}$/;
const valid=(v:unknown,re:RegExp):v is string=>typeof v==="string"&&re.test(v);
const id=(v:unknown):v is string=>valid(v,UUID);
const kind=(v:unknown):v is Kind=>typeof v==="string"&&["LEAD","ACCOUNT","CONTACT","DEAL"].includes(v);
const version=(v:unknown):v is number=>typeof v==="number"&&Number.isSafeInteger(v)&&v>=0&&v<1000000;
const record=(v:unknown,keys:string):Record<string,unknown>=>{if(!v||typeof v!=="object"||Array.isArray(v)||Object.keys(v).sort().join(",")!==keys)return invalid();return v as Record<string,unknown>;};
function parseAssignment(v:unknown):Assignment{const x=record(v,"active,revision,teamId");if(!valid(x.teamId,TEAM)||typeof x.active!=="boolean"||typeof x.revision!=="number"||!Number.isSafeInteger(x.revision)||x.revision<0||x.revision>1000000)return invalid();return {teamId:x.teamId,active:x.active,revision:x.revision};}
function parseTeams(v:unknown):readonly Team[]{if(!Array.isArray(v)||v.length>100)return invalid();const a=v.map(x=>{const r=record(x,"id,name");if(!valid(r.id,TEAM)||!valid(r.name,NAME))return invalid();return {id:r.id,name:r.name};});if(a.some((x,i)=>i>0&&x.id<=a[i-1]!.id))return invalid();return a;}
function parseShared(v:unknown):SharedRecord{const x=record(v,"id,label,owner,status");if(!id(x.id)||!valid(x.label,NAME)||!valid(x.owner,USER)||(x.status!==null&&(typeof x.status!=="string"||!["NEW","CONTACTED","QUALIFIED","LOST","CONVERTED","OPEN","DISCOVERY","PROPOSAL","NEGOTIATION","WON"].includes(x.status))))return invalid();return {id:x.id,label:x.label,owner:x.owner,status:x.status as string|null};}
export class SharingError extends Error{constructor(public readonly status:number){super("SHARING_REQUEST_FAILED");}}
const invalid=():never=>{throw new SharingError(503);};
export class P4R76CiSharingClient{
 constructor(private readonly base:string,private readonly token:()=>Promise<string>,
 private readonly fetcher:typeof fetch=fetch,private readonly env:NodeJS.ProcessEnv=process.env){this.guard();}
 private guard(){
  if(this.env.CI!=="true"||this.env.GITHUB_ACTIONS!=="true"||this.env.NODE_ENV==="production")throw new SharingError(503);
  let u:URL;try{u=new URL(this.base);}catch{throw new SharingError(503);}
  if(u.protocol!=="http:"||u.hostname!=="127.0.0.1"||!u.port||u.pathname!=="/"||u.search||u.hash||u.username||u.password)throw new SharingError(503);
 }
 private async request(org:string,suffix:string,method:string,body?:unknown):Promise<unknown>{
  this.guard();if(!UUID.test(org))throw new SharingError(400);
  const token=await this.token();if(!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)||token.length>10000)throw new SharingError(401);
  let r:Response;try{r=await this.fetcher(new URL("/_p4_r33_ci/sales/"+org+suffix,this.base),{
   method,headers:{Authorization:"Bearer "+token,Accept:"application/json",...(body===undefined?{}:{"Content-Type":"application/json"})},
   ...(body===undefined?{}:{body:JSON.stringify(body)}),redirect:"error",credentials:"omit",cache:"no-store",signal:AbortSignal.timeout(3000)});
  }catch{throw new SharingError(503);}
  if(r.headers.get("cache-control")!=="no-store, private"||r.headers.get("x-content-type-options")!=="nosniff")throw new SharingError(503);
  if(!r.ok)throw new SharingError([400,401,403,409,503].includes(r.status)?r.status:503);
  const envelope:unknown=await r.json();
  if(!envelope||typeof envelope!=="object"||Object.keys(envelope).sort().join(",")!=="data,scope"||(envelope as {scope?:unknown}).scope!=="disposable-ci-only")throw new SharingError(503);
  return (envelope as {data:unknown}).data;
 }
 async teams(org:string){return parseTeams(await this.request(org,"/share-teams","GET"));}
 async get(org:string,k:Kind,r:string){if(!kind(k)||!id(r))throw new SharingError(400);const v=await this.request(org,"/shares/"+k+"/"+r,"GET");return v===null?null:parseAssignment(v);}
 async set(org:string,k:Kind,r:string,input:AssignmentInput){if(!kind(k)||!id(r))throw new SharingError(400);return parseAssignment(await this.request(org,"/shares/"+k+"/"+r,"PATCH",input));}
 async shared(org:string,team:string,k:Kind,after:string|null=null):Promise<SharedPage>{if(!valid(team,TEAM)||!kind(k)||(after!==null&&!id(after)))throw new SharingError(400);const v=record(await this.request(org,"/shared-records?"+new URLSearchParams({team,kind:k,after:after??""}),"GET"),"items,nextCursor");if(!Array.isArray(v.items)||v.items.length>20)return invalid();const items=v.items.map(parseShared);if(items.some((x,i)=>(i>0&&x.id<=items[i-1]!.id)||(after!==null&&x.id<=after))||(v.nextCursor!==null&&(items.length!==20||v.nextCursor!==items[19]!.id)))return invalid();return {items,nextCursor:v.nextCursor as string|null};}
}
