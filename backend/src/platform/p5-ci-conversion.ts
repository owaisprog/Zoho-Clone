import {CiP5Contacts} from "./p5-ci-contacts.js";
import {LeadError} from "./p5-ci-leads.js";
import {isCanonicalUuidV4} from "./p4-approved-uuid.js";
import type {StageIdentity} from "./staging-membership-db.js";
const fail=(s:400|403|404|409|503):never=>{throw new LeadError(s);};
const exact=(x:unknown,k:string):x is Record<string,unknown>=>!!x&&typeof x==="object"&&!Array.isArray(x)&&Object.keys(x).sort().join(",")===k;
const name=(v:unknown):v is string=>typeof v==="string"&&/^Demo [A-Za-z][A-Za-z0-9 .-]{2,74}$/.test(v);
const title=(v:unknown):v is string=>typeof v==="string"&&/^Demo [A-Za-z][A-Za-z0-9 &.-]{2,74}$/.test(v);
const industry=(v:unknown)=>v==="SERVICES"||v==="RETAIL"||v==="TECHNOLOGY"||v==="OTHER";
export function parseConversion(x:unknown){
 if(!exact(x,"accountId,contactId,contactName,dealId,dealTitle,expectedRevision,industry,requestId")||!isCanonicalUuidV4(x.accountId)||!isCanonicalUuidV4(x.contactId)||!isCanonicalUuidV4(x.dealId)||!isCanonicalUuidV4(x.requestId)||!name(x.contactName)||!title(x.dealTitle)||!industry(x.industry)||typeof x.expectedRevision!=="number"||!Number.isInteger(x.expectedRevision)||x.expectedRevision<0||x.expectedRevision>=1000000)return fail(400);
 return x;
}
export function parseReceipt(x:unknown){
 if(!exact(x,"accountId,contactId,dealId,leadId,revision")||!isCanonicalUuidV4(x.accountId)||!isCanonicalUuidV4(x.contactId)||!isCanonicalUuidV4(x.dealId)||!isCanonicalUuidV4(x.leadId)||typeof x.revision!=="number"||!Number.isInteger(x.revision)||x.revision<1||x.revision>1000000)return fail(503);
 return {accountId:x.accountId,contactId:x.contactId,dealId:x.dealId,leadId:x.leadId,revision:x.revision};
}
export const DEAL_STAGES=["OPEN","DISCOVERY","PROPOSAL","NEGOTIATION","WON","LOST"] as const;
export type DealStage=string;
export const isDealStage=(x:unknown):x is DealStage=>typeof x==="string"&&/^[A-Z][A-Z0-9_]{0,23}$/.test(x);
export function parseDeal(x:unknown){
 if(!exact(x,"accountId,contactId,id,nextStages,pipelineId,revision,stage,title,valueCents")||!isCanonicalUuidV4(x.id)||!isCanonicalUuidV4(x.accountId)||!isCanonicalUuidV4(x.contactId)||!title(x.title)||!isCanonicalUuidV4(x.pipelineId)||!Array.isArray(x.nextStages)||x.nextStages.length>2||!x.nextStages.every(isDealStage)||new Set(x.nextStages).size!==x.nextStages.length||x.nextStages.includes(x.stage)||(x.stage==="WON"||x.stage==="LOST"?x.nextStages.length!==0:!x.nextStages.includes("LOST"))||!isDealStage(x.stage)||typeof x.revision!=="number"||!Number.isInteger(x.revision)||x.revision<0||x.revision>1000000||typeof x.valueCents!=="number"||!Number.isInteger(x.valueCents)||x.valueCents<0||x.valueCents>1000000000)return fail(503);
 return {id:x.id,accountId:x.accountId,contactId:x.contactId,title:x.title,stage:x.stage,revision:x.revision,valueCents:x.valueCents,pipelineId:x.pipelineId,nextStages:x.nextStages as string[]};
}
export class CiP5Conversion extends CiP5Contacts{
 async convert(x:StageIdentity,org:string,id:string,raw:unknown){
  const args=this.scope(x,org),cmd=parseConversion(raw);if(!isCanonicalUuidV4(id))return fail(400);
  return this.transaction(true,async c=>{
   const data:unknown=(await c.query("SELECT p5_ci.convert_lead($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) AS data",[...args,id,cmd.requestId,cmd.expectedRevision,cmd.accountId,cmd.contactId,cmd.dealId,cmd.contactName,cmd.industry,cmd.dealTitle])).rows[0]?.data;
   if(!exact(data,"outcome,receipt")||(data.outcome!=="converted"&&data.outcome!=="replay"))return fail(503);
   const receipt=parseReceipt(data.receipt);if(receipt.leadId!==id||receipt.accountId!==cmd.accountId||receipt.contactId!==cmd.contactId||receipt.dealId!==cmd.dealId||receipt.revision!==Number(cmd.expectedRevision)+1)return fail(503);
   return {outcome:data.outcome,receipt};
  });
 }
 async deals(x:StageIdentity,org:string,after:string|null,search:unknown="",stage:unknown=null){
  const args=this.scope(x,org);if((after!==null&&!isCanonicalUuidV4(after))||typeof search!=="string"||!(/^[A-Za-z0-9 &.-]{0,80}$/).test(search)||(stage!==null&&!isDealStage(stage)))return fail(400);
  return this.transaction(false,async c=>{
   const data:unknown=(await c.query("SELECT p5_ci.query_deals($1,$2,$3,$4,NULL,$5,$6) AS data",[...args,after,search,stage])).rows[0]?.data;
   if(!Array.isArray(data)||data.length>21)return fail(503);
   let prior:string|null=after;const items=data.map(v=>{const row=parseDeal(v);if(prior!==null&&row.id<=prior)return fail(503);prior=row.id;return row;});
   return {items:items.slice(0,20),nextCursor:items.length===21?items[19]!.id:null};
  });
 }
}
