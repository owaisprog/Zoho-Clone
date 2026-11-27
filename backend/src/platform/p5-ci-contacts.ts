import {CiP5Accounts} from "./p5-ci-accounts.js";
import {LeadError} from "./p5-ci-leads.js";
import {isCanonicalUuidV4} from "./p4-approved-uuid.js";
import type {StageIdentity} from "./staging-membership-db.js";
export type Contact={id:string;displayName:string;email:string;accountId:string|null;revision:number};
const fail=(status:400|403|404|409|503):never=>{throw new LeadError(status);};
const exact=(x:unknown,k:string):x is Record<string,unknown>=>!!x&&typeof x==="object"&&!Array.isArray(x)&&Object.keys(x).sort().join(",")===k;
const name=(x:unknown):x is string=>typeof x==="string"&&/^Demo [A-Za-z][A-Za-z0-9 .-]{2,74}$/.test(x);
const email=(x:unknown):x is string=>typeof x==="string"&&/^[a-z][a-z0-9._-]{1,40}@example[.]com$/.test(x);
export function parseContact(x:unknown):Contact{
 if(!exact(x,"accountId,displayName,email,id,revision")||!isCanonicalUuidV4(x.id)||!name(x.displayName)||!email(x.email)||(x.accountId!==null&&!isCanonicalUuidV4(x.accountId))||typeof x.revision!=="number"||!Number.isInteger(x.revision)||x.revision<0||x.revision>1000000)return fail(503);
 return {id:x.id,displayName:x.displayName,email:x.email,accountId:x.accountId,revision:x.revision};
}
export function parseContactWrite(x:unknown,edit:boolean){
 if(!exact(x,edit?"accountId,displayName,email,expectedRevision,requestId":"accountId,displayName,email,id,requestId")||!isCanonicalUuidV4(x.requestId)||!name(x.displayName)||!email(x.email)||(x.accountId!==null&&!isCanonicalUuidV4(x.accountId)))return fail(400);
 const base={requestId:x.requestId,displayName:x.displayName,email:x.email,accountId:x.accountId};
 if(edit){if(typeof x.expectedRevision!=="number"||!Number.isInteger(x.expectedRevision)||x.expectedRevision<0||x.expectedRevision>=1000000)return fail(400);return {...base,id:null,expectedRevision:x.expectedRevision};}
 if(!isCanonicalUuidV4(x.id))return fail(400);return {...base,id:x.id,expectedRevision:null};
}
export class CiP5Contacts extends CiP5Accounts{
 async contacts(x:StageIdentity,org:string,after:string|null,search:unknown,duplicate=false){
  const args=this.scope(x,org);
  if((after!==null&&!isCanonicalUuidV4(after))||typeof search!=="string"||!(/^[A-Za-z0-9 .@_-]{0,80}$/).test(search)||(duplicate&&!name(search)&&!email(search)))return fail(400);
  return this.transaction(false,async c=>{
   const data:unknown=(await c.query("SELECT p5_ci.read_contacts($1,$2,$3,$4,NULL,$5,$6) AS data",[...args,after,search,duplicate])).rows[0]?.data;
   if(!Array.isArray(data)||data.length>21)return fail(503);
   let prior:string|null=after;const items=data.map(v=>{const row=parseContact(v);if(prior!==null&&row.id<=prior)return fail(503);prior=row.id;return row;});
   return {items:items.slice(0,20),nextCursor:items.length===21?items[19]!.id:null};
  });
 }
 async contact(x:StageIdentity,org:string,id:string){
  const args=this.scope(x,org);if(!isCanonicalUuidV4(id))return fail(400);
  return this.transaction(false,async c=>{
   const data:unknown=(await c.query("SELECT p5_ci.read_contacts($1,$2,$3,NULL,$4,'',false) AS data",[...args,id])).rows[0]?.data;
   if(data===null)return fail(404);const record=parseContact(data);if(record.id!==id)return fail(503);return record;
  });
 }
 async writeContact(x:StageIdentity,org:string,id:string|null,raw:unknown){
  const args=this.scope(x,org),cmd=parseContactWrite(raw,id!==null),target=id??cmd.id;
  if(!isCanonicalUuidV4(target))return fail(400);
  return this.transaction(true,async c=>{
   const data:unknown=(await c.query("SELECT p5_ci.write_contact($1,$2,$3,$4,$5,$6,$7,$8,$9) AS data",[...args,target,cmd.requestId,cmd.expectedRevision,cmd.displayName,cmd.email,cmd.accountId])).rows[0]?.data;
   if(!exact(data,"outcome,record")||(data.outcome!=="replay"&&data.outcome!==(id===null?"created":"applied")))return fail(503);
   const record=parseContact(data.record);if(record.id!==target)return fail(503);return {outcome:data.outcome,record};
  });
 }
}
