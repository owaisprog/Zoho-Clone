import {CiP5Handoffs} from "./p5-ci-handoffs.js";
import {LeadError} from "./p5-ci-leads.js";
import {isCanonicalUuidV4 as uuid} from "./p4-approved-uuid.js";
import type {StageIdentity} from "./staging-membership-db.js";
const reject=():never=>{throw new LeadError(503);};
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

export class CiP5SearchViews extends CiP5Handoffs{
 async search(x:StageIdentity,org:string,q:unknown,e:unknown,after:unknown){
 const args=this.scope(x,org);if(!query(q)||!entity(e)||(after!==null&&(!cursor(after)||(e!=="ALL"&&after.kind!==e))))throw new LeadError(400);
 return this.transaction(false,async c=>{const data:unknown=(await c.query("SELECT p5_ci.search_crm($1,$2,$3,$4,$5,$6,$7) AS data",[...args,q,e,after?.kind??null,after?.id??null])).rows[0]?.data;
 if(!Array.isArray(data)||data.length>21)return reject();
 let prior:string|null=after?key(after):null;const items=data.map(v=>{const row=parseSearch(v,e);if(prior!==null&&key(row)<=prior)return reject();prior=key(row);return row;});
 return {items:items.slice(0,20),nextCursor:items.length===21?{kind:items[19]!.kind,id:items[19]!.id}:null};});
 }
 async views(x:StageIdentity,org:string,after:unknown){
 const args=this.scope(x,org);if(after!==null&&!uuid(after))throw new LeadError(400);
 return this.transaction(false,async c=>{const data:unknown=(await c.query("SELECT p5_ci.read_views($1,$2,$3,$4) AS data",[...args,after])).rows[0]?.data;
 if(!Array.isArray(data)||data.length>21)return reject();
 let prior:string|null=after;const items=data.map(v=>{const row=parseView(v);if(prior!==null&&row.id<=prior)return reject();prior=row.id;return row;});return {items:items.slice(0,20),nextCursor:items.length===21?items[19]!.id:null};});
 }
 async saveView(x:StageIdentity,org:string,id:unknown,raw:unknown){
 const args=this.scope(x,org);if(!uuid(id)||!exact(raw,"columnsMode,entity,expectedRevision,name,query")||!name(raw.name)||!query(raw.query)||!entity(raw.entity)||!columns(raw.columnsMode)||!revision(raw.expectedRevision))throw new LeadError(400);
 const d={name:raw.name,query:raw.query,entity:raw.entity,columnsMode:raw.columnsMode},expected=raw.expectedRevision;
 return this.transaction(true,async c=>{const row=parseView((await c.query("SELECT p5_ci.write_view($1,$2,$3,$4,$5,$6,$7,$8,$9) AS data",[...args,id,d.name,d.query,d.entity,d.columnsMode,expected])).rows[0]?.data);if(row.id!==id||row.revision!==expected+1||!same(row,d))return reject();return row;});
 }
}
