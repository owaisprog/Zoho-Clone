import {createP5RecordTransport} from "./p5-accounts-client";
import {isStageOrgId as uuid} from "./staging-membership";
import {LeadClientError} from "./p5-leads-client";
const reject=():never=>{throw new LeadClientError(503);};
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

export function createP5HandoffClient(request:typeof fetch=(u,o)=>fetch(u,o)){
 const call=createP5RecordTransport("handoffs",request);
 return {
 async list(org:string,after:string|null=null){
 if(after!==null&&!uuid(after))throw new LeadClientError(400);
 const r=await call(org,after?"?after="+encodeURIComponent(after):"");
 if(r.status!==200||!exact(r.data,"items,nextCursor")||!Array.isArray(r.data.items)||r.data.items.length>20)return reject();
 let prior:string|null=after;const items=r.data.items.map(v=>{const row=parseHandoff(v);if(prior!==null&&row.dealId<=prior)return reject();prior=row.dealId;return row;});
 if(r.data.nextCursor!==null&&(!uuid(r.data.nextCursor)||items.length!==20||r.data.nextCursor!==prior))return reject();
 return {items,nextCursor:r.data.nextCursor as string|null};
 },
 async complete(org:string,deal:string,s:Step,expectedRevision:number){
 if(!uuid(deal)||!step(s)||!validRevision(expectedRevision))throw new LeadClientError(400);
 const r=await call(org,"/"+deal,{step:s,expectedRevision});const row=parseHandoff(r.data);
 if(r.status!==200||row.dealId!==deal||row.revision!==expectedRevision+1||!completed(row,s))return reject();return row;
 }
 };
}
export type HandoffClient=ReturnType<typeof createP5HandoffClient>;
