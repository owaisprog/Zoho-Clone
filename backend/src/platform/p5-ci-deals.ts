import {CiP5Conversion,parseDeal,isDealStage} from "./p5-ci-conversion.js";
import {LeadError} from "./p5-ci-leads.js";
import {isCanonicalUuidV4} from "./p4-approved-uuid.js";
import type {StageIdentity} from "./staging-membership-db.js";
const fail=(s:400|403|404|409|503):never=>{throw new LeadError(s);};
const exact=(x:unknown,k:string):x is Record<string,unknown>=>!!x&&typeof x==="object"&&!Array.isArray(x)&&Object.keys(x).sort().join(",")===k;
const title=(v:unknown):v is string=>typeof v==="string"&&/^Demo [A-Za-z][A-Za-z0-9 &.-]{2,74}$/.test(v);
const value=(v:unknown):v is number=>typeof v==="number"&&Number.isInteger(v)&&v>=0&&v<=1000000000;
export function parseDealWrite(x:unknown,create:boolean){
 if(!x||typeof x!=="object"||Array.isArray(x))return fail(400);
 const v=x as Record<string,unknown>;
 if(!isCanonicalUuidV4(v.requestId))return fail(400);
 const base={requestId:v.requestId};
 if(create){
  if(!exact(v,"accountId,contactId,id,requestId,title,valueCents")||!isCanonicalUuidV4(v.id)||!isCanonicalUuidV4(v.accountId)||!isCanonicalUuidV4(v.contactId)||!title(v.title)||!value(v.valueCents))return fail(400);
  return {...base,id:v.id,operation:"create",expectedRevision:null,title:v.title,valueCents:v.valueCents,accountId:v.accountId,contactId:v.contactId,nextStage:null};
 }
 if(typeof v.expectedRevision!=="number"||!Number.isInteger(v.expectedRevision)||v.expectedRevision<0||v.expectedRevision>=1000000)return fail(400);
 const rev={...base,id:null,expectedRevision:v.expectedRevision,accountId:null,contactId:null};
 if(v.operation==="edit"&&exact(v,"expectedRevision,operation,requestId,title,valueCents")&&title(v.title)&&value(v.valueCents))return {...rev,operation:"edit",title:v.title,valueCents:v.valueCents,nextStage:null};
 if(v.operation==="transition"&&exact(v,"expectedRevision,nextStage,operation,requestId")&&isDealStage(v.nextStage)&&v.nextStage!=="OPEN")return {...rev,operation:"transition",title:null,valueCents:null,nextStage:v.nextStage};
 return fail(400);
}
export function parseDealHistory(data:unknown,after:number){
 if(!Array.isArray(data)||data.length>21)return fail(503);
 let prior=after;
 const rows=data.map((v:unknown)=>{
  if(!exact(v,"action,nextStage,previousStage,revision")||typeof v.revision!=="number"||!Number.isInteger(v.revision)||v.revision<=prior||v.revision>1000000)return fail(503);
  const valid=(v.action==="CREATED"&&v.revision===0&&v.previousStage===null&&v.nextStage===null)||(v.action==="EDITED"&&v.revision>0&&v.previousStage===null&&v.nextStage===null)||(v.action==="STAGE_CHANGED"&&v.revision>0&&isDealStage(v.previousStage)&&isDealStage(v.nextStage)&&v.previousStage!==v.nextStage);
  if(!valid)return fail(503);prior=v.revision;return {action:v.action,revision:v.revision,previousStage:v.previousStage,nextStage:v.nextStage};
 });
 return {items:rows.slice(0,20),nextCursor:rows.length===21?rows[19]!.revision:null};
}
export class CiP5Deals extends CiP5Conversion{
 async deal(x:StageIdentity,org:string,id:string){
  const args=this.scope(x,org);if(!isCanonicalUuidV4(id))return fail(400);
  return this.transaction(false,async c=>{const data:unknown=(await c.query("SELECT p5_ci.query_deals($1,$2,$3,NULL,$4,'',NULL) AS data",[...args,id])).rows[0]?.data;if(data===null)return fail(404);const row=parseDeal(data);if(row.id!==id)return fail(503);return row;});
 }
 async writeDeal(x:StageIdentity,org:string,id:string|null,raw:unknown){
  const args=this.scope(x,org),cmd=parseDealWrite(raw,id===null),target=id??cmd.id;if(!isCanonicalUuidV4(target))return fail(400);
  return this.transaction(true,async c=>{
   const data:unknown=(await c.query("SELECT p5_ci.write_deal($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) AS data",[...args,target,cmd.requestId,cmd.expectedRevision,cmd.operation,cmd.title,cmd.valueCents,cmd.accountId,cmd.contactId,cmd.nextStage])).rows[0]?.data;
   if(!exact(data,"outcome,record")||(data.outcome!=="replay"&&data.outcome!==(id===null?"created":"applied")))return fail(503);
   const record=parseDeal(data.record);if(record.id!==target)return fail(503);return {outcome:data.outcome,record};
  });
 }
 async dealHistory(x:StageIdentity,org:string,id:string,after=-1){
  const args=this.scope(x,org);if(!isCanonicalUuidV4(id)||!Number.isInteger(after)||after< -1||after>1000000)return fail(400);
  return this.transaction(false,async c=>parseDealHistory((await c.query("SELECT p5_ci.deal_history($1,$2,$3,$4,$5) AS data",[...args,id,after])).rows[0]?.data,after));
 }
}
