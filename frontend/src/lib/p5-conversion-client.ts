import {isStageOrgId} from "./staging-membership";
import {LeadClientError} from "./p5-leads-client";
import {createP5RecordTransport,type Industry} from "./p5-accounts-client";
export type ConversionCommand={requestId:string;accountId:string;contactId:string;dealId:string;expectedRevision:number;contactName:string;industry:Industry;dealTitle:string};
export type Receipt={leadId:string;accountId:string;contactId:string;dealId:string;revision:number};
export const DEAL_STAGES=["OPEN","DISCOVERY","PROPOSAL","NEGOTIATION","WON","LOST"] as const;
export type DealStage=typeof DEAL_STAGES[number];
export const isDealStage=(x:unknown):x is DealStage=>typeof x==="string"&&(DEAL_STAGES as readonly string[]).includes(x);
export type Deal={id:string;accountId:string;contactId:string;title:string;stage:DealStage;revision:number;valueCents:number};
export type DealPage={items:Deal[];nextCursor:string|null};
const reject=():never=>{throw new LeadClientError(503);};
const exact=(x:unknown,k:string):x is Record<string,unknown>=>!!x&&typeof x==="object"&&!Array.isArray(x)&&Object.keys(x).sort().join(",")===k;
export function parseReceipt(x:unknown):Receipt{
 if(!exact(x,"accountId,contactId,dealId,leadId,revision")||!isStageOrgId(x.accountId)||!isStageOrgId(x.contactId)||!isStageOrgId(x.dealId)||!isStageOrgId(x.leadId)||typeof x.revision!=="number"||!Number.isInteger(x.revision)||x.revision<1||x.revision>1000000)return reject();
 return {accountId:x.accountId,contactId:x.contactId,dealId:x.dealId,leadId:x.leadId,revision:x.revision};
}
export function parseDeal(v:unknown):Deal{
 if(!exact(v,"accountId,contactId,id,revision,stage,title,valueCents")||!isStageOrgId(v.id)||!isStageOrgId(v.accountId)||!isStageOrgId(v.contactId)||typeof v.title!=="string"||!/^Demo [A-Za-z][A-Za-z0-9 &.-]{2,74}$/.test(v.title)||!isDealStage(v.stage)||typeof v.revision!=="number"||!Number.isInteger(v.revision)||v.revision<0||v.revision>1000000||typeof v.valueCents!=="number"||!Number.isInteger(v.valueCents)||v.valueCents<0||v.valueCents>1000000000)return reject();
 return {id:v.id,accountId:v.accountId,contactId:v.contactId,title:v.title,stage:v.stage,revision:v.revision,valueCents:v.valueCents};
}
export function parseDealPage(x:unknown,after:string|null):DealPage{
 if(!exact(x,"items,nextCursor")||!Array.isArray(x.items)||x.items.length>20)return reject();
 let prior=after;
 const items=x.items.map((v:unknown)=>{const row=parseDeal(v);if(prior!==null&&row.id<=prior)return reject();prior=row.id;return row;});
 if(x.nextCursor!==null&&(!isStageOrgId(x.nextCursor)||items.length!==20||x.nextCursor!==prior))return reject();
 return {items,nextCursor:x.nextCursor as string|null};
}
export function createP5ConversionClient(request:typeof fetch=(url,options)=>fetch(url,options)){
 const leads=createP5RecordTransport("leads",request),deals=createP5RecordTransport("deals",request);
 return {
  async convert(org:string,id:string,cmd:ConversionCommand){
   if(!isStageOrgId(id))throw new LeadClientError(400);
   const r=await leads(org,"/"+id+"/convert",cmd);
   if(!exact(r.data,"outcome,receipt")||!((r.status===201&&r.data.outcome==="converted")||(r.status===200&&r.data.outcome==="replay")))return reject();
   const receipt=parseReceipt(r.data.receipt);
   if(receipt.leadId!==id||receipt.accountId!==cmd.accountId||receipt.contactId!==cmd.contactId||receipt.dealId!==cmd.dealId||receipt.revision!==cmd.expectedRevision+1)return reject();
   return receipt;
  },
  async deals(org:string,after:string|null=null){if(after!==null&&!isStageOrgId(after))throw new LeadClientError(400);const r=await deals(org,after?"?after="+encodeURIComponent(after):"");if(r.status!==200)return reject();return parseDealPage(r.data,after);}
 };
}
export type ConversionClient=ReturnType<typeof createP5ConversionClient>;
