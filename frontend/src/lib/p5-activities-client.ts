import {createP5RecordTransport} from "./p5-accounts-client";
import {isStageOrgId} from "./staging-membership";
import {LeadClientError} from "./p5-leads-client";
export type ActivityKind="NOTE"|"TASK"|"CALL"|"MEETING";
export type Activity={id:string;dealId:string;kind:ActivityKind;title:string;completed:boolean;revision:number};
const exact=(x:unknown,k:string):x is Record<string,unknown>=>!!x&&typeof x==="object"&&!Array.isArray(x)&&Object.keys(x).sort().join(",")===k;
const reject=():never=>{throw new LeadClientError(503);};
export function parseActivity(x:unknown,deal:string):Activity{
 if(!exact(x,"completed,dealId,id,kind,revision,title")||!isStageOrgId(x.id)||x.dealId!==deal||typeof x.title!=="string"||!/^Demo [A-Za-z][A-Za-z0-9 &.-]{2,74}$/.test(x.title)||(x.kind!=="NOTE"&&x.kind!=="TASK"&&x.kind!=="CALL"&&x.kind!=="MEETING")||!((x.completed===false&&x.revision===0)||(x.kind==="TASK"&&x.completed===true&&x.revision===1)))return reject();
 return {id:x.id,dealId:deal,kind:x.kind,title:x.title,completed:x.completed as boolean,revision:x.revision as number};
}
export function createP5ActivityClient(request:typeof fetch=(u,o)=>fetch(u,o)){
 const call=createP5RecordTransport("activities",request);
 return {
 async list(org:string,deal:string,after:string|null=null){
 if(!isStageOrgId(deal)||(after!==null&&!isStageOrgId(after)))throw new LeadClientError(400);
 const r=await call(org,"/"+deal+(after?"?after="+encodeURIComponent(after):""));
 if(r.status!==200||!exact(r.data,"items,nextCursor")||!Array.isArray(r.data.items)||r.data.items.length>20)return reject();
 let prior=after;const items=r.data.items.map(v=>{const row=parseActivity(v,deal);if(prior!==null&&row.id<=prior)return reject();prior=row.id;return row;});
 if(r.data.nextCursor!==null&&(!isStageOrgId(r.data.nextCursor)||items.length!==20||r.data.nextCursor!==prior))return reject();
 return {items,nextCursor:r.data.nextCursor as string|null};
 },
 async write(org:string,deal:string,id:string,cmd:{kind:ActivityKind;title:string}|{expectedRevision:0}){
 if(!isStageOrgId(deal)||!isStageOrgId(id))throw new LeadClientError(400);
 const r=await call(org,"/"+deal+"/"+id,cmd);const row=parseActivity(r.data,deal);if(r.status!==200||row.id!==id)return reject();return row;
 }
 };
}
export type ActivityClient=ReturnType<typeof createP5ActivityClient>;
