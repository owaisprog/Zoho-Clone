import {createP5RecordTransport} from "./p5-accounts-client";
import {isStageOrgId as uuid} from "./staging-membership";
import {LeadClientError} from "./p5-leads-client";
import {parseIntakeCsv,validIntakeRow} from "./p5-intake-csv";
const reject=():never=>{throw new LeadClientError(503);};
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

export function createP5IntakeClient(request:typeof fetch=(u,o)=>fetch(u,o)){
 const call=createP5RecordTransport("imports",request);
 return {
 async submit(org:string,id:string,csv:string){
 if(!uuid(id))throw new LeadClientError(400);let rows;try{rows=parseIntakeCsv(csv);}catch{throw new LeadClientError(400);}
 const r=await call(org,"/leads",{id,csv});if(r.status!==200)return reject();const result=parseImport(r.data,id);if(result.rows.length!==rows.length)return reject();return result;
 },
 async status(org:string,id:string){if(!uuid(id))throw new LeadClientError(400);const r=await call(org,"/"+id);if(r.status!==200)return reject();return parseImport(r.data,id);},
 async capture(t:string,cmd:CaptureCommand){
 if(!token(t)||!capture(cmd))throw new LeadClientError(400);
 const r=await request("/api/p5/public/lead-capture/"+t,{method:"POST",headers:{"X-P5-Leads":"1",Accept:"application/json","Content-Type":"application/json"},body:JSON.stringify(cmd),credentials:"omit",cache:"no-store",redirect:"error",signal:AbortSignal.timeout(8000)});
 if(!r.ok)throw new LeadClientError(r.status);if(r.status!==200||!r.headers.get("content-type")?.includes("application/json"))return reject();
 const v:unknown=await r.json();if(!exact(v,"applicationAccess,data,scope")||v.applicationAccess!==false||v.scope!=="p5-synthetic"||!exact(v.data,"outcome")||v.data.outcome!=="ACCEPTED")return reject();
 return {outcome:"ACCEPTED" as const};
 }
 };
}
export type IntakeClient=ReturnType<typeof createP5IntakeClient>;
