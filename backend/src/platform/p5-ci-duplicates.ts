import {CiP5SearchViews} from "./p5-ci-search-views.js";
import {LeadError} from "./p5-ci-leads.js";
import {parseContact} from "./p5-ci-contacts.js";
import {isCanonicalUuidV4 as uuid} from "./p4-approved-uuid.js";
import type {StageIdentity} from "./staging-membership-db.js";
const reject=():never=>{throw new LeadError(503);};
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

export class CiP5Duplicates extends CiP5SearchViews{
 async contactDuplicates(x:StageIdentity,org:string,e:unknown){
 const args=this.scope(x,org);if(!email(e))throw new LeadError(400);
 return this.transaction(false,async c=>{const rows=parseMatches((await c.query("SELECT p5_ci.read_duplicates($1,$2,$3,$4) AS data",[...args,e])).rows[0]?.data,e);return {items:rows.slice(0,20),truncated:rows.length===21};});
 }
 async mergePreview(x:StageIdentity,org:string,source:unknown,target:unknown){
 const args=this.scope(x,org);if(!uuid(source)||!uuid(target)||source===target)throw new LeadError(400);
 return this.transaction(false,async c=>parsePreview((await c.query("SELECT p5_ci.preview_merge($1,$2,$3,$4,$5) AS data",[...args,source,target])).rows[0]?.data,source,target));
 }
 async mergeContacts(x:StageIdentity,org:string,raw:unknown){
 const args=this.scope(x,org);if(!command(raw))throw new LeadError(400);
 return this.transaction(true,async c=>parseReceipt((await c.query("SELECT p5_ci.apply_merge($1,$2,$3,$4,$5,$6,$7,$8) AS data",[...args,raw.sourceId,raw.targetId,raw.requestId,raw.sourceRevision,raw.targetRevision])).rows[0]?.data,raw.sourceId,raw.targetId));
 }
}
