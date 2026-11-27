import {isStageOrgId} from "./staging-membership";
export type LeadSource="WEBSITE"|"REFERRAL"|"EVENT";
export type Lead={id:string;companyName:string;contactEmail:string;source:LeadSource;status:"NEW"|"CONTACTED"|"QUALIFIED"|"LOST"|"CONVERTED";revision:number};
export type LeadDraft={id:string;requestId:string;companyName:string;contactEmail:string;source:LeadSource};
export type LeadFilter={search:string;source:LeadSource|null;status:Lead["status"]|null};
export type LeadChange={requestId:string;expectedRevision:number}&({operation:"edit";companyName:string;contactEmail:string;source:LeadSource}|{operation:"transition";nextStatus:"CONTACTED"|"QUALIFIED"|"LOST"});
export type HistoryItem={action:"CREATED"|"EDITED"|"STAGE_CHANGED"|"ASSIGNED"|"CONVERTED";revision:number;previousStatus:Lead["status"]|null;nextStatus:Lead["status"]|null};
export type HistoryPage={items:HistoryItem[];nextCursor:number|null};
export function parseHistoryPage(x:unknown,after:number):HistoryPage{
 if(!exact(x,"items,nextCursor")||!Array.isArray(x.items)||x.items.length>20)return reject();
 let prior=after;
 const items=x.items.map((v:unknown):HistoryItem=>{
  if(!exact(v,"action,nextStatus,previousStatus,revision")||typeof v.revision!=="number"||!Number.isInteger(v.revision)||v.revision<=prior||v.revision>1000000)return reject();
  if(v.action==="CREATED"&&v.revision===0&&v.previousStatus===null&&v.nextStatus===null){prior=v.revision;return {action:v.action,revision:v.revision,previousStatus:null,nextStatus:null};}
  if((v.action==="EDITED"||v.action==="ASSIGNED")&&v.revision>0&&v.previousStatus===null&&v.nextStatus===null){prior=v.revision;return {action:v.action,revision:v.revision,previousStatus:null,nextStatus:null};}
  if(v.action==="STAGE_CHANGED"&&v.revision>0&&((v.previousStatus==="NEW"&&v.nextStatus==="CONTACTED")||(v.previousStatus==="CONTACTED"&&(v.nextStatus==="QUALIFIED"||v.nextStatus==="LOST")))){prior=v.revision;return {action:v.action,revision:v.revision,previousStatus:v.previousStatus,nextStatus:v.nextStatus};}
  if(v.action==="CONVERTED"&&v.revision>0&&v.previousStatus==="QUALIFIED"&&v.nextStatus==="CONVERTED"){prior=v.revision;return {action:v.action,revision:v.revision,previousStatus:v.previousStatus,nextStatus:v.nextStatus};}
  return reject();
 });
 if(x.nextCursor!==null&&(items.length!==20||x.nextCursor!==prior))return reject();
 return {items,nextCursor:x.nextCursor as number|null};
}
export type LeadAssignment={ownerId:string;requestId:string;expectedRevision:number};
export type AssignmentOptions={currentOwnerId:string;revision:number;items:string[];nextCursor:string|null};
export type DuplicateQuery={companyName:string;contactEmail:string;after:string|null};
export function parseAssignmentOptions(v:unknown,after:string|null):AssignmentOptions{
 if(!exact(v,"currentOwnerId,items,nextCursor,revision")||!isStageOrgId(v.currentOwnerId)||!Array.isArray(v.items)||v.items.length>20||typeof v.revision!=="number"||!Number.isInteger(v.revision)||v.revision<0||v.revision>1000000)return reject();
 let prior=after;
 const items=v.items.map(x=>{if(!isStageOrgId(x)||(prior!==null&&x<=prior))return reject();prior=x;return x;});
 if(v.nextCursor!==null&&(!isStageOrgId(v.nextCursor)||items.length!==20||v.nextCursor!==prior))return reject();
 return {currentOwnerId:v.currentOwnerId,revision:v.revision,items,nextCursor:v.nextCursor as string|null};
}
export type LeadPage={items:Lead[];nextCursor:string|null};
export class LeadClientError extends Error{constructor(readonly status:number){super("Lead request unavailable");}}
const exact=(x:unknown,k:string):x is Record<string,unknown>=>!!x&&typeof x==="object"&&!Array.isArray(x)&&Object.keys(x).sort().join(",")===k;
const reject=():never=>{throw new LeadClientError(503);};
export function parseLead(x:unknown):Lead{
 if(!exact(x,"companyName,contactEmail,id,revision,source,status")||!isStageOrgId(x.id)||
 typeof x.companyName!=="string"||!/^Demo [A-Za-z][A-Za-z0-9 &.-]{2,48}$/.test(x.companyName)||
 typeof x.contactEmail!=="string"||!/^[a-z][a-z0-9._-]{1,40}@example[.]com$/.test(x.contactEmail)||
 (x.source!=="WEBSITE"&&x.source!=="REFERRAL"&&x.source!=="EVENT")||
 (x.status!=="NEW"&&x.status!=="CONTACTED"&&x.status!=="QUALIFIED"&&x.status!=="LOST"&&x.status!=="CONVERTED")||
 typeof x.revision!=="number"||!Number.isInteger(x.revision)||x.revision<0||x.revision>1000000)return reject();
 return {id:x.id,companyName:x.companyName,contactEmail:x.contactEmail,source:x.source,status:x.status,revision:x.revision};
}
export function parseLeadPage(x:unknown,after:string|null):LeadPage{
 if(!exact(x,"items,nextCursor")||!Array.isArray(x.items)||x.items.length>20)return reject();
 let prior=after;const items=x.items.map(v=>{const row=parseLead(v);if(prior!==null&&row.id<=prior)return reject();prior=row.id;return row;});
 if(x.nextCursor!==null&&(!isStageOrgId(x.nextCursor)||items.length!==20||x.nextCursor!==prior))return reject();
 return {items,nextCursor:x.nextCursor as string|null};
}
export function createP5LeadClient(request:typeof fetch=(url,options)=>fetch(url,options)){
 async function call(org:string,path:string,body?:LeadDraft|LeadChange|LeadAssignment|DuplicateQuery,method: "POST"|"PATCH"="POST"){
  if(!isStageOrgId(org))throw new LeadClientError(400);
  const r=await request("/api/p5/"+org+"/crm/leads"+path,{method:body?method:"GET",headers:{"X-P5-Leads":"1",Accept:"application/json",...(body?{"Content-Type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{}),credentials:"same-origin",cache:"no-store",redirect:"error",signal:AbortSignal.timeout(8000)});
  if(!r.ok)throw new LeadClientError(r.status);
  if(!r.headers.get("content-type")?.includes("application/json"))return reject();
  const reader=r.body?.getReader();if(!reader)return reject();
  const parts:Uint8Array[]=[];let bytes=0;
  try{for(;;){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>8192){await reader.cancel();return reject();}parts.push(part.value);}}finally{reader.releaseLock();}
  const joined=new Uint8Array(bytes);let offset=0;for(const part of parts){joined.set(part,offset);offset+=part.length;}
  const x:unknown=JSON.parse(new TextDecoder().decode(joined));
  if(!exact(x,"applicationAccess,data,scope")||x.applicationAccess!==false||x.scope!=="p5-synthetic")return reject();
  return {data:x.data,status:r.status};
 }
 return {
  async list(org:string,after:string|null=null,filter:LeadFilter={search:"",source:null,status:null}){
   if(after!==null&&!isStageOrgId(after))throw new LeadClientError(400);
   const query=new URLSearchParams();if(after)query.set("after",after);if(filter.search)query.set("search",filter.search);if(filter.source)query.set("source",filter.source);if(filter.status)query.set("status",filter.status);
   const r=await call(org,query.size?"?"+query.toString():"");if(r.status!==200)return reject();return parseLeadPage(r.data,after);},
  async detail(org:string,id:string){if(!isStageOrgId(id))throw new LeadClientError(400);const r=await call(org,"/"+id);const lead=parseLead(r.data);if(r.status!==200||lead.id!==id)return reject();return lead;},
  async assignmentOptions(org:string,id:string,after:string|null=null){
   if(!isStageOrgId(id)||(after!==null&&!isStageOrgId(after)))throw new LeadClientError(400);
   const r=await call(org,"/"+id+"/assignees"+(after?"?after="+encodeURIComponent(after):""));if(r.status!==200)return reject();return parseAssignmentOptions(r.data,after);
  },
  async assign(org:string,id:string,cmd:LeadAssignment){
   if(!isStageOrgId(id)||!isStageOrgId(cmd.ownerId))throw new LeadClientError(400);
   const r=await call(org,"/"+id+"/assign",cmd);if(r.status!==200||!exact(r.data,"lead,outcome")||(r.data.outcome!=="applied"&&r.data.outcome!=="replay"))return reject();
   const lead=parseLead(r.data.lead);if(lead.id!==id)return reject();return lead;
  },
  async duplicates(org:string,query:DuplicateQuery){const r=await call(org,"/duplicate-review",query);if(r.status!==200)return reject();return parseLeadPage(r.data,query.after);},
  async change(org:string,id:string,cmd:LeadChange){
   if(!isStageOrgId(id))throw new LeadClientError(400);
   const r=await call(org,"/"+id,cmd,"PATCH");if(r.status!==200||!exact(r.data,"lead,outcome")||(r.data.outcome!=="applied"&&r.data.outcome!=="replay"))return reject();
   const lead=parseLead(r.data.lead);if(lead.id!==id)return reject();return lead;
  },
  async history(org:string,id:string,after=-1){if(!isStageOrgId(id)||!Number.isInteger(after)||after< -1||after>1000000)throw new LeadClientError(400);const r=await call(org,"/"+id+"/history?after="+after);if(r.status!==200)return reject();return parseHistoryPage(r.data,after);},
  async create(org:string,draft:LeadDraft){const r=await call(org,"",draft);if(!exact(r.data,"lead,outcome")||!((r.data.outcome==="created"&&r.status===201)||(r.data.outcome==="replay"&&r.status===200)))return reject();const lead=parseLead(r.data.lead);if(lead.id!==draft.id)return reject();return lead;}
 };
}
export type LeadClient=ReturnType<typeof createP5LeadClient>;
