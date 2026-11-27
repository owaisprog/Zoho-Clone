import {createP5RecordTransport} from "./p5-accounts-client";
import {isStageOrgId as uuid} from "./staging-membership";
import {LeadClientError} from "./p5-leads-client";
const reject=():never=>{throw new LeadClientError(503);};
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

export function createP5MailClient(request:typeof fetch=(u,o)=>fetch(u,o)){
 const templates=createP5RecordTransport("templates",request),emails=createP5RecordTransport("emails",request);
 async function list<T extends Template>(org:string,deal:string|null,after:string|null,parse:(v:unknown)=>T){
 if((deal!==null&&!uuid(deal))||(after!==null&&!uuid(after)))throw new LeadClientError(400);
 const r=await (deal===null?templates:emails)(org,(deal===null?"":"/"+deal)+(after?"?after="+encodeURIComponent(after):""));
 if(r.status!==200||!exact(r.data,"items,nextCursor")||!Array.isArray(r.data.items)||r.data.items.length>10)return reject();
 let prior=after;const items=r.data.items.map(v=>{const row=parse(v);if(prior!==null&&row.id<=prior)return reject();prior=row.id;return row;});
 if(r.data.nextCursor!==null&&(!uuid(r.data.nextCursor)||items.length!==10||r.data.nextCursor!==prior))return reject();
 return {items,nextCursor:r.data.nextCursor as string|null};
 }
 return {
 templates:(org:string,after:string|null=null)=>list(org,null,after,parseTemplate),
 emails:(org:string,deal:string,after:string|null=null)=>list(org,deal,after,v=>parseEmail(v,deal)),
 async saveTemplate(org:string,id:string,cmd:{subject:string;body:string}){
 if(!uuid(id)||!subject(cmd.subject)||!body(cmd.body))throw new LeadClientError(400);
 const r=await templates(org,"/"+id,cmd);const row=parseTemplate(r.data);if(r.status!==200||row.id!==id||row.subject!==cmd.subject||row.body!==cmd.body)return reject();return row;
 },
 async log(org:string,deal:string,id:string,cmd:{subject:string;body:string;direction:"INBOUND"|"OUTBOUND"}){
 if(!uuid(deal)||!uuid(id)||!subject(cmd.subject)||!body(cmd.body)||!direction(cmd.direction))throw new LeadClientError(400);
 const r=await emails(org,"/"+deal+"/"+id,cmd);const row=parseEmail(r.data,deal);if(r.status!==200||row.id!==id||row.subject!==cmd.subject||row.body!==cmd.body||row.direction!==cmd.direction)return reject();return row;
 }
 };
}
export type MailClient=ReturnType<typeof createP5MailClient>;
