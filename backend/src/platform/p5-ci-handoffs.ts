import {CiP5Mail} from "./p5-ci-mail.js";
import {LeadError} from "./p5-ci-leads.js";
import {isCanonicalUuidV4 as uuid} from "./p4-approved-uuid.js";
import type {StageIdentity} from "./staging-membership-db.js";
const reject=():never=>{throw new LeadError(503);};
const exact=(v:unknown,k:string):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v)&&Object.keys(v).sort().join(",")===k;
export type Step="REVIEW"|"CONTACT"|"PLAN";
const step=(v:unknown):v is Step=>v==="REVIEW"||v==="CONTACT"||v==="PLAN";
export type Handoff={dealId:string;accountId:string;title:string;reviewDone:boolean;contactDone:boolean;planDone:boolean;revision:number;status:"PENDING"|"IN_PROGRESS"|"READY"};
export function parseHandoff(v:unknown):Handoff{
 if(!exact(v,"accountId,contactDone,dealId,planDone,reviewDone,revision,status,title")||!uuid(v.dealId)||!uuid(v.accountId)||typeof v.title!=="string"||!/^Demo [A-Za-z][A-Za-z0-9 &.-]{2,74}$/.test(v.title)||typeof v.reviewDone!=="boolean"||typeof v.contactDone!=="boolean"||typeof v.planDone!=="boolean")return reject();
 const revision=Number(v.reviewDone)+Number(v.contactDone)+Number(v.planDone),status=revision===0?"PENDING":revision===3?"READY":"IN_PROGRESS";
 if(v.revision!==revision||v.status!==status)return reject();
 return {dealId:v.dealId,accountId:v.accountId,title:v.title,reviewDone:v.reviewDone,contactDone:v.contactDone,planDone:v.planDone,revision,status};
}
const validRevision=(v:unknown):v is number=>typeof v==="number"&&Number.isInteger(v)&&v>=0&&v<=2;
const completed=(row:Handoff,s:Step)=>s==="REVIEW"?row.reviewDone:s==="CONTACT"?row.contactDone:row.planDone;

export class CiP5Handoffs extends CiP5Mail{
 async handoffs(x:StageIdentity,org:string,after:unknown){
 const args=this.scope(x,org);if(after!==null&&!uuid(after))throw new LeadError(400);
 return this.transaction(false,async c=>{const data:unknown=(await c.query("SELECT p5_ci.read_handoffs($1,$2,$3,$4) AS data",[...args,after])).rows[0]?.data;
 if(!Array.isArray(data)||data.length>21)return reject();
 let prior:string|null=after;const items=data.map(v=>{const row=parseHandoff(v);if(prior!==null&&row.dealId<=prior)return reject();prior=row.dealId;return row;});
 return {items:items.slice(0,20),nextCursor:items.length===21?items[19]!.dealId:null};});
 }
 async completeHandoff(x:StageIdentity,org:string,deal:unknown,raw:unknown){
 const args=this.scope(x,org);if(!uuid(deal)||!exact(raw,"expectedRevision,step")||!step(raw.step)||!validRevision(raw.expectedRevision))throw new LeadError(400);
 const s=raw.step,revision=raw.expectedRevision;
 return this.transaction(true,async c=>{const row=parseHandoff((await c.query("SELECT p5_ci.complete_handoff($1,$2,$3,$4,$5,$6) AS data",[...args,deal,s,revision])).rows[0]?.data);
 if(row.dealId!==deal||row.revision!==revision+1||!completed(row,s))return reject();return row;});
 }
}
