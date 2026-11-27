import {CiP5Followups,validDueDate} from "./p5-ci-followups.js";
import {LeadError} from "./p5-ci-leads.js";
import {isCanonicalUuidV4} from "./p4-approved-uuid.js";
import type {StageIdentity} from "./staging-membership-db.js";
const reject=():never=>{throw new LeadError(503);};
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

export class CiP5Forecast extends CiP5Followups{
 async forecast(x:StageIdentity,org:string,deal:unknown){
 const args=this.scope(x,org);if(!isCanonicalUuidV4(deal))throw new LeadError(400);
 return this.transaction(false,async c=>{const v:unknown=(await c.query("SELECT p5_ci.read_forecast($1,$2,$3,$4) AS data",[...args,deal])).rows[0]?.data;return v===null?null:parseForecast(v,deal);});
 }
 async saveForecast(x:StageIdentity,org:string,deal:unknown,raw:unknown){
 const args=this.scope(x,org);if(!isCanonicalUuidV4(deal)||!exact(raw,"expectedClose,expectedRevision,probabilityBp")||!validDueDate(raw.expectedClose)||!integer(raw.probabilityBp)||raw.probabilityBp>10000||typeof raw.expectedRevision!=="number"||!Number.isInteger(raw.expectedRevision)||raw.expectedRevision< -1||raw.expectedRevision>=1000000)throw new LeadError(400);
 return this.transaction(true,async c=>{const row=parseForecast((await c.query("SELECT p5_ci.write_forecast($1,$2,$3,$4,$5,$6,$7) AS data",[...args,deal,raw.expectedClose,raw.probabilityBp,raw.expectedRevision])).rows[0]?.data,deal);if(row.expectedClose!==raw.expectedClose||row.probabilityBp!==raw.probabilityBp||row.revision!==Number(raw.expectedRevision)+1)return reject();return row;});
 }
 async report(x:StageIdentity,org:string,pipeline:unknown,from:unknown,to:unknown){
 const args=this.scope(x,org);if(!isCanonicalUuidV4(pipeline)||!validDueDate(from)||!validDueDate(to)||!validRange(from,to))throw new LeadError(400);
 return this.transaction(false,async c=>parseReport((await c.query("SELECT p5_ci.sales_report($1,$2,$3,$4,$5,$6) AS data",[...args,pipeline,from,to])).rows[0]?.data,pipeline,from,to));
 }
}
