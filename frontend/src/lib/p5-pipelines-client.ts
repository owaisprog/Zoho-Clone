import {isStageOrgId} from "./staging-membership";
import {LeadClientError} from "./p5-leads-client";
import {createP5RecordTransport} from "./p5-accounts-client";
export type StageDefinition={key:string;label:string};
export type Pipeline={id:string;name:string;isDefault:boolean;revision:number;stages:StageDefinition[]};
export type PipelinePage={items:Pipeline[];nextCursor:string|null};
export type PipelineWrite={requestId:string;name:string;stages:StageDefinition[]}&({id:string}|{expectedRevision:number});
const reject=():never=>{throw new LeadClientError(503);};
const exact=(x:unknown,k:string):x is Record<string,unknown>=>!!x&&typeof x==="object"&&!Array.isArray(x)&&Object.keys(x).sort().join(",")===k;
export function parseStages(v:unknown):StageDefinition[]{
 if(!Array.isArray(v)||v.length<3||v.length>10)return reject();
 const keys=new Set<string>();const items=v.map((x:unknown)=>{if(!exact(x,"key,label")||typeof x.key!=="string"||!(/^[A-Z][A-Z0-9_]{0,23}$/).test(x.key)||typeof x.label!=="string"||!(/^[A-Za-z][A-Za-z0-9 -]{1,39}$/).test(x.label)||keys.has(x.key))return reject();keys.add(x.key);return {key:x.key,label:x.label};});
 if(items[0]?.key!=="OPEN"||items.at(-2)?.key!=="WON"||items.at(-1)?.key!=="LOST")return reject();return items;
}
export function parsePipeline(x:unknown):Pipeline{
 if(!exact(x,"id,isDefault,name,revision,stages")||!isStageOrgId(x.id)||typeof x.name!=="string"||!(/^Demo [A-Za-z][A-Za-z0-9 &.-]{2,74}$/).test(x.name)||typeof x.isDefault!=="boolean"||typeof x.revision!=="number"||!Number.isInteger(x.revision)||x.revision<0||x.revision>1000000)return reject();
 return {id:x.id,name:x.name,isDefault:x.isDefault,revision:x.revision,stages:parseStages(x.stages)};
}
export function parsePipelinePage(x:unknown,after:string|null):PipelinePage{
 if(!exact(x,"items,nextCursor")||!Array.isArray(x.items)||x.items.length>20)return reject();
 let prior=after;const items=x.items.map(v=>{const row=parsePipeline(v);if(prior!==null&&row.id<=prior)return reject();prior=row.id;return row;});
 if(x.nextCursor!==null&&(!isStageOrgId(x.nextCursor)||items.length!==20||x.nextCursor!==prior))return reject();return {items,nextCursor:x.nextCursor as string|null};
}
export function createP5PipelineClient(request:typeof fetch=(url,options)=>fetch(url,options)){
 const call=createP5RecordTransport("pipelines",request);
 return {
  async list(org:string,after:string|null=null){if(after!==null&&!isStageOrgId(after))throw new LeadClientError(400);const r=await call(org,after?"?after="+encodeURIComponent(after):"");if(r.status!==200)return reject();return parsePipelinePage(r.data,after);},
  async write(org:string,id:string|null,cmd:PipelineWrite){
   const target=id??("id" in cmd?cmd.id:null);if(!isStageOrgId(target))throw new LeadClientError(400);
   const r=await call(org,id?"/"+id:"",cmd,id?"PATCH":"POST");
   if(!exact(r.data,"outcome,record")||!((r.status===200&&r.data.outcome==="replay")||(id===null?r.status===201&&r.data.outcome==="created":r.status===200&&r.data.outcome==="applied")))return reject();
   const row=parsePipeline(r.data.record);if(row.id!==target)return reject();return row;
  }
 };
}
export type PipelineClient=ReturnType<typeof createP5PipelineClient>;
