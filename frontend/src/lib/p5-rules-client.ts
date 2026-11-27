import {createP5RecordTransport} from "./p5-accounts-client";
import {isStageOrgId as uuid} from "./staging-membership";
import {LeadClientError,parseLead,createP5LeadClient} from "./p5-leads-client";
const reject=():never=>{throw new LeadClientError(503);};
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

export function createP5RulesClient(request:typeof fetch=(u,o)=>fetch(u,o)){
 const score=createP5RecordTransport("lead-scoring",request),assign=createP5RecordTransport("assignment-rules",request),leads=createP5RecordTransport("leads",request),existing=createP5LeadClient(request);
 return {
 async read(org:string,id:string){if(!uuid(id))throw new LeadClientError(400);const r=await score(org,"/"+id);if(r.status!==200)return reject();return parseRules(r.data,id);},
 async saveScore(org:string,cfg:ScoreConfig){const r=await score(org,"",cfg);if(r.status!==200)return reject();const v=parseConfig(r.data);if(v.revision!==cfg.revision+1)return reject();return v;},
 async qualify(org:string,id:string,cmd:Qualification){if(!uuid(id)||!qualification(cmd))throw new LeadClientError(400);const r=await leads(org,"/"+id+"/qualify",cmd);if(r.status!==200)return reject();const v=parseLead(r.data);if(v.id!==id)return reject();return v;},
 async preview(org:string,id:string){if(!uuid(id))throw new LeadClientError(400);const r=await assign(org,"/"+id);if(r.status!==200)return reject();return parseRulePreview(r.data,id);},
 async saveAssignment(org:string,id:string,cmd:AssignmentRule){if(!uuid(id)||!assignment(cmd))throw new LeadClientError(400);const r=await assign(org,"/"+id,cmd);if(r.status!==200||!exact(r.data,"revision")||r.data.revision!==cmd.expectedRevision+1)return reject();return r.data.revision;},
 async applySuggestion(org:string,id:string,ownerId:string,expectedRevision:number,requestId:string){return existing.assign(org,id,{ownerId,expectedRevision,requestId});}
 };
}
export type RulesClient=ReturnType<typeof createP5RulesClient>;
export type LeadRules=ReturnType<typeof parseRules>;
export type RulePreview=ReturnType<typeof parseRulePreview>;
