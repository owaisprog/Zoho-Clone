/**
 * R59 actual CI-only CRM product workflow across signed owned orgs, persisted
 * lead creation and immutable stage history. All current data is fictional.
 */
import type {P4R54CiOwnedOrganizationsClient,P4R54OwnedOrganization}
 from "./p4-r54-ci-owned-organizations-client";
import type {P4R57CiCrmLeadClient,P4R57Lead,P4R57NewLead,
 P4R57LeadStatus} from "./p4-r57-ci-crm-lead-client";
import type {P4R58CiLeadStageClient,P4R58LeadHistory,P4R58Status}
 from "./p4-r58-ci-crm-lead-stage-client";
export type P4R59LeadFilter="all"|P4R57LeadStatus;
export type P4R59CiCrmView=Readonly<{
 phase:"idle"|"loading"|"ready"|"denied";
 orgId:string|null;organizations:readonly P4R54OwnedOrganization[];
 leads:readonly P4R57Lead[];selectedLeadId:string|null;
 history:readonly P4R58LeadHistory[];filter:P4R59LeadFilter;
 message:string;
}>;
const EMPTY:P4R59CiCrmView=Object.freeze({
 phase:"idle",orgId:null,organizations:Object.freeze([]),
 leads:Object.freeze([]),selectedLeadId:null,history:Object.freeze([]),
 filter:"all",message:"Fictional CRM workspace inactive",
});
const FILTERS=new Set<P4R59LeadFilter>([
 "all","NEW","CONTACTED","QUALIFIED","LOST",
]);
export class P4R59CiCrmWorkspaceController{
 private epoch=0;
 private state:P4R59CiCrmView=EMPTY;
 constructor(
  private readonly owners:Pick<P4R54CiOwnedOrganizationsClient,"list">,
  private readonly leads:Pick<P4R57CiCrmLeadClient,"list"|"create">,
  private readonly stages:Pick<P4R58CiLeadStageClient,"history"|"change">){}
 snapshot():P4R59CiCrmView{return this.state;}
 private fail():P4R59CiCrmView{
  this.state=Object.freeze({...EMPTY,phase:"denied",
   message:"CRM access unavailable; all previously shown records cleared"});
  return this.state;
 }
 private clear(org:string|null):void{
  this.state=Object.freeze({...EMPTY,phase:"loading",orgId:org,
   message:"Checking organization ownership and persisted CRM records"});
 }
 private async hydrate(org:string|null,selection:string|null,
  filter:P4R59LeadFilter="all"):Promise<P4R59CiCrmView>{
  const seq=++this.epoch;
  this.clear(org);
  try{
   const organizations=await this.owners.list();
   if(seq!==this.epoch)return this.state;
   if(organizations.length===0||!FILTERS.has(filter))
    return this.fail();
   const chosen=org??organizations[0]!.id;
   if(!organizations.some(x=>x.id===chosen))return this.fail();
   const rows=await this.leads.list(chosen);
   if(seq!==this.epoch)return this.state;
   let history:readonly P4R58LeadHistory[]=[];
   if(selection!==null){
    const lead=rows.find(x=>x.leadId===selection);
    if(!lead)return this.fail();
    history=await this.stages.history(chosen,selection);
    if(seq!==this.epoch)return this.state;
    const last=history.at(-1);
    if(!last||last.revision!==lead.revision||
     last.afterStatus!==lead.status||
     (lead.revision===0&&last.eventKind!=="CREATED")||
     (lead.revision>0&&last.eventKind!=="STATUS_CHANGED"))
     return this.fail();
   }
   this.state=Object.freeze({phase:"ready",orgId:chosen,
    organizations,leads:rows,selectedLeadId:selection,history,
    filter,message:"Verified fictional CRM leads from disposable PostgreSQL"});
  }catch{if(seq===this.epoch)return this.fail();}
  return this.state;
 }
 discover(preferred?:string):Promise<P4R59CiCrmView>{
  return this.hydrate(preferred??null,null);
 }
 selectOrg(org:string):Promise<P4R59CiCrmView>{
  if(this.state.phase!=="ready"||
   !this.state.organizations.some(x=>x.id===org))
   return Promise.resolve(this.fail());
  return this.hydrate(org,null);
 }
 refresh():Promise<P4R59CiCrmView>{
  if(this.state.phase!=="ready"||!this.state.orgId)
   return Promise.resolve(this.fail());
  return this.hydrate(this.state.orgId,this.state.selectedLeadId,
   this.state.filter);
 }
 setFilter(filter:P4R59LeadFilter):P4R59CiCrmView{
  if(this.state.phase!=="ready"||!FILTERS.has(filter))return this.fail();
  this.state=Object.freeze({...this.state,filter});
  return this.state;
 }
 selectLead(leadId:string):Promise<P4R59CiCrmView>{
  const s=this.state;
  if(s.phase!=="ready"||!s.orgId||
   !s.leads.some(x=>x.leadId===leadId))
   return Promise.resolve(this.fail());
  return this.hydrate(s.orgId,leadId,s.filter);
 }
 async create(input:P4R57NewLead):Promise<P4R59CiCrmView>{
  const s=this.state;
  if(s.phase!=="ready"||!s.orgId)return this.fail();
  const seq=++this.epoch;
  this.clear(s.orgId);
  try{
   const created=await this.leads.create(s.orgId,input);
   if(seq!==this.epoch)return this.state;
   return this.hydrate(s.orgId,created.leadId,s.filter);
  }catch{if(seq===this.epoch)return this.fail();}
  return this.state;
 }
 async changeStage(next:P4R58Status):Promise<P4R59CiCrmView>{
  const s=this.state,lead=s.leads.find(x=>x.leadId===s.selectedLeadId);
  if(s.phase!=="ready"||!s.orgId||!lead||
   !((lead.status==="NEW"&&next==="CONTACTED")||
    (lead.status==="CONTACTED"&&(next==="QUALIFIED"||next==="LOST"))))
   return this.fail();
  const seq=++this.epoch;
  this.clear(s.orgId);
  try{
   await this.stages.change(s.orgId,lead.leadId,next,lead.revision);
   if(seq!==this.epoch)return this.state;
   return this.hydrate(s.orgId,lead.leadId,s.filter);
  }catch{if(seq===this.epoch)return this.fail();}
  return this.state;
 }
 reset():void{++this.epoch;this.state=EMPTY;}
}
