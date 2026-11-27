import {createP5RecordTransport} from "./p5-accounts-client";
import {isStageOrgId as uuid} from "./staging-membership";
import {LeadClientError} from "./p5-leads-client";
import {parseContact} from "./p5-contacts-client";
const reject=():never=>{throw new LeadClientError(503);};
const exact=(v:unknown,k:string):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v)&&Object.keys(v).sort().join(",")===k;
const email=(v:unknown):v is string=>typeof v==="string"&&/^[a-z][a-z0-9._-]{1,40}@example[.]com$/.test(v);
const count=(v:unknown):v is number=>typeof v==="number"&&Number.isSafeInteger(v)&&v>=0;
const revision=(v:unknown):v is number=>count(v)&&v<=1000000;
export type MergeCommand={sourceId:string;targetId:string;requestId:string;sourceRevision:number;targetRevision:number};
const command=(v:unknown):v is MergeCommand=>exact(v,"requestId,sourceId,sourceRevision,targetId,targetRevision")&&uuid(v.sourceId)&&uuid(v.targetId)&&v.sourceId!==v.targetId&&uuid(v.requestId)&&revision(v.sourceRevision)&&revision(v.targetRevision);
export function parsePreview(v:unknown,source:string,target:string){
 if(!exact(v,"dealCount,eligible,source,target")||!count(v.dealCount)||typeof v.eligible!=="boolean")return reject();
 const a=parseContact(v.source),b=parseContact(v.target);
 if(a.id!==source||b.id!==target||a.id===b.id||a.email!==b.email||(v.eligible&&(a.accountId===null||a.accountId!==b.accountId)))return reject();
 return {source:a,target:b,dealCount:v.dealCount,eligible:v.eligible};
}
export function parseReceipt(v:unknown,source:string,target:string){
 if(!exact(v,"dealCount,sourceId,targetId")||v.sourceId!==source||v.targetId!==target||!count(v.dealCount))return reject();
 return {sourceId:source,targetId:target,dealCount:v.dealCount};
}
function parseMatches(v:unknown,e:string){
 if(!Array.isArray(v)||v.length>21)return reject();let prior:string|null=null;
 return v.map(x=>{const row=parseContact(x);if(row.email!==e||(prior!==null&&row.id<=prior))return reject();prior=row.id;return row;});
}

export function createP5DuplicateClient(request:typeof fetch=(u,o)=>fetch(u,o)){
 const duplicates=createP5RecordTransport("duplicates",request),merge=createP5RecordTransport("merge",request);
 return {
 async list(org:string,e:string){
 if(!email(e))throw new LeadClientError(400);const r=await duplicates(org,"?email="+encodeURIComponent(e));
 if(r.status!==200||!exact(r.data,"items,truncated")||typeof r.data.truncated!=="boolean")return reject();
 const items=parseMatches(r.data.items,e);if(items.length>20||(r.data.truncated&&items.length!==20))return reject();return {items,truncated:r.data.truncated};
 },
 async preview(org:string,source:string,target:string){
 if(!uuid(source)||!uuid(target)||source===target)throw new LeadClientError(400);
 const r=await merge(org,"?"+new URLSearchParams({source,target}));if(r.status!==200)return reject();return parsePreview(r.data,source,target);
 },
 async merge(org:string,cmd:MergeCommand){
 if(!command(cmd))throw new LeadClientError(400);const r=await merge(org,"",cmd);if(r.status!==200)return reject();return parseReceipt(r.data,cmd.sourceId,cmd.targetId);
 }
 };
}
export type DuplicateClient=ReturnType<typeof createP5DuplicateClient>;
export type Preview=ReturnType<typeof parsePreview>;
