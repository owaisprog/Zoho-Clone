import {CiP5CrmSettings} from "./p5-ci-crm-settings.js";
import {LeadError,parseLead} from "./p5-ci-leads.js";
import {isCanonicalUuidV4 as uuid} from "./p4-approved-uuid.js";
import type {StageIdentity} from "./staging-membership-db.js";
const reject=():never=>{throw new LeadError(503);};
const exact=(v:unknown,k:string):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v)&&Object.keys(v).sort().join(",")===k;
const rev=(v:unknown):v is number=>typeof v==="number"&&Number.isInteger(v)&&v>=0&&v<1000000;
export type ExportCommand={id:string;leadIds:string[]};
export type BulkItem={id:string;requestId:string;revision:number};
export type BulkCommand={id:string;action:"ASSIGN"|"STATUS";target:string;items:BulkItem[]};
const exportCommand=(v:unknown):v is ExportCommand=>exact(v,"id,leadIds")&&uuid(v.id)&&Array.isArray(v.leadIds)&&v.leadIds.length>=1&&v.leadIds.length<=10&&v.leadIds.every(uuid)&&new Set(v.leadIds).size===v.leadIds.length;
const bulkCommand=(v:unknown):v is BulkCommand=>exact(v,"action,id,items,target")&&uuid(v.id)&&((v.action==="ASSIGN"&&uuid(v.target))||(v.action==="STATUS"&&(v.target==="CONTACTED"||v.target==="QUALIFIED"||v.target==="LOST")))&&Array.isArray(v.items)&&v.items.length>=1&&v.items.length<=10&&v.items.every(x=>exact(x,"id,requestId,revision")&&uuid(x.id)&&uuid(x.requestId)&&rev(x.revision))&&new Set(v.items.map(x=>x.id)).size===v.items.length&&new Set(v.items.map(x=>x.requestId)).size===v.items.length;
export function parseExport(v:unknown,id:string,selected?:string[]){
 if(!exact(v,"id,rows")||v.id!==id||!Array.isArray(v.rows)||v.rows.length>10)return reject();
 let prior="";const rows=v.rows.map(x=>{const l=parseLead(x);if(l.id<=prior||(selected&&!selected.includes(l.id)))return reject();prior=l.id;return l;});return {id,rows};
}
export function parseBulk(v:unknown,id:string,count:number){
 if(!exact(v,"count,id")||v.id!==id||v.count!==count||!Number.isInteger(count)||count<1||count>10)return reject();return {id,count};
}

export class CiP5ExportBulk extends CiP5CrmSettings{
 async createExport(x:StageIdentity,org:string,raw:unknown){const args=this.scope(x,org);if(!exportCommand(raw))throw new LeadError(400);
 return this.transaction(true,async c=>parseExport((await c.query("SELECT p5_ci.write_export($1,$2,$3,$4,$5::uuid[]) AS data",[...args,raw.id,raw.leadIds])).rows[0]?.data,raw.id,raw.leadIds));}
 async exportStatus(x:StageIdentity,org:string,id:unknown){const args=this.scope(x,org);if(!uuid(id))throw new LeadError(400);
 return this.transaction(false,async c=>parseExport((await c.query("SELECT p5_ci.read_export($1,$2,$3,$4) AS data",[...args,id])).rows[0]?.data,id));}
 async bulkLeads(x:StageIdentity,org:string,raw:unknown){const args=this.scope(x,org);if(!bulkCommand(raw))throw new LeadError(400);
 return this.transaction(true,async c=>parseBulk((await c.query("SELECT p5_ci.write_bulk($1,$2,$3,$4,$5,$6,$7::jsonb) AS data",[...args,raw.id,raw.action,raw.target,JSON.stringify(raw.items)])).rows[0]?.data,raw.id,raw.items.length));}
}
