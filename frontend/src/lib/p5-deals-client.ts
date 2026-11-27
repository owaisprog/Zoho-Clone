import {isStageOrgId} from "./staging-membership";
import {LeadClientError} from "./p5-leads-client";
import {createP5RecordTransport} from "./p5-accounts-client";
import {parseDeal,parseDealPage,isDealStage,type DealStage} from "./p5-conversion-client";
export type DealDraft={id:string;requestId:string;accountId:string;contactId:string;title:string;valueCents:number;pipelineId?:string};
export type DealChange={requestId:string;expectedRevision:number}&({operation:"edit";title:string;valueCents:number}|{operation:"transition";nextStage:DealStage});
export type DealHistory={items:{action:string;revision:number;previousStage:DealStage|null;nextStage:DealStage|null}[];nextCursor:number|null};
const reject=():never=>{throw new LeadClientError(503);};
const exact=(x:unknown,k:string):x is Record<string,unknown>=>!!x&&typeof x==="object"&&!Array.isArray(x)&&Object.keys(x).sort().join(",")===k;
export function parseDealHistory(x:unknown,after:number):DealHistory{
 if(!exact(x,"items,nextCursor")||!Array.isArray(x.items)||x.items.length>20)return reject();
 let prior=after;
 const items=x.items.map((v:unknown)=>{
  if(!exact(v,"action,nextStage,previousStage,revision")||typeof v.revision!=="number"||!Number.isInteger(v.revision)||v.revision<=prior||v.revision>1000000)return reject();
  if(v.action==="STAGE_CHANGED"&&v.revision>0&&isDealStage(v.previousStage)&&isDealStage(v.nextStage)&&v.previousStage!==v.nextStage){prior=v.revision;return {action:v.action,revision:v.revision,previousStage:v.previousStage,nextStage:v.nextStage};}
  if(((v.action==="CREATED"&&v.revision===0)||(v.action==="EDITED"&&v.revision>0))&&v.previousStage===null&&v.nextStage===null){prior=v.revision;return {action:v.action,revision:v.revision,previousStage:null,nextStage:null};}return reject();
 });
 if(x.nextCursor!==null&&(items.length!==20||x.nextCursor!==prior))return reject();return {items,nextCursor:x.nextCursor as number|null};
}
export function createP5DealClient(request:typeof fetch=(url,options)=>fetch(url,options)){
 const call=createP5RecordTransport("deals",request);
 return {
  async list(org:string,after:string|null=null,search="",stage:DealStage|null=null){
   if(after!==null&&!isStageOrgId(after))throw new LeadClientError(400);
   const q=new URLSearchParams({search});if(after)q.set("after",after);if(stage)q.set("stage",stage);
   const r=await call(org,"?"+q.toString());if(r.status!==200)return reject();return parseDealPage(r.data,after);
  },
  async detail(org:string,id:string){if(!isStageOrgId(id))throw new LeadClientError(400);const r=await call(org,"/"+id);const row=parseDeal(r.data);if(r.status!==200||row.id!==id)return reject();return row;},
  async write(org:string,id:string|null,cmd:DealDraft|DealChange){
   const target=id??("id" in cmd?cmd.id:null);if(!isStageOrgId(target))throw new LeadClientError(400);
   const r=await call(org,id?"/"+id:"",cmd,id?"PATCH":"POST");
   if(!exact(r.data,"outcome,record")||!((r.status===200&&r.data.outcome==="replay")||(id===null?r.status===201&&r.data.outcome==="created":r.status===200&&r.data.outcome==="applied")))return reject();
   const record=parseDeal(r.data.record);if(record.id!==target)return reject();return record;
  },
  async history(org:string,id:string,after=-1){if(!isStageOrgId(id)||!Number.isInteger(after)||after< -1||after>1000000)throw new LeadClientError(400);const r=await call(org,"/"+id+"/history?after="+after);if(r.status!==200)return reject();return parseDealHistory(r.data,after);}
 };
}
export type DealClient=ReturnType<typeof createP5DealClient>;
