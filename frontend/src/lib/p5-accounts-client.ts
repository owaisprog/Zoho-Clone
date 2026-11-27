import {isStageOrgId} from "./staging-membership";
import {LeadClientError} from "./p5-leads-client";
export type Industry="SERVICES"|"RETAIL"|"TECHNOLOGY"|"OTHER";
export type Account={id:string;name:string;industry:Industry;revision:number};
export type AccountPage={items:Account[];nextCursor:string|null};
export type AccountWrite={requestId:string;name:string;industry:Industry}&({id:string}|{expectedRevision:number});
const reject=():never=>{throw new LeadClientError(503);};
const exact=(x:unknown,k:string):x is Record<string,unknown>=>!!x&&typeof x==="object"&&!Array.isArray(x)&&Object.keys(x).sort().join(",")===k;
export function parseAccount(x:unknown):Account{
 if(!exact(x,"id,industry,name,revision")||!isStageOrgId(x.id)||typeof x.name!=="string"||!/^Demo [A-Za-z][A-Za-z0-9 &.-]{2,74}$/.test(x.name)||
 (x.industry!=="SERVICES"&&x.industry!=="RETAIL"&&x.industry!=="TECHNOLOGY"&&x.industry!=="OTHER")||typeof x.revision!=="number"||!Number.isInteger(x.revision)||x.revision<0||x.revision>1000000)return reject();
 return {id:x.id,name:x.name,industry:x.industry,revision:x.revision};
}
export function parseAccountPage(x:unknown,after:string|null):AccountPage{
 if(!exact(x,"items,nextCursor")||!Array.isArray(x.items)||x.items.length>20)return reject();
 let prior=after;const items=x.items.map(v=>{const row=parseAccount(v);if(prior!==null&&row.id<=prior)return reject();prior=row.id;return row;});
 if(x.nextCursor!==null&&(!isStageOrgId(x.nextCursor)||items.length!==20||x.nextCursor!==prior))return reject();
 return {items,nextCursor:x.nextCursor as string|null};
}
/** Fixed same-origin transport for synthetic CRM resources. No browser identity headers. */
export function createP5RecordTransport(resource:"accounts"|"contacts"|"leads"|"deals"|"pipelines"|"board"|"activities"|"followups"|"reports"|"emails"|"templates"|"handoffs",request:typeof fetch=(url,options)=>fetch(url,options)){
 return async (org:string,path:string,body?:object,method:"POST"|"PATCH"="POST")=>{
  if(!isStageOrgId(org))throw new LeadClientError(400);
  const r=await request("/api/p5/"+org+"/crm/"+resource+path,{method:body?method:"GET",headers:{"X-P5-Leads":"1",Accept:"application/json",...(body?{"Content-Type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{}),credentials:"same-origin",cache:"no-store",redirect:"error",signal:AbortSignal.timeout(8000)});
  if(!r.ok)throw new LeadClientError(r.status);
  if(!r.headers.get("content-type")?.includes("application/json"))return reject();
  const reader=r.body?.getReader();if(!reader)return reject();
  let bytes=0;const parts:Uint8Array[]=[];
  try{for(;;){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>(resource==="board"?65536:resource==="pipelines"?32768:8192)){await reader.cancel();return reject();}parts.push(part.value);}}finally{reader.releaseLock();}
  const joined=new Uint8Array(bytes);let offset=0;for(const part of parts){joined.set(part,offset);offset+=part.length;}
  const x:unknown=JSON.parse(new TextDecoder().decode(joined));
  if(!exact(x,"applicationAccess,data,scope")||x.applicationAccess!==false||x.scope!=="p5-synthetic")return reject();
  return {data:x.data,status:r.status};
 };
}
export function createP5AccountClient(request:typeof fetch=(url,options)=>fetch(url,options)){
 const call=createP5RecordTransport("accounts",request);
 return {
  async list(org:string,after:string|null=null,search="",duplicate=false){
   if(after!==null&&!isStageOrgId(after))throw new LeadClientError(400);
   const q=new URLSearchParams({search,duplicate:duplicate?"1":"0"});if(after)q.set("after",after);
   const r=await call(org,"?"+q.toString());if(r.status!==200)return reject();return parseAccountPage(r.data,after);
  },
  async detail(org:string,id:string){if(!isStageOrgId(id))throw new LeadClientError(400);const r=await call(org,"/"+id);const record=parseAccount(r.data);if(r.status!==200||record.id!==id)return reject();return record;},
  async write(org:string,id:string|null,cmd:AccountWrite){
   const target=id??("id" in cmd?cmd.id:null);if(!isStageOrgId(target))throw new LeadClientError(400);
   const r=await call(org,id?"/"+id:"",cmd,id?"PATCH":"POST");
   if(!exact(r.data,"outcome,record")||!((r.status===200&&r.data.outcome==="replay")||(id===null?r.status===201&&r.data.outcome==="created":r.status===200&&r.data.outcome==="applied")))return reject();
   const record=parseAccount(r.data.record);if(record.id!==target)return reject();return record;
  }
 };
}
export type AccountClient=ReturnType<typeof createP5AccountClient>;
