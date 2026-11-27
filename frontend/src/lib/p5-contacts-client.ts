import {isStageOrgId} from "./staging-membership";
import {LeadClientError} from "./p5-leads-client";
import {createP5RecordTransport} from "./p5-accounts-client";
export type Contact={id:string;displayName:string;email:string;accountId:string|null;revision:number};
export type ContactPage={items:Contact[];nextCursor:string|null};
export type ContactWrite={requestId:string;displayName:string;email:string;accountId:string|null}&({id:string}|{expectedRevision:number});
const reject=():never=>{throw new LeadClientError(503);};
const exact=(x:unknown,k:string):x is Record<string,unknown>=>!!x&&typeof x==="object"&&!Array.isArray(x)&&Object.keys(x).sort().join(",")===k;
export function parseContact(x:unknown):Contact{
 if(!exact(x,"accountId,displayName,email,id,revision")||!isStageOrgId(x.id)||typeof x.displayName!=="string"||!/^Demo [A-Za-z][A-Za-z0-9 .-]{2,74}$/.test(x.displayName)||
 typeof x.email!=="string"||!/^[a-z][a-z0-9._-]{1,40}@example[.]com$/.test(x.email)||(x.accountId!==null&&!isStageOrgId(x.accountId))||typeof x.revision!=="number"||!Number.isInteger(x.revision)||x.revision<0||x.revision>1000000)return reject();
 return {id:x.id,displayName:x.displayName,email:x.email,accountId:x.accountId,revision:x.revision};
}
export function parseContactPage(x:unknown,after:string|null):ContactPage{
 if(!exact(x,"items,nextCursor")||!Array.isArray(x.items)||x.items.length>20)return reject();
 let prior=after;const items=x.items.map(v=>{const row=parseContact(v);if(prior!==null&&row.id<=prior)return reject();prior=row.id;return row;});
 if(x.nextCursor!==null&&(!isStageOrgId(x.nextCursor)||items.length!==20||x.nextCursor!==prior))return reject();
 return {items,nextCursor:x.nextCursor as string|null};
}
export function createP5ContactClient(request:typeof fetch=(url,options)=>fetch(url,options)){
 const call=createP5RecordTransport("contacts",request);
 return {
  async list(org:string,after:string|null=null,search="",duplicate=false){
   if(after!==null&&!isStageOrgId(after))throw new LeadClientError(400);
   const q=new URLSearchParams({search,duplicate:duplicate?"1":"0"});if(after)q.set("after",after);
   const r=await call(org,"?"+q.toString());if(r.status!==200)return reject();return parseContactPage(r.data,after);
  },
  async detail(org:string,id:string){if(!isStageOrgId(id))throw new LeadClientError(400);const r=await call(org,"/"+id);const row=parseContact(r.data);if(r.status!==200||row.id!==id)return reject();return row;},
  async write(org:string,id:string|null,cmd:ContactWrite){
   const target=id??("id" in cmd?cmd.id:null);if(!isStageOrgId(target)||(cmd.accountId!==null&&!isStageOrgId(cmd.accountId)))throw new LeadClientError(400);
   const r=await call(org,id?"/"+id:"",cmd,id?"PATCH":"POST");
   if(!exact(r.data,"outcome,record")||!((r.status===200&&r.data.outcome==="replay")||(id===null?r.status===201&&r.data.outcome==="created":r.status===200&&r.data.outcome==="applied")))return reject();
   const record=parseContact(r.data.record);if(record.id!==target)return reject();return record;
  }
 };
}
export type ContactClient=ReturnType<typeof createP5ContactClient>;
