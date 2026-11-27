import {createP5RecordTransport} from "./p5-accounts-client";
import {isStageOrgId as uuid} from "./staging-membership";
import {LeadClientError} from "./p5-leads-client";
const reject=():never=>{throw new LeadClientError(503);};
const exact=(v:unknown,k:string):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v)&&Object.keys(v).sort().join(",")===k;
export type Kind="ACCOUNT"|"CONTACT"|"DEAL"|"LEAD";
export type Entity=Kind|"ALL";
export type Columns="COMPACT"|"DETAIL";
const kind=(v:unknown):v is Kind=>v==="ACCOUNT"||v==="CONTACT"||v==="DEAL"||v==="LEAD";
const entity=(v:unknown):v is Entity=>v==="ALL"||kind(v);
const columns=(v:unknown):v is Columns=>v==="COMPACT"||v==="DETAIL";
const query=(v:unknown):v is string=>typeof v==="string"&&/^[A-Za-z0-9 .@-]{0,80}$/.test(v);
const name=(v:unknown):v is string=>typeof v==="string"&&/^Demo [A-Za-z][A-Za-z0-9 &.-]{2,74}$/.test(v);
export type SearchRow={id:string;kind:Kind;label:string;detail:string};
export type ViewDraft={name:string;query:string;entity:Entity;columnsMode:Columns};
export type SavedView=ViewDraft&{id:string;revision:number};
export type Cursor={kind:Kind;id:string};
const cursor=(v:unknown):v is Cursor=>exact(v,"id,kind")&&uuid(v.id)&&kind(v.kind);
const revision=(v:unknown):v is number=>typeof v==="number"&&Number.isInteger(v)&&v>=-1&&v<1000000;
export function parseSearch(v:unknown,e:Entity):SearchRow{
 if(!exact(v,"detail,id,kind,label")||!uuid(v.id)||!kind(v.kind)||(e!=="ALL"&&v.kind!==e)||!name(v.label)||typeof v.detail!=="string"||!(v.kind==="CONTACT"?/^[a-z][a-z0-9._-]{1,40}@example[.]com$/.test(v.detail):/^[A-Z][A-Z0-9_]{0,23}$/.test(v.detail)))return reject();
 return {id:v.id,kind:v.kind,label:v.label,detail:v.detail};
}
export function parseView(v:unknown):SavedView{
 if(!exact(v,"columnsMode,entity,id,name,query,revision")||!uuid(v.id)||!name(v.name)||!query(v.query)||!entity(v.entity)||!columns(v.columnsMode)||typeof v.revision!=="number"||!Number.isInteger(v.revision)||v.revision<0||v.revision>1000000)return reject();
 return {id:v.id,name:v.name,query:v.query,entity:v.entity,columnsMode:v.columnsMode,revision:v.revision};
}
const key=(x:Cursor)=>x.kind+":"+x.id;
const same=(a:SavedView,b:ViewDraft)=>a.name===b.name&&a.query===b.query&&a.entity===b.entity&&a.columnsMode===b.columnsMode;

export function createP5SearchClient(request:typeof fetch=(u,o)=>fetch(u,o)){
 const search=createP5RecordTransport("search",request),views=createP5RecordTransport("saved-views",request);
 return {
 async search(org:string,q:string,e:Entity,after:Cursor|null=null){
 if(!query(q)||!entity(e)||(after!==null&&(!cursor(after)||(e!=="ALL"&&after.kind!==e))))throw new LeadClientError(400);
 const params=new URLSearchParams({q,entity:e});if(after){params.set("afterKind",after.kind);params.set("afterId",after.id);}
 const r=await search(org,"?"+params);if(r.status!==200||!exact(r.data,"items,nextCursor")||!Array.isArray(r.data.items)||r.data.items.length>20)return reject();
 let prior:string|null=after?key(after):null;const items=r.data.items.map(v=>{const row=parseSearch(v,e);if(prior!==null&&key(row)<=prior)return reject();prior=key(row);return row;});
 if(r.data.nextCursor!==null&&(!cursor(r.data.nextCursor)||items.length!==20||key(r.data.nextCursor)!==prior))return reject();
 return {items,nextCursor:r.data.nextCursor as Cursor|null};
 },
 async views(org:string,after:string|null=null){
 if(after!==null&&!uuid(after))throw new LeadClientError(400);
 const r=await views(org,after?"?after="+encodeURIComponent(after):"");
 if(r.status!==200||!exact(r.data,"items,nextCursor")||!Array.isArray(r.data.items)||r.data.items.length>20)return reject();
 let prior:string|null=after;const items=r.data.items.map(v=>{const row=parseView(v);if(prior!==null&&row.id<=prior)return reject();prior=row.id;return row;});
 if(r.data.nextCursor!==null&&(!uuid(r.data.nextCursor)||items.length!==20||r.data.nextCursor!==prior))return reject();
 return {items,nextCursor:r.data.nextCursor as string|null};
 },
 async save(org:string,id:string,d:ViewDraft,expectedRevision:number){
 if(!uuid(id)||!name(d.name)||!query(d.query)||!entity(d.entity)||!columns(d.columnsMode)||!revision(expectedRevision))throw new LeadClientError(400);
 const r=await views(org,"/"+id,{...d,expectedRevision});const row=parseView(r.data);
 if(r.status!==200||row.id!==id||row.revision!==expectedRevision+1||!same(row,d))return reject();return row;
 }
 };
}
export type SearchClient=ReturnType<typeof createP5SearchClient>;
