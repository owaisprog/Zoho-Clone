import {CiP5Intake} from "./p5-ci-intake.js";
import {LeadError,parseLead} from "./p5-ci-leads.js";
import {isCanonicalUuidV4 as uuid} from "./p4-approved-uuid.js";
import type {StageIdentity} from "./staging-membership-db.js";
const reject=():never=>{throw new LeadError(503);};
const exact=(x:unknown,k:string):x is Record<string,unknown>=>!!x&&typeof x==="object"&&!Array.isArray(x)&&Object.keys(x).sort().join(",")===k;
const integer=(x:unknown,min:number,max:number):x is number=>typeof x==="number"&&Number.isInteger(x)&&x>=min&&x<=max;
const source=(x:unknown):x is "WEBSITE"|"REFERRAL"|"EVENT"=>x==="WEBSITE"||x==="REFERRAL"||x==="EVENT";
const status=(x:unknown):x is "NEW"|"CONTACTED"|"QUALIFIED"|"LOST"|"CONVERTED"=>x==="NEW"||x==="CONTACTED"||x==="QUALIFIED"||x==="LOST"||x==="CONVERTED";
const reason=(x:unknown):x is "FIT"|"NOT_FIT"|"NO_INTEREST"=>x==="FIT"||x==="NOT_FIT"||x==="NO_INTEREST";
export type ScoreConfig={website:number;referral:number;event:number;contacted:number;qualified:number;revision:number};
export function parseConfig(v:unknown):ScoreConfig{
 if(!exact(v,"contacted,event,qualified,referral,revision,website")||!integer(v.website,0,30)||!integer(v.referral,0,30)||!integer(v.event,0,30)||!integer(v.contacted,0,30)||!integer(v.qualified,0,70)||!integer(v.revision,-1,1000000))return reject();
 return {website:v.website,referral:v.referral,event:v.event,contacted:v.contacted,qualified:v.qualified,revision:v.revision};
}
export function parseRules(v:unknown,id:string){
 if(!exact(v,"config,id,latestSource,originalSource,reason,revision,score,sourcePoints,status,statusPoints")||v.id!==id||!source(v.originalSource)||!source(v.latestSource)||!status(v.status)||!integer(v.revision,0,1000000)||(v.reason!==null&&!reason(v.reason)))return reject();
 const config=parseConfig(v.config),sp=v.originalSource==="WEBSITE"?config.website:v.originalSource==="REFERRAL"?config.referral:config.event,qp=v.status==="QUALIFIED"||v.status==="CONVERTED"?config.qualified:v.status==="CONTACTED"?config.contacted:0;
 if(v.sourcePoints!==sp||v.statusPoints!==qp||v.score!==sp+qp)return reject();
 return {id,originalSource:v.originalSource,latestSource:v.latestSource,status:v.status,revision:v.revision,score:sp+qp,sourcePoints:sp,statusPoints:qp,reason:v.reason,config};
}
export function parseRulePreview(v:unknown,id:string){
 if(!exact(v,"eligible,fallbackId,leadId,leadRevision,primaryId,ruleRevision,source,suggestedId")||v.leadId!==id||!integer(v.leadRevision,0,1000000)||!integer(v.ruleRevision,-1,1000000)||!source(v.source)||!Array.isArray(v.eligible)||v.eligible.length>21)return reject();
 const primary=v.primaryId,fallback=v.fallbackId,suggested=v.suggestedId;
 if(v.ruleRevision===-1?(primary!==null||fallback!==null||suggested!==null):(!uuid(primary)||!uuid(fallback)||primary===fallback||(suggested!==null&&suggested!==primary&&suggested!==fallback)))return reject();
 let previous="";const eligible=v.eligible.map((x:unknown)=>{if(!uuid(x)||x<=previous)return reject();previous=x;return x;});
 return {leadId:id,leadRevision:v.leadRevision,ruleRevision:v.ruleRevision,source:v.source,primaryId:primary as string|null,fallbackId:fallback as string|null,suggestedId:suggested as string|null,eligible};
}
export type Qualification={requestId:string;expectedRevision:number;status:"QUALIFIED"|"LOST";reason:"FIT"|"NOT_FIT"|"NO_INTEREST"};
const qualification=(v:unknown):v is Qualification=>exact(v,"expectedRevision,reason,requestId,status")&&uuid(v.requestId)&&integer(v.expectedRevision,0,999999)&&((v.status==="QUALIFIED"&&v.reason==="FIT")||(v.status==="LOST"&&(v.reason==="NOT_FIT"||v.reason==="NO_INTEREST")));
export type AssignmentRule={expectedRevision:number;primaryId:string;fallbackId:string};
const assignment=(v:unknown):v is AssignmentRule=>exact(v,"expectedRevision,fallbackId,primaryId")&&integer(v.expectedRevision,-1,999999)&&uuid(v.primaryId)&&uuid(v.fallbackId)&&v.primaryId!==v.fallbackId;

export class CiP5LeadRules extends CiP5Intake{
 async leadRules(x:StageIdentity,org:string,id:unknown){
 const args=this.scope(x,org);if(!uuid(id))throw new LeadError(400);
 return this.transaction(false,async c=>parseRules((await c.query("SELECT p5_ci.read_lead_rules($1,$2,$3,$4) AS data",[...args,id])).rows[0]?.data,id));
 }
 async saveScoreRule(x:StageIdentity,org:string,raw:unknown){
 const args=this.scope(x,org);let cfg:ScoreConfig;try{cfg=parseConfig(raw);}catch{throw new LeadError(400);}if(cfg.revision>=1000000)throw new LeadError(400);
 return this.transaction(true,async c=>{const v=parseConfig((await c.query("SELECT p5_ci.write_score_rule($1,$2,$3,$4,$5,$6,$7,$8,$9) AS data",[...args,cfg.revision,cfg.website,cfg.referral,cfg.event,cfg.contacted,cfg.qualified])).rows[0]?.data);if(v.revision!==cfg.revision+1||v.website!==cfg.website||v.referral!==cfg.referral||v.event!==cfg.event||v.contacted!==cfg.contacted||v.qualified!==cfg.qualified)return reject();return v;});
 }
 async qualifyWithReason(x:StageIdentity,org:string,id:unknown,raw:unknown){
 const args=this.scope(x,org);if(!uuid(id)||!qualification(raw))throw new LeadError(400);
 return this.transaction(true,async c=>{const v:unknown=(await c.query("SELECT p5_ci.qualify_reason($1,$2,$3,$4,$5,$6,$7,$8) AS data",[...args,id,raw.requestId,raw.expectedRevision,raw.status,raw.reason])).rows[0]?.data;
 if(!exact(v,"lead,outcome")||(v.outcome!=="applied"&&v.outcome!=="replay"))return reject();const lead=parseLead(v.lead);if(lead.id!==id)return reject();return lead;});
 }
 async assignmentRulePreview(x:StageIdentity,org:string,id:unknown){
 const args=this.scope(x,org);if(!uuid(id))throw new LeadError(400);
 return this.transaction(false,async c=>parseRulePreview((await c.query("SELECT p5_ci.read_assignment_rule($1,$2,$3,$4) AS data",[...args,id])).rows[0]?.data,id));
 }
 async saveAssignmentRule(x:StageIdentity,org:string,id:unknown,raw:unknown){
 const args=this.scope(x,org);if(!uuid(id)||!assignment(raw))throw new LeadError(400);
 return this.transaction(true,async c=>{const v:unknown=(await c.query("SELECT p5_ci.write_assignment_rule($1,$2,$3,$4,$5,$6,$7) AS data",[...args,id,raw.expectedRevision,raw.primaryId,raw.fallbackId])).rows[0]?.data;
 if(!exact(v,"revision")||v.revision!==raw.expectedRevision+1)return reject();return {revision:v.revision};});
 }
}
