import {CiP5Pipelines} from "./p5-ci-pipelines.js";
import {parseDeal,isDealStage} from "./p5-ci-conversion.js";
import {LeadError} from "./p5-ci-leads.js";
import {isCanonicalUuidV4} from "./p4-approved-uuid.js";
import type {StageIdentity} from "./staging-membership-db.js";
const reject=():never=>{throw new LeadError(503);};
const exact=(v:unknown,k:string):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v)&&Object.keys(v).sort().join(",")===k;
const nonnegative=(n:unknown):n is number=>typeof n==="number"&&Number.isSafeInteger(n)&&n>=0;
export function parseBoard(v:unknown,pipeline:string,stage:string|null,after:string|null){
 if(!exact(v,"columns,pipelineId,pipelineName,pipelineRevision")||v.pipelineId!==pipeline||typeof v.pipelineName!=="string"||!(/^Demo [A-Za-z][A-Za-z0-9 &.-]{2,74}$/).test(v.pipelineName)||!nonnegative(v.pipelineRevision)||v.pipelineRevision>1000000||!Array.isArray(v.columns)||(stage===null?(v.columns.length<3||v.columns.length>10):v.columns.length!==1))return reject();
 const keys=new Set<string>(),ids=new Set<string>();let allCount=0,allValue=0;
 const columns=v.columns.map((c:unknown)=>{
  if(!exact(c,"count,items,key,label,nextCursor,valueCents")||!isDealStage(c.key)||keys.has(c.key)||(stage!==null&&c.key!==stage)||typeof c.label!=="string"||!(/^[A-Za-z][A-Za-z0-9 -]{1,39}$/).test(c.label)||!nonnegative(c.count)||!nonnegative(c.valueCents)||!Array.isArray(c.items)||c.items.length>10||c.count<c.items.length)return reject();
  keys.add(c.key);let prior=after,shown=0;
  const items=c.items.map((x:unknown)=>{const row=parseDeal(x);if(row.pipelineId!==pipeline||row.stage!==c.key||ids.has(row.id)||(prior!==null&&row.id<=prior))return reject();ids.add(row.id);prior=row.id;shown+=row.valueCents;return row;});
  if(c.valueCents<shown||(c.count===0&&c.valueCents!==0)||(c.nextCursor!==null&&(!isCanonicalUuidV4(c.nextCursor)||items.length!==10||c.nextCursor!==prior||c.count<=10)))return reject();
  if(after===null&&(items.length!==Math.min(c.count,10)||(c.count>10)!==(c.nextCursor!==null)))return reject();
  allCount+=c.count;allValue+=c.valueCents;
  return {key:c.key,label:c.label,count:c.count,valueCents:c.valueCents,items,nextCursor:c.nextCursor as string|null};
 });
 if(!Number.isSafeInteger(allCount)||!Number.isSafeInteger(allValue)||(stage===null&&(columns[0]?.key!=="OPEN"||columns.at(-2)?.key!=="WON"||columns.at(-1)?.key!=="LOST")))return reject();
 if(stage===null&&columns.some(col=>col.items.some(row=>row.nextStages.some(key=>!keys.has(key)))))return reject();
 return {pipelineId:pipeline,pipelineName:v.pipelineName,pipelineRevision:v.pipelineRevision,columns};
}
export type SalesBoard=ReturnType<typeof parseBoard>;

export class CiP5SalesBoard extends CiP5Pipelines{
 async board(x:StageIdentity,org:string,pipeline:unknown,search:unknown,stage:unknown,after:unknown){
  const args=this.scope(x,org);
  if(!isCanonicalUuidV4(pipeline)||typeof search!=="string"||!(/^[A-Za-z0-9 &.-]{0,80}$/).test(search)||(stage!==null&&!isDealStage(stage))||(after!==null&&(!isCanonicalUuidV4(after)||stage===null)))throw new LeadError(400);
  return this.transaction(false,async c=>parseBoard((await c.query("SELECT p5_ci.sales_board($1,$2,$3,$4,$5,$6,$7) AS data",[...args,pipeline,search,stage,after])).rows[0]?.data,pipeline,stage,after));
 }
}
