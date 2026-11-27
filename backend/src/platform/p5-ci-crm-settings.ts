import {CiP5LeadRules} from "./p5-ci-lead-rules.js";
import {LeadError} from "./p5-ci-leads.js";
import {parseAccount} from "./p5-ci-accounts.js";
import {isCanonicalUuidV4 as uuid} from "./p4-approved-uuid.js";
import type {StageIdentity} from "./staging-membership-db.js";
const reject=():never=>{throw new LeadError(503);};
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

export class CiP5CrmSettings extends CiP5LeadRules{
 async crmSettings(x:StageIdentity,org:string){const args=this.scope(x,org);return this.transaction(false,async c=>parseSettings((await c.query("SELECT p5_ci.read_crm_settings($1,$2,$3) AS data",args)).rows[0]?.data));}
 async saveCrmSettings(x:StageIdentity,org:string,raw:unknown){const args=this.scope(x,org);if(!settingsWrite(raw))throw new LeadError(400);return this.transaction(true,async c=>{const s=parseSettings((await c.query("SELECT p5_ci.write_crm_settings($1,$2,$3,$4,$5) AS data",[...args,raw.locale,raw.expectedRevision])).rows[0]?.data);if(s.revision!==raw.expectedRevision+1||s.locale!==raw.locale)return reject();return s;});}
 async accountRelations(x:StageIdentity,org:string,id:unknown){const args=this.scope(x,org);if(!uuid(id))throw new LeadError(400);return this.transaction(false,async c=>parseRelations((await c.query("SELECT p5_ci.read_relations($1,$2,$3,$4) AS data",[...args,id])).rows[0]?.data,id));}
 async saveRelation(x:StageIdentity,org:string,id:unknown,raw:unknown){const args=this.scope(x,org);if(!uuid(id)||!relationWrite(raw)||raw.parentId===id)throw new LeadError(400);return this.transaction(true,async c=>revisionReceipt((await c.query("SELECT p5_ci.write_relation($1,$2,$3,$4,$5,$6) AS data",[...args,id,raw.parentId,raw.expectedRevision])).rows[0]?.data,raw.expectedRevision));}
 async customFields(x:StageIdentity,org:string,id:unknown){const args=this.scope(x,org);if(!uuid(id))throw new LeadError(400);return this.transaction(false,async c=>({accountId:id,fields:parseFields((await c.query("SELECT p5_ci.read_custom_fields($1,$2,$3,$4) AS data",[...args,id])).rows[0]?.data,id)}));}
 async createCustomField(x:StageIdentity,org:string,raw:unknown){const args=this.scope(x,org);if(!definitionWrite(raw))throw new LeadError(400);return this.transaction(true,async c=>{const v:unknown=(await c.query("SELECT p5_ci.create_custom_field($1,$2,$3,$4,$5,$6,$7) AS data",[...args,raw.id,raw.label,raw.kind,raw.position])).rows[0]?.data;if(!exact(v,"id")||v.id!==raw.id)return reject();return {id:raw.id};});}
 async saveCustomValue(x:StageIdentity,org:string,id:unknown,raw:unknown){const args=this.scope(x,org);if(!uuid(id)||!valueWrite(raw))throw new LeadError(400);return this.transaction(true,async c=>revisionReceipt((await c.query("SELECT p5_ci.write_custom_value($1,$2,$3,$4,$5,$6::jsonb,$7) AS data",[...args,id,raw.fieldId,JSON.stringify(raw.value),raw.expectedRevision])).rows[0]?.data,raw.expectedRevision));}
}
