/** R58 fictional CRM lead detail: live list + verified immutable stage history. */
import type {P4R57CiCrmLeadClient,P4R57Lead}
 from "./p4-r57-ci-crm-lead-client";
import type {P4R58CiLeadStageClient,P4R58LeadHistory,P4R58Status}
 from "./p4-r58-ci-crm-lead-stage-client";
export type P4R58CiLeadDetail=Readonly<{
 phase:"idle"|"ready"|"denied";
 orgId:string|null;leadId:string|null;
 lead:P4R57Lead|null;history:readonly P4R58LeadHistory[];
 message:string;
}>;
const EMPTY:P4R58CiLeadDetail=Object.freeze({
 phase:"idle",orgId:null,leadId:null,lead:null,
 history:Object.freeze([]),message:"Fictional CRM lead detail inactive",
});
export class P4R58CiLeadDetailController{
 private epoch=0;
 private state:P4R58CiLeadDetail=EMPTY;
 constructor(private readonly leads:Pick<P4R57CiCrmLeadClient,"list">,
  private readonly stages:Pick<P4R58CiLeadStageClient,"history"|"change">){}
 snapshot():P4R58CiLeadDetail{return this.state;}
 private denied():P4R58CiLeadDetail{
  this.state=Object.freeze({...EMPTY,phase:"denied",
   message:"Lead detail unavailable; all previously shown data cleared"});
  return this.state;
 }
 async load(org:string,leadId:string):Promise<P4R58CiLeadDetail>{
  const seq=++this.epoch;this.state=EMPTY;
  try{
   const [records,events]=await Promise.all([
    this.leads.list(org),this.stages.history(org,leadId),
   ]);
   if(seq!==this.epoch)return this.state;
   const lead=records.find(x=>x.leadId===leadId);
   const last=events.at(-1);
   if(!lead||!last||last.revision!==lead.revision||
    last.afterStatus!==lead.status||last.eventKind===(lead.revision>0?"CREATED":"STATUS_CHANGED"))
    return this.denied();
   this.state=Object.freeze({phase:"ready",orgId:org,leadId,
    lead,history:events,message:"Persisted CRM lead details and audit history"});
  }catch{if(seq===this.epoch)return this.denied();}
  return this.state;
 }
 async change(org:string,status:P4R58Status):Promise<P4R58CiLeadDetail>{
  const v=this.state;
  if(v.phase!=="ready"||v.orgId!==org||!v.lead||!v.leadId)
   return this.denied();
  const allowed=(v.lead.status==="NEW"&&status==="CONTACTED")||
   (v.lead.status==="CONTACTED"&&
    (status==="QUALIFIED"||status==="LOST"));
  if(!allowed)return this.denied();
  const seq=++this.epoch;
  this.state=EMPTY;
  try{
   await this.stages.change(org,v.leadId,status,v.lead.revision);
   if(seq!==this.epoch)return this.state;
   return this.load(org,v.leadId);
  }catch{if(seq===this.epoch)return this.denied();}
  return this.state;
 }
 reset():void{++this.epoch;this.state=EMPTY;}
}
