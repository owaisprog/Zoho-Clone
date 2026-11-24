/**
 * R62: coherent CI-only CRM product workflow over 5 existing verified APIs.
 * DB is source of truth; no token in browser-side controller state.
 */
import type {P4R54CiOwnedOrganizationsClient,P4R54OwnedOrganization}
 from "./p4-r54-ci-owned-organizations-client";
import type {P4R57CiCrmLeadClient,P4R57Lead,P4R57NewLead}
 from "./p4-r57-ci-crm-lead-client";
import type {P4R58CiLeadStageClient,P4R58LeadHistory,P4R58Status}
 from "./p4-r58-ci-crm-lead-stage-client";
import type {P4R60CiCrmLeadPageClient,P4R60LeadFilter}
 from "./p4-r60-ci-crm-lead-page-client";
import type {P4R61CiLeadNotesClient,P4R61LeadNote}
 from "./p4-r61-ci-lead-notes-client";
export type P4R62CiCrmView=Readonly<{
 phase:"idle"|"loading"|"ready"|"denied";
 orgId:string|null;organizations:readonly P4R54OwnedOrganization[];
 leads:readonly P4R57Lead[];selectedLeadId:string|null;
 history:readonly P4R58LeadHistory[];notes:readonly P4R61LeadNote[];
 filter:P4R60LeadFilter;search:string;nextCursor:string|null;
 message:string;
}>;
const EMPTY:P4R62CiCrmView=Object.freeze({
 phase:"idle",orgId:null,organizations:Object.freeze([]),
 leads:Object.freeze([]),selectedLeadId:null,history:Object.freeze([]),
 notes:Object.freeze([]),filter:"all",search:"",nextCursor:null,
 message:"Fictional persisted CRM inactive",
});
const FILTERS=new Set(["all","NEW","CONTACTED","QUALIFIED","LOST"]);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export class P4R62CiCrmWorkspaceController{
 private epoch=0;
 private state:P4R62CiCrmView=EMPTY;
 constructor(
  private readonly owners:Pick<P4R54CiOwnedOrganizationsClient,"list">,
  private readonly pager:Pick<P4R60CiCrmLeadPageClient,"page">,
  private readonly leads:Pick<P4R57CiCrmLeadClient,"create">,
  private readonly stages:Pick<P4R58CiLeadStageClient,"change"|"history">,
  private readonly notes:Pick<P4R61CiLeadNotesClient,"add"|"list">){}
 snapshot():P4R62CiCrmView{return this.state;}
 private fail():P4R62CiCrmView{
  this.state=Object.freeze({...EMPTY,phase:"denied",
   message:"CRM workspace denied; previously visible tenant data cleared"});
  return this.state;
 }
 private clear(org:string|null):number{
  const seq=++this.epoch;
  this.state=Object.freeze({...EMPTY,phase:"loading",orgId:org,
   message:"Verifying owner and refreshing persisted CRM records"});
  return seq;
 }
 private valid(filter:P4R60LeadFilter,search:string):boolean{
  return FILTERS.has(filter)&&typeof search==="string"&&
   search.length<=40&&/^[a-zA-Z0-9._@ -]*$/.test(search);
 }
 private validateHistory(lead:P4R57Lead,
  events:readonly P4R58LeadHistory[]):boolean{
  const last=events.at(-1);
  return !!last&&last.revision===lead.revision&&
   last.afterStatus===lead.status&&
   (lead.revision===0?last.eventKind==="CREATED":
    last.eventKind==="STATUS_CHANGED");
 }
 private async load(org:string|null,filter:P4R60LeadFilter="all",
  search:string="",selection:string|null=null):Promise<P4R62CiCrmView>{
  const seq=this.clear(org);
  if(!this.valid(filter,search))return this.fail();
  try{
   const organizations=await this.owners.list();
   if(seq!==this.epoch)return this.state;
   if(organizations.length===0)return this.fail();
   const chosen=org??organizations[0]!.id;
   if(!organizations.some(x=>x.id===chosen))return this.fail();
   const page=await this.pager.page(chosen,filter,search,null);
   if(seq!==this.epoch)return this.state;
   let history:readonly P4R58LeadHistory[]=[];
   let notes:readonly P4R61LeadNote[]=[];
   if(selection!==null){
    const lead=page.items.find(x=>x.leadId===selection);
    if(!lead)return this.fail();
    [history,notes]=await Promise.all([
     this.stages.history(chosen,selection),
     this.notes.list(chosen,selection),
    ]);
    if(seq!==this.epoch)return this.state;
    if(!this.validateHistory(lead,history)||
     notes.some(n=>n.leadId!==selection))return this.fail();
   }
   this.state=Object.freeze({...EMPTY,phase:"ready",orgId:chosen,
    organizations,leads:page.items,filter,search,
    nextCursor:page.nextCursor,selectedLeadId:selection,
    history,notes,message:"Signed fictional CRM with persisted lead pages and notes"});
  }catch{if(seq===this.epoch)return this.fail();}
  return this.state;
 }
 discover(preferred?:string):Promise<P4R62CiCrmView>{
  return this.load(preferred??null);
 }
 selectOrg(org:string):Promise<P4R62CiCrmView>{
  if(this.state.phase!=="ready"||
   !this.state.organizations.some(x=>x.id===org))
   return Promise.resolve(this.fail());
  return this.load(org);
 }
 refresh():Promise<P4R62CiCrmView>{
  const v=this.state;
  if(v.phase!=="ready"||!v.orgId)return Promise.resolve(this.fail());
  return this.load(v.orgId,v.filter,v.search);
 }
 search(filter:P4R60LeadFilter,query:string=""):Promise<P4R62CiCrmView>{
  const v=this.state;
  if(v.phase!=="ready"||!v.orgId)return Promise.resolve(this.fail());
  return this.load(v.orgId,filter,query);
 }
 async more():Promise<P4R62CiCrmView>{
  const v=this.state;
  if(v.phase!=="ready"||!v.orgId||!v.nextCursor)
   return this.fail();
  const seq=this.clear(v.orgId);
  try{
   const page=await this.pager.page(v.orgId,v.filter,v.search,v.nextCursor);
   if(seq!==this.epoch)return this.state;
   const items=[...v.leads,...page.items];
   if(new Set(items.map(x=>x.leadId)).size!==items.length||
    new Set(items.map(x=>x.contactEmail)).size!==items.length||
    items.some((x,i)=>i>0&&x.createdAt>items[i-1]!.createdAt))
    return this.fail();
   this.state=Object.freeze({...v,phase:"ready",leads:Object.freeze(items),
    nextCursor:page.nextCursor,message:"Additional fictional CRM leads loaded"});
  }catch{if(seq===this.epoch)return this.fail();}
  return this.state;
 }
 async selectLead(leadId:string):Promise<P4R62CiCrmView>{
  const v=this.state;
  if(v.phase!=="ready"||!v.orgId||
   typeof leadId!=="string"||!UUID.test(leadId))
   return this.fail();
  const lead=v.leads.find(x=>x.leadId===leadId);
  if(!lead)return this.fail();
  const seq=this.clear(v.orgId);
  try{
   const [history,notes]=await Promise.all([
    this.stages.history(v.orgId,leadId),this.notes.list(v.orgId,leadId)]);
   if(seq!==this.epoch)return this.state;
   if(!this.validateHistory(lead,history)||
    notes.some(n=>n.leadId!==leadId))return this.fail();
   this.state=Object.freeze({...v,phase:"ready",selectedLeadId:leadId,
    history,notes,message:"Verified fictional lead history and immutable notes"});
  }catch{if(seq===this.epoch)return this.fail();}
  return this.state;
 }
 async create(input:P4R57NewLead):Promise<P4R62CiCrmView>{
  const v=this.state;
  if(v.phase!=="ready"||!v.orgId)return this.fail();
  const seq=this.clear(v.orgId);
  try{
   const created=await this.leads.create(v.orgId,input);
   if(seq!==this.epoch)return this.state;
   return this.load(v.orgId,"all","",created.leadId);
  }catch{if(seq===this.epoch)return this.fail();}
  return this.state;
 }
 async changeStage(next:P4R58Status):Promise<P4R62CiCrmView>{
  const v=this.state;
  const lead=v.leads.find(x=>x.leadId===v.selectedLeadId);
  if(v.phase!=="ready"||!v.orgId||!lead||
   !((lead.status==="NEW"&&next==="CONTACTED")||
    (lead.status==="CONTACTED"&&(next==="QUALIFIED"||next==="LOST"))))
   return this.fail();
  const seq=this.clear(v.orgId);
  try{
   const confirmed=await this.stages.change(v.orgId,lead.leadId,
    next,lead.revision);
   if(seq!==this.epoch)return this.state;
   const [history,notes]=await Promise.all([
    this.stages.history(v.orgId,lead.leadId),
    this.notes.list(v.orgId,lead.leadId),
   ]);
   if(seq!==this.epoch)return this.state;
   if(confirmed.leadId!==lead.leadId||
    confirmed.revision!==lead.revision+1||confirmed.status!==next||
    !this.validateHistory(confirmed,history)||
    notes.some(n=>n.leadId!==lead.leadId))
    return this.fail();
   const updated=v.leads.map(x=>x.leadId===lead.leadId?confirmed:x);
   this.state=Object.freeze({...v,phase:"ready",
    leads:Object.freeze(updated),
    selectedLeadId:lead.leadId,history,notes,
    message:"Signed fictional CRM status saved with immutable audit"});
  }catch{if(seq===this.epoch)return this.fail();}
  return this.state;
 }
 async addNote(text:string):Promise<P4R62CiCrmView>{
  const v=this.state,lead=v.leads.find(x=>x.leadId===v.selectedLeadId);
  if(v.phase!=="ready"||!v.orgId||!lead)return this.fail();
  const seq=this.clear(v.orgId);
  try{
   const saved=await this.notes.add(v.orgId,lead.leadId,text);
   if(seq!==this.epoch)return this.state;
   const notes=await this.notes.list(v.orgId,lead.leadId);
   if(seq!==this.epoch)return this.state;
   if(saved.leadId!==lead.leadId||saved.noteText!==text||
    !notes.some(n=>n.noteId===saved.noteId)||
    notes.some(n=>n.leadId!==lead.leadId))return this.fail();
   this.state=Object.freeze({...v,phase:"ready",notes,
    message:"Immutable fictional CRM follow-up note saved and reread"});
  }catch{if(seq===this.epoch)return this.fail();}
  return this.state;
 }
 reset():void{++this.epoch;this.state=EMPTY;}
}
