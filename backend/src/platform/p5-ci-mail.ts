import {CiP5Forecast} from "./p5-ci-forecast.js";
import {LeadError} from "./p5-ci-leads.js";
import {isCanonicalUuidV4 as uuid} from "./p4-approved-uuid.js";
import type {StageIdentity} from "./staging-membership-db.js";
const reject=():never=>{throw new LeadError(503);};
const exact=(v:unknown,k:string):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v)&&Object.keys(v).sort().join(",")===k;
const subject=(v:unknown):v is string=>typeof v==="string"&&/^Demo [A-Za-z0-9][A-Za-z0-9 &.,!?-]{2,74}$/.test(v);
const body=(v:unknown):v is string=>typeof v==="string"&&/^Demo [A-Za-z0-9][A-Za-z0-9 &.,!?-]{2,234}$/.test(v);
const direction=(v:unknown):v is "INBOUND"|"OUTBOUND"=>v==="INBOUND"||v==="OUTBOUND";
export type Template={id:string;subject:string;body:string};
export type EmailLog=Template&{dealId:string;direction:"INBOUND"|"OUTBOUND";recordedAt:string};
export function parseTemplate(v:unknown):Template{
 if(!exact(v,"body,id,subject")||!uuid(v.id)||!subject(v.subject)||!body(v.body))return reject();
 return {id:v.id,subject:v.subject,body:v.body};
}
export function parseEmail(v:unknown,deal:string):EmailLog{
 if(!exact(v,"body,dealId,direction,id,recordedAt,subject")||!uuid(v.id)||v.dealId!==deal||!subject(v.subject)||!body(v.body)||!direction(v.direction)||typeof v.recordedAt!=="string"||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v.recordedAt)||!Number.isFinite(Date.parse(v.recordedAt)))return reject();
 return {id:v.id,dealId:deal,subject:v.subject,body:v.body,direction:v.direction,recordedAt:v.recordedAt};
}

export class CiP5Mail extends CiP5Forecast{
 async mail(x:StageIdentity,org:string,deal:unknown,after:unknown){
 const args=this.scope(x,org);if((deal!==null&&!uuid(deal))||(after!==null&&!uuid(after)))throw new LeadError(400);
 return this.transaction(false,async c=>{const data:unknown=(await c.query("SELECT p5_ci.read_mail($1,$2,$3,$4,$5) AS data",[...args,deal,after])).rows[0]?.data;
 if(!Array.isArray(data)||data.length>11)return reject();
 let prior=after;const items=data.map(v=>{const row=deal===null?parseTemplate(v):parseEmail(v,deal);if(prior!==null&&row.id<=prior)return reject();prior=row.id;return row;});
 return {items:items.slice(0,10),nextCursor:items.length===11?items[9]!.id:null};});
 }
 async saveMail(x:StageIdentity,org:string,deal:unknown,id:unknown,raw:unknown){
 const args=this.scope(x,org);if(!uuid(id)||(deal!==null&&!uuid(deal))||!exact(raw,deal===null?"body,subject":"body,direction,subject")||!subject(raw.subject)||!body(raw.body)||(deal!==null&&!direction(raw.direction)))throw new LeadError(400);
 return this.transaction(true,async c=>{const data:unknown=(await c.query("SELECT p5_ci.write_mail($1,$2,$3,$4,$5,$6,$7,$8) AS data",[...args,deal,id,deal===null?null:raw.direction,raw.subject,raw.body])).rows[0]?.data;
 const row=deal===null?parseTemplate(data):parseEmail(data,deal);if(row.id!==id||row.subject!==raw.subject||row.body!==raw.body||("direction" in row&&row.direction!==raw.direction))return reject();return row;});
 }
}
