import {createP5RecordTransport,parseAccount} from "./p5-accounts-client";
import {isStageOrgId as uuid} from "./staging-membership";
import {LeadClientError} from "./p5-leads-client";
const reject=():never=>{throw new LeadClientError(503);};
const exact=(v:unknown,k:string):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v)&&Object.keys(v).sort().join(",")===k;
const rev=(v:unknown):v is number=>typeof v==="number"&&Number.isInteger(v)&&v>=-1&&v<=1000000;
const locale=(v:unknown):v is "en-US"|"en-GB"=>v==="en-US"||v==="en-GB";
const fieldKind=(v:unknown):v is "BOOLEAN"|"INTEGER"=>v==="BOOLEAN"||v==="INTEGER";
const label=(v:unknown):v is string=>typeof v==="string"&&/^Demo [A-Za-z][A-Za-z0-9 ]{2,34}$/.test(v);
const position=(v:unknown):v is number=>typeof v==="number"&&Number.isInteger(v)&&v>=1&&v<=10;
const value=(v:unknown):v is number|boolean=>typeof v==="boolean"||(typeof v==="number"&&Number.isInteger(v)&&v>=0&&v<=99999);
export type SettingsWrite={locale:"en-US"|"en-GB";expectedRevision:number};
export type RelationWrite={parentId:string|null;expectedRevision:number};
export type DefinitionWrite={id:string;label:string;kind:"BOOLEAN"|"INTEGER";position:number};
export type ValueWrite={fieldId:string;value:number|boolean;expectedRevision:number};
export function parseSettings(v:unknown){
 if(!exact(v,"defaultPipelineId,locale,permissions,revision")||!locale(v.locale)||!rev(v.revision)||(v.defaultPipelineId!==null&&!uuid(v.defaultPipelineId))||!exact(v.permissions,"admin,custom,manager")||typeof v.permissions.admin!=="boolean"||typeof v.permissions.custom!=="boolean"||typeof v.permissions.manager!=="boolean"||(v.permissions.admin&&!v.permissions.manager))return reject();
 return {locale:v.locale,revision:v.revision,defaultPipelineId:v.defaultPipelineId,permissions:{admin:v.permissions.admin,manager:v.permissions.manager,custom:v.permissions.custom}};
}
export function parseRelations(v:unknown,id:string){
 if(!exact(v,"candidates,children,id,parentId,revision")||v.id!==id||!rev(v.revision)||(v.parentId!==null&&(!uuid(v.parentId)||v.parentId===id))||!Array.isArray(v.children)||!Array.isArray(v.candidates)||v.children.length>20||v.candidates.length>20)return reject();
 function records(xs:unknown[]){let previous="";return xs.map(x=>{const a=parseAccount(x);if(a.id===id||a.id<=previous)return reject();previous=a.id;return a;});}
 return {id,parentId:v.parentId as string|null,revision:v.revision,children:records(v.children),candidates:records(v.candidates)};
}
export type CustomField={id:string;label:string;kind:"BOOLEAN"|"INTEGER";position:number;value:number|boolean|null;revision:number};
export function parseFields(v:unknown,id:string){
 if(!exact(v,"accountId,fields")||v.accountId!==id||!Array.isArray(v.fields)||v.fields.length>10)return reject();
 let previous=0;const ids=new Set<string>();return v.fields.map((x:unknown):CustomField=>{
 if(!exact(x,"id,kind,label,position,revision,value")||!uuid(x.id)||ids.has(x.id)||!label(x.label)||!fieldKind(x.kind)||!position(x.position)||x.position<=previous||!rev(x.revision)||(x.revision===-1?x.value!==null:(!value(x.value)||(x.kind==="BOOLEAN"?typeof x.value!=="boolean":typeof x.value!=="number"))))return reject();
 previous=x.position;ids.add(x.id);return {id:x.id,label:x.label,kind:x.kind,position:x.position,value:x.value as number|boolean|null,revision:x.revision};});
}
const settingsWrite=(v:unknown):v is SettingsWrite=>exact(v,"expectedRevision,locale")&&locale(v.locale)&&rev(v.expectedRevision)&&v.expectedRevision<1000000;
const relationWrite=(v:unknown):v is RelationWrite=>exact(v,"expectedRevision,parentId")&&rev(v.expectedRevision)&&v.expectedRevision<1000000&&(v.parentId===null||uuid(v.parentId));
const definitionWrite=(v:unknown):v is DefinitionWrite=>exact(v,"id,kind,label,position")&&uuid(v.id)&&label(v.label)&&fieldKind(v.kind)&&position(v.position);
const valueWrite=(v:unknown):v is ValueWrite=>exact(v,"expectedRevision,fieldId,value")&&uuid(v.fieldId)&&value(v.value)&&rev(v.expectedRevision)&&v.expectedRevision<1000000;
function revisionReceipt(v:unknown,expected:number){if(!exact(v,"revision")||v.revision!==expected+1)return reject();return {revision:v.revision};}

export function createP5SettingsClient(request:typeof fetch=(u,o)=>fetch(u,o)){
 const settings=createP5RecordTransport("settings",request),accounts=createP5RecordTransport("accounts",request),custom=createP5RecordTransport("custom-fields",request);
 return {
 async settings(org:string){const r=await settings(org,"");if(r.status!==200)return reject();return parseSettings(r.data);},
 async saveSettings(org:string,v:SettingsWrite){if(!settingsWrite(v))throw new LeadClientError(400);const r=await settings(org,"",v,"PATCH");if(r.status!==200)return reject();const cfg=parseSettings(r.data);if(cfg.locale!==v.locale||cfg.revision!==v.expectedRevision+1)return reject();return cfg;},
 async relations(org:string,id:string){if(!uuid(id))throw new LeadClientError(400);const r=await accounts(org,"/"+id+"/relations");if(r.status!==200)return reject();return parseRelations(r.data,id);},
 async saveRelation(org:string,id:string,v:RelationWrite){if(!uuid(id)||!relationWrite(v)||v.parentId===id)throw new LeadClientError(400);const r=await accounts(org,"/"+id+"/relations",v);if(r.status!==200)return reject();return revisionReceipt(r.data,v.expectedRevision);},
 async fields(org:string,id:string){if(!uuid(id))throw new LeadClientError(400);const r=await custom(org,"/"+id);if(r.status!==200)return reject();return parseFields(r.data,id);},
 async createField(org:string,v:DefinitionWrite){if(!definitionWrite(v))throw new LeadClientError(400);const r=await custom(org,"",v);if(r.status!==200||!exact(r.data,"id")||r.data.id!==v.id)return reject();return v.id;},
 async saveValue(org:string,id:string,v:ValueWrite){if(!uuid(id)||!valueWrite(v))throw new LeadClientError(400);const r=await custom(org,"/"+id,v);if(r.status!==200)return reject();return revisionReceipt(r.data,v.expectedRevision);}
 };
}
export type SettingsClient=ReturnType<typeof createP5SettingsClient>;
export type Settings=ReturnType<typeof parseSettings>;
export type Relations=ReturnType<typeof parseRelations>;
