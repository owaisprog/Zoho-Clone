import {CiP5Deals} from "./p5-ci-deals.js";
import {LeadError} from "./p5-ci-leads.js";
import {isCanonicalUuidV4} from "./p4-approved-uuid.js";
import type {StageIdentity} from "./staging-membership-db.js";
const fail=(s:400|403|404|409|503):never=>{throw new LeadError(s);};
const exact=(x:unknown,k:string):x is Record<string,unknown>=>!!x&&typeof x==="object"&&!Array.isArray(x)&&Object.keys(x).sort().join(",")===k;
const name=(v:unknown):v is string=>typeof v==="string"&&/^Demo [A-Za-z][A-Za-z0-9 &.-]{2,74}$/.test(v);
export type StageDefinition={key:string;label:string};
export function parseStages(v:unknown,status:400|503=400):StageDefinition[]{
 if(!Array.isArray(v)||v.length<3||v.length>10)return fail(status);
 const keys=new Set<string>();
 const items=v.map((x:unknown)=>{if(!exact(x,"key,label")||typeof x.key!=="string"||!(/^[A-Z][A-Z0-9_]{0,23}$/).test(x.key)||typeof x.label!=="string"||!(/^[A-Za-z][A-Za-z0-9 -]{1,39}$/).test(x.label)||keys.has(x.key))return fail(status);keys.add(x.key);return {key:x.key,label:x.label};});
 if(items[0]?.key!=="OPEN"||items.at(-2)?.key!=="WON"||items.at(-1)?.key!=="LOST")return fail(status);return items;
}
export function parsePipeline(x:unknown){
 if(!exact(x,"id,isDefault,name,revision,stages")||!isCanonicalUuidV4(x.id)||typeof x.isDefault!=="boolean"||!name(x.name)||typeof x.revision!=="number"||!Number.isInteger(x.revision)||x.revision<0||x.revision>1000000)return fail(503);
 return {id:x.id,name:x.name,isDefault:x.isDefault,revision:x.revision,stages:parseStages(x.stages,503)};
}
export function parsePipelineWrite(x:unknown,create:boolean){
 if(!exact(x,create?"id,name,requestId,stages":"expectedRevision,name,requestId,stages")||!name(x.name)||!isCanonicalUuidV4(x.requestId))return fail(400);
 const base={requestId:x.requestId,name:x.name,stages:parseStages(x.stages)};
 if(create){if(!isCanonicalUuidV4(x.id))return fail(400);return {...base,id:x.id,expectedRevision:null};}
 if(typeof x.expectedRevision!=="number"||!Number.isInteger(x.expectedRevision)||x.expectedRevision<0||x.expectedRevision>=1000000)return fail(400);
 return {...base,id:null,expectedRevision:x.expectedRevision};
}
export class CiP5Pipelines extends CiP5Deals{
 async pipelines(x:StageIdentity,org:string,after:string|null){
  const args=this.scope(x,org);if(after!==null&&!isCanonicalUuidV4(after))return fail(400);
  return this.transaction(false,async c=>{
   const data:unknown=(await c.query("SELECT p5_ci.list_pipelines($1,$2,$3,$4) AS data",[...args,after])).rows[0]?.data;
   if(!Array.isArray(data)||data.length>21)return fail(503);
   let prior:string|null=after;const items=data.map(v=>{const row=parsePipeline(v);if(prior!==null&&row.id<=prior)return fail(503);prior=row.id;return row;});
   return {items:items.slice(0,20),nextCursor:items.length===21?items[19]!.id:null};
  });
 }
 async writePipeline(x:StageIdentity,org:string,id:string|null,raw:unknown){
  const args=this.scope(x,org),cmd=parsePipelineWrite(raw,id===null),target=id??cmd.id;if(!isCanonicalUuidV4(target))return fail(400);
  return this.transaction(true,async c=>{
   const data:unknown=(await c.query("SELECT p5_ci.write_pipeline($1,$2,$3,$4,$5,$6,$7,$8::jsonb) AS data",[...args,target,cmd.requestId,cmd.expectedRevision,cmd.name,JSON.stringify(cmd.stages)])).rows[0]?.data;
   if(!exact(data,"outcome,record")||(data.outcome!=="replay"&&data.outcome!==(id===null?"created":"applied")))return fail(503);
   const record=parsePipeline(data.record);if(record.id!==target)return fail(503);return {outcome:data.outcome,record};
  });
 }
}
