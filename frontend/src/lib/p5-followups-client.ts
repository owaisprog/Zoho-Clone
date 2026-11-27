import {createP5RecordTransport} from "./p5-accounts-client";
import {isStageOrgId} from "./staging-membership";
import {LeadClientError} from "./p5-leads-client";
export type Followup={activityId:string;dealId:string;dueDate:string;revision:number;completed:boolean;title:string};
const exact=(v:unknown,k:string):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v)&&Object.keys(v).sort().join(",")===k;
export function validDueDate(v:unknown):v is string{
 if(typeof v!=="string"||!/^20[0-9]{2}-[0-9]{2}-[0-9]{2}$/.test(v))return false;
 const d=new Date(v+"T00:00:00Z");return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===v;
}
const reject=():never=>{throw new LeadClientError(503);};
export function parseFollowup(v:unknown):Followup{
 if(!exact(v,"activityId,completed,dealId,dueDate,revision,title")||!isStageOrgId(v.activityId)||!isStageOrgId(v.dealId)||!validDueDate(v.dueDate)||typeof v.revision!=="number"||!Number.isInteger(v.revision)||v.revision<0||v.revision>1000000||typeof v.completed!=="boolean"||typeof v.title!=="string"||!/^Demo [A-Za-z][A-Za-z0-9 &.-]{2,74}$/.test(v.title))return reject();
 return {activityId:v.activityId,dealId:v.dealId,dueDate:v.dueDate,revision:v.revision,completed:v.completed,title:v.title};
}
export function createP5FollowupClient(request:typeof fetch=(u,o)=>fetch(u,o)){
 const call=createP5RecordTransport("followups",request);
 return {
 async list(org:string,due:boolean,after:string|null=null){
 if(after!==null&&!isStageOrgId(after))throw new LeadClientError(400);
 const r=await call(org,"?due="+(due?"1":"0")+(after?"&after="+encodeURIComponent(after):""));
 if(r.status!==200||!exact(r.data,"items,nextCursor")||!Array.isArray(r.data.items)||r.data.items.length>20)return reject();
 let prior=after;const items=r.data.items.map(v=>{const row=parseFollowup(v);if((prior!==null&&row.activityId<=prior)||(due&&row.completed))return reject();prior=row.activityId;return row;});
 if(r.data.nextCursor!==null&&(!isStageOrgId(r.data.nextCursor)||items.length!==20||r.data.nextCursor!==prior))return reject();
 return {items,nextCursor:r.data.nextCursor as string|null};
 },
 async schedule(org:string,id:string,dueDate:string,expectedRevision:number){
 if(!isStageOrgId(id)||!validDueDate(dueDate)||!Number.isInteger(expectedRevision)||expectedRevision< -1||expectedRevision>=1000000)throw new LeadClientError(400);
 const r=await call(org,"/"+id,{dueDate,expectedRevision});const row=parseFollowup(r.data);
 if(r.status!==200||row.activityId!==id||row.dueDate!==dueDate||row.revision!==expectedRevision+1||row.completed)return reject();return row;
 }
 };
}
export type FollowupClient=ReturnType<typeof createP5FollowupClient>;
