import {CiP5Duplicates} from "./p5-ci-duplicates.js";
import {LeadError} from "./p5-ci-leads.js";
import {isCanonicalUuidV4 as uuid} from "./p4-approved-uuid.js";
import type {StageIdentity} from "./staging-membership-db.js";
import {parseIntakeCsv,validIntakeRow} from "./p5-intake-csv.js";
const reject=():never=>{throw new LeadError(503);};
const exact=(v:unknown,k:string):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v)&&Object.keys(v).sort().join(",")===k;
export type RowResult={row:number;outcome:"CREATED"|"INVALID"|"DUPLICATE";leadId:string|null};
export type ImportResult={id:string;rows:RowResult[]};
export type CaptureCommand={requestId:string;companyName:string;contactEmail:string;consent:boolean;website:string};
const token=(v:unknown):v is string=>typeof v==="string"&&/^[a-f0-9]{64}$/.test(v);
const capture=(v:unknown):v is CaptureCommand=>exact(v,"companyName,consent,contactEmail,requestId,website")&&uuid(v.requestId)&&typeof v.companyName==="string"&&typeof v.contactEmail==="string"&&validIntakeRow([v.companyName,v.contactEmail,"WEBSITE"])&&v.consent===true&&v.website==="";
export function parseImport(v:unknown,id:string):ImportResult{
 if(!exact(v,"id,rows")||v.id!==id||!Array.isArray(v.rows)||v.rows.length<1||v.rows.length>20)return reject();
 const ids=new Set<string>();const rows=v.rows.map((x:unknown,i:number):RowResult=>{
 if(!exact(x,"leadId,outcome,row")||x.row!==i+1||(x.outcome!=="CREATED"&&x.outcome!=="INVALID"&&x.outcome!=="DUPLICATE")||(x.outcome==="CREATED"?!uuid(x.leadId):x.leadId!==null))return reject();
 if(typeof x.leadId==="string"){if(ids.has(x.leadId))return reject();ids.add(x.leadId);}
 return {row:i+1,outcome:x.outcome,leadId:x.leadId as string|null};});return {id,rows};
}

export class CiP5Intake extends CiP5Duplicates{
 async importLeads(x:StageIdentity,org:string,raw:unknown){
 const args=this.scope(x,org);if(!exact(raw,"csv,id")||!uuid(raw.id))throw new LeadError(400);const id=raw.id;
 let rows:(string[]|null)[];try{rows=parseIntakeCsv(raw.csv).map(row=>validIntakeRow(row)?row:null);}catch{throw new LeadError(400);}
 return this.transaction(true,async c=>{const result=parseImport((await c.query("SELECT p5_ci.write_import($1,$2,$3,$4,$5::jsonb) AS data",[...args,id,JSON.stringify(rows)])).rows[0]?.data,id);if(result.rows.length!==rows.length)return reject();return result;});
 }
 async importStatus(x:StageIdentity,org:string,id:unknown){
 const args=this.scope(x,org);if(!uuid(id))throw new LeadError(400);
 return this.transaction(false,async c=>parseImport((await c.query("SELECT p5_ci.read_import($1,$2,$3,$4) AS data",[...args,id])).rows[0]?.data,id));
 }
 async captureLead(t:unknown,raw:unknown){
 if(!token(t)||!capture(raw))throw new LeadError(400);
 return this.transaction(true,async c=>{const v:unknown=(await c.query("SELECT p5_ci.capture_lead($1,$2,$3,$4,$5,$6) AS data",[t,raw.requestId,raw.companyName,raw.contactEmail,raw.consent,raw.website])).rows[0]?.data;
 if(!exact(v,"outcome")||v.outcome!=="ACCEPTED")return reject();return {outcome:"ACCEPTED" as const};});
 }
}
