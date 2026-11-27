import {createP5RecordTransport} from "./p5-accounts-client";
import {isStageOrgId as uuid} from "./staging-membership";
import {LeadClientError,parseLead,createP5LeadClient,type Lead} from "./p5-leads-client";
const reject=():never=>{throw new LeadClientError(503);};
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

export function exportCsv(rows:Lead[]):string{
 const cell=(s:string)=>'"'+(/^[=+\-@\t\r\n]/.test(s)?"'":"")+s.replace(/"/g,'""')+'"';
 return ["id,companyName,contactEmail,source,status,revision",...rows.map(l=>[l.id,l.companyName,l.contactEmail,l.source,l.status,String(l.revision)].map(cell).join(","))].join("\r\n")+"\r\n";
}
export function createP5BulkClient(request:typeof fetch=(u,o)=>fetch(u,o)){
 const exp=createP5RecordTransport("exports",request),bulk=createP5RecordTransport("bulk",request),leads=createP5LeadClient(request);
 return {
 list:leads.list,
 async createExport(org:string,cmd:ExportCommand){if(!exportCommand(cmd))throw new LeadClientError(400);const r=await exp(org,"",cmd);if(r.status!==200)return reject();return parseExport(r.data,cmd.id,cmd.leadIds);},
 async status(org:string,id:string){if(!uuid(id))throw new LeadClientError(400);const r=await exp(org,"/"+id);if(r.status!==200)return reject();return parseExport(r.data,id);},
 async bulk(org:string,cmd:BulkCommand){if(!bulkCommand(cmd))throw new LeadClientError(400);const r=await bulk(org,"",cmd);if(r.status!==200)return reject();return parseBulk(r.data,cmd.id,cmd.items.length);}
 };
}
export type BulkClient=ReturnType<typeof createP5BulkClient>;
export type ExportResult=ReturnType<typeof parseExport>;
