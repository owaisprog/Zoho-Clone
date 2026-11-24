/** R65 functional synthetic CRM view integrating paged notes and due-date tasks. */
import type {P4R62CiCrmWorkspaceController,P4R62CiCrmView}
 from "./p4-r62-ci-crm-workspace-controller";
import type {P4R57NewLead} from "./p4-r57-ci-crm-lead-client";
import type {P4R58Status} from "./p4-r58-ci-crm-lead-stage-client";
import type {P4R60LeadFilter} from "./p4-r60-ci-crm-lead-page-client";
import type {P4R61LeadNote} from "./p4-r61-ci-lead-notes-client";
import type {P4R63CiNotePageClient}
 from "./p4-r63-ci-note-page-client";
import type {P4R64CiTaskClient,P4R64NewTask,P4R64Task}
 from "./p4-r64-ci-task-client";
export type P4R65View=Readonly<{
 phase:"idle"|"loading"|"ready"|"denied";
 crm:P4R62CiCrmView;tasks:readonly P4R64Task[];
 notes:readonly P4R61LeadNote[];noteNextCursor:string|null;message:string;
}>;
const EMPTY_CRM:P4R62CiCrmView=Object.freeze({
 phase:"idle",orgId:null,organizations:Object.freeze([]),
 leads:Object.freeze([]),selectedLeadId:null,history:Object.freeze([]),
 notes:Object.freeze([]),filter:"all",search:"",nextCursor:null,
 message:"Fictional CRM follow-up inactive",
});
const EMPTY:P4R65View=Object.freeze({
 phase:"idle",crm:EMPTY_CRM,tasks:Object.freeze([]),
 notes:Object.freeze([]),noteNextCursor:null,
 message:"Fictional CRM follow-up inactive",
});
export class P4R65CiFollowUpWorkspaceController{
 private epoch=0;
 private state:P4R65View=EMPTY;
 constructor(
  private readonly crm:P4R62CiCrmWorkspaceController,
  private readonly notePages:Pick<P4R63CiNotePageClient,"page">,
  private readonly tasksApi:Pick<P4R64CiTaskClient,"list"|"create"|"complete">){}
 snapshot():P4R65View{return this.state;}
 private begin():number{
  const seq=++this.epoch;
  this.state=Object.freeze({...EMPTY,phase:"loading",
   message:"Checking signed owner CRM and follow-up records"});
  return seq;
 }
 private fail():P4R65View{
  this.crm.reset();
  this.state=Object.freeze({...EMPTY,phase:"denied",
   message:"CRM follow-up denied; all previous tenant records cleared"});
  return this.state;
 }
 private async perform(action:()=>Promise<P4R62CiCrmView>):
  Promise<P4R65View>{
  const seq=this.begin();
  try{
   const crm=await action();
   if(seq!==this.epoch)return this.state;
   if(crm.phase!=="ready"||!crm.orgId)return this.fail();
   let tasks:readonly P4R64Task[]=Object.freeze([]);
   let notes:readonly P4R61LeadNote[]=Object.freeze([]);
   let noteNextCursor:string|null=null;
   if(crm.selectedLeadId){
    const [taskRows,page]=await Promise.all([
     this.tasksApi.list(crm.orgId,crm.selectedLeadId),
     this.notePages.page(crm.orgId,crm.selectedLeadId,null),
    ]);
    if(seq!==this.epoch)return this.state;
    if(taskRows.some(x=>x.leadId!==crm.selectedLeadId)||
     page.items.some(x=>x.leadId!==crm.selectedLeadId))
     return this.fail();
    tasks=taskRows;notes=page.items;noteNextCursor=page.nextCursor;
   }
   this.state=Object.freeze({phase:"ready",crm,tasks,notes,
    noteNextCursor,message:"Verified fictional CRM tasks and paged notes"});
  }catch{if(seq===this.epoch)return this.fail();}
  return this.state;
 }
 discover(preferred?:string):Promise<P4R65View>{
  return this.perform(()=>this.crm.discover(preferred));
 }
 selectOrg(org:string):Promise<P4R65View>{
  return this.perform(()=>this.crm.selectOrg(org));
 }
 refresh():Promise<P4R65View>{
  return this.perform(()=>this.crm.refresh());
 }
 search(filter:P4R60LeadFilter,query:string):Promise<P4R65View>{
  return this.perform(()=>this.crm.search(filter,query));
 }
 moreLeads():Promise<P4R65View>{
  return this.perform(()=>this.crm.more());
 }
 selectLead(lead:string):Promise<P4R65View>{
  return this.perform(()=>this.crm.selectLead(lead));
 }
 createLead(input:P4R57NewLead):Promise<P4R65View>{
  return this.perform(()=>this.crm.create(input));
 }
 changeStage(next:P4R58Status):Promise<P4R65View>{
  return this.perform(()=>this.crm.changeStage(next));
 }
 addNote(note:string):Promise<P4R65View>{
  return this.perform(()=>this.crm.addNote(note));
 }
 async moreNotes():Promise<P4R65View>{
  const v=this.state,org=v.crm.orgId,lead=v.crm.selectedLeadId;
  if(v.phase!=="ready"||!org||!lead||!v.noteNextCursor)
   return this.fail();
  const seq=this.begin();
  try{
   const page=await this.notePages.page(org,lead,v.noteNextCursor);
   if(seq!==this.epoch)return this.state;
   const notes=[...v.notes,...page.items];
   if(notes.some((x,i)=>x.leadId!==lead||
     (i>0&&x.createdAt>notes[i-1]!.createdAt))||
    new Set(notes.map(x=>x.noteId)).size!==notes.length)
    return this.fail();
   this.state=Object.freeze({...v,phase:"ready",notes:Object.freeze(notes),
    noteNextCursor:page.nextCursor,message:"Older immutable follow-up notes loaded"});
  }catch{if(seq===this.epoch)return this.fail();}
  return this.state;
 }
 private selected():{org:string;lead:string}|null{
  const v=this.state;
  const org=v.crm.orgId,lead=v.crm.selectedLeadId;
  if(v.phase!=="ready"||v.crm.phase!=="ready"||!org||!lead||
   !v.crm.leads.some(x=>x.leadId===lead))return null;
  return {org,lead};
 }
 async createTask(input:P4R64NewTask):Promise<P4R65View>{
  const selection=this.selected();
  if(!selection)return this.fail();
  const v=this.state,seq=this.begin();
  try{
   const added=await this.tasksApi.create(selection.org,selection.lead,input);
   if(seq!==this.epoch)return this.state;
   const tasks=await this.tasksApi.list(selection.org,selection.lead);
   if(seq!==this.epoch)return this.state;
   if(added.leadId!==selection.lead||added.status!=="OPEN"||
    !tasks.some(x=>x.taskId===added.taskId)||
    tasks.some(x=>x.leadId!==selection.lead))
    return this.fail();
   this.state=Object.freeze({...v,phase:"ready",tasks,
    message:"New fictional due-date task created and reread"});
  }catch{if(seq===this.epoch)return this.fail();}
  return this.state;
 }
 async completeTask(taskId:string):Promise<P4R65View>{
  const selection=this.selected(),v=this.state;
  if(!selection||!v.tasks.some(x=>x.taskId===taskId&&
   x.status==="OPEN"&&x.revision===0))return this.fail();
  const seq=this.begin();
  try{
   const completed=await this.tasksApi.complete(selection.org,
    selection.lead,taskId,0);
   if(seq!==this.epoch)return this.state;
   const tasks=await this.tasksApi.list(selection.org,selection.lead);
   if(seq!==this.epoch)return this.state;
   if(completed.taskId!==taskId||completed.leadId!==selection.lead||
    completed.status!=="DONE"||completed.revision!==1||
    !tasks.some(x=>x.taskId===taskId&&x.status==="DONE"&&x.revision===1)||
    tasks.some(x=>x.leadId!==selection.lead))return this.fail();
   this.state=Object.freeze({...v,phase:"ready",tasks,
    message:"CRM follow-up task completed and persisted"});
  }catch{if(seq===this.epoch)return this.fail();}
  return this.state;
 }
 reset():void{++this.epoch;this.crm.reset();this.state=EMPTY;}
}
