import {createP5RecordTransport} from "./p5-accounts-client";
import {isStageOrgId} from "./staging-membership";
import {LeadClientError} from "./p5-leads-client";
import {validDueDate} from "./p5-followups-client";
const reject=():never=>{throw new LeadClientError(503);};
const exact=(v:unknown,k:string):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v)&&Object.keys(v).sort().join(",")===k;
const integer=(v:unknown):v is number=>typeof v==="number"&&Number.isSafeInteger(v)&&v>=0;
export function validRange(from:unknown,to:unknown):boolean{return validDueDate(from)&&validDueDate(to)&&from<=to&&(Date.parse(to)-Date.parse(from))/86400000<=366;}
export function parseForecast(v:unknown,deal:string){
 if(!exact(v,"dealId,expectedClose,probabilityBp,revision")||v.dealId!==deal||!validDueDate(v.expectedClose)||!integer(v.probabilityBp)||v.probabilityBp>10000||!integer(v.revision)||v.revision>1000000)return reject();
 return {dealId:deal,expectedClose:v.expectedClose,probabilityBp:v.probabilityBp,revision:v.revision};
}
export function parseReport(v:unknown,pipeline:string,from:string,to:string){
 if(!exact(v,"currency,from,pipelineId,stages,to")||v.currency!=="USD"||v.pipelineId!==pipeline||v.from!==from||v.to!==to||!Array.isArray(v.stages)||v.stages.length<3||v.stages.length>10)return reject();
 const keys=new Set<string>();
 const stages=v.stages.map((s:unknown)=>{
 if(!exact(s,"closedCount,count,key,label,missingCount,scheduledCount,valueCents,weightedCents,wonCents")||typeof s.key!=="string"||!/^[A-Z][A-Z0-9_]{0,23}$/.test(s.key)||keys.has(s.key)||typeof s.label!=="string"||!/^[A-Za-z][A-Za-z0-9 -]{1,39}$/.test(s.label)||!integer(s.count)||!integer(s.valueCents)||!integer(s.missingCount)||!integer(s.scheduledCount)||!integer(s.weightedCents)||!integer(s.closedCount)||!integer(s.wonCents))return reject();
 const terminal=s.key==="WON"||s.key==="LOST";
 if(s.missingCount+s.scheduledCount>s.count||s.closedCount>s.count||s.weightedCents>s.valueCents||s.wonCents>s.valueCents||(terminal&&(s.missingCount!==0||s.scheduledCount!==0||s.weightedCents!==0))||(!terminal&&s.closedCount!==0)||(s.key!=="WON"&&s.wonCents!==0))return reject();
 keys.add(s.key);return {key:s.key,label:s.label,count:s.count,valueCents:s.valueCents,missingCount:s.missingCount,scheduledCount:s.scheduledCount,weightedCents:s.weightedCents,closedCount:s.closedCount,wonCents:s.wonCents};
 });
 if(stages[0]?.key!=="OPEN"||stages.at(-2)?.key!=="WON"||stages.at(-1)?.key!=="LOST")return reject();
 for(const key of ["count","valueCents","missingCount","scheduledCount","weightedCents","closedCount","wonCents"] as const)if(!Number.isSafeInteger(stages.reduce((sum,s)=>sum+s[key],0)))return reject();
 return {pipelineId:pipeline,from,to,currency:"USD" as const,stages};
}

export function createP5ForecastClient(request:typeof fetch=(u,o)=>fetch(u,o)){
 const call=createP5RecordTransport("reports",request);
 return {
 async forecast(org:string,deal:string){if(!isStageOrgId(deal))throw new LeadClientError(400);const r=await call(org,"/forecast/"+deal);if(r.status!==200)return reject();return r.data===null?null:parseForecast(r.data,deal);},
 async save(org:string,deal:string,expectedClose:string,probabilityBp:number,expectedRevision:number){
 if(!isStageOrgId(deal)||!validDueDate(expectedClose)||!integer(probabilityBp)||probabilityBp>10000||!Number.isInteger(expectedRevision)||expectedRevision< -1||expectedRevision>=1000000)throw new LeadClientError(400);
 const r=await call(org,"/forecast/"+deal,{expectedClose,probabilityBp,expectedRevision});const row=parseForecast(r.data,deal);if(r.status!==200||row.expectedClose!==expectedClose||row.probabilityBp!==probabilityBp||row.revision!==expectedRevision+1)return reject();return row;
 },
 async report(org:string,pipeline:string,from:string,to:string){if(!isStageOrgId(pipeline)||!validRange(from,to))throw new LeadClientError(400);const r=await call(org,"?"+new URLSearchParams({pipelineId:pipeline,from,to}));if(r.status!==200)return reject();return parseReport(r.data,pipeline,from,to);}
 };
}
export type ForecastClient=ReturnType<typeof createP5ForecastClient>;
export type SalesReport=ReturnType<typeof parseReport>;
