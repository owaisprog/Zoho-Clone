import {CiP5Activities} from "./p5-ci-activities.js";
import {LeadError} from "./p5-ci-leads.js";
import {isCanonicalUuidV4} from "./p4-approved-uuid.js";
import type {StageIdentity} from "./staging-membership-db.js";
const exact=(v:unknown,k:string):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v)&&Object.keys(v).sort().join(",")===k;
export function validDueDate(v:unknown):v is string{
 if(typeof v!=="string"||!/^20[0-9]{2}-[0-9]{2}-[0-9]{2}$/.test(v))return false;
 const d=new Date(v+"T00:00:00Z");return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===v;
}
const revision=(v:unknown):v is number=>typeof v==="number"&&Number.isInteger(v)&&v>=0&&v<=1000000;

export function parseFollowup(v:unknown){
 if(!exact(v,"activityId,completed,dealId,dueDate,revision,title")||!isCanonicalUuidV4(v.activityId)||!isCanonicalUuidV4(v.dealId)||!validDueDate(v.dueDate)||!revision(v.revision)||typeof v.completed!=="boolean"||typeof v.title!=="string"||!/^Demo [A-Za-z][A-Za-z0-9 &.-]{2,74}$/.test(v.title))throw new LeadError(503);
 return {activityId:v.activityId,dealId:v.dealId,dueDate:v.dueDate,revision:v.revision,completed:v.completed,title:v.title};
}
export class CiP5Followups extends CiP5Activities{
 async followups(x:StageIdentity,org:string,after:unknown,due:unknown){
 const args=this.scope(x,org);if((after!==null&&!isCanonicalUuidV4(after))||typeof due!=="boolean")throw new LeadError(400);
 return this.transaction(false,async c=>{const data:unknown=(await c.query("SELECT p5_ci.read_followups($1,$2,$3,$4,$5) AS data",[...args,after,due])).rows[0]?.data;
 if(!Array.isArray(data)||data.length>21)throw new LeadError(503);
 let prior=after;const items=data.map(v=>{const row=parseFollowup(v);if((prior!==null&&row.activityId<=prior)||(due&&row.completed))throw new LeadError(503);prior=row.activityId;return row;});
 return {items:items.slice(0,20),nextCursor:items.length===21?items[19]!.activityId:null};});
 }
 async schedule(x:StageIdentity,org:string,id:unknown,raw:unknown){
 const args=this.scope(x,org);if(!isCanonicalUuidV4(id)||!exact(raw,"dueDate,expectedRevision")||!validDueDate(raw.dueDate)||typeof raw.expectedRevision!=="number"||!Number.isInteger(raw.expectedRevision)||raw.expectedRevision< -1||raw.expectedRevision>=1000000)throw new LeadError(400);
 return this.transaction(true,async c=>{const row=parseFollowup((await c.query("SELECT p5_ci.write_followup($1,$2,$3,$4,$5,$6) AS data",[...args,id,raw.dueDate,raw.expectedRevision])).rows[0]?.data);
 if(row.activityId!==id||row.dueDate!==raw.dueDate||row.revision!==Number(raw.expectedRevision)+1||row.completed)throw new LeadError(503);return row;});
 }
}
