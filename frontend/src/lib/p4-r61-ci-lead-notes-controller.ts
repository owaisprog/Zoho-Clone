/** R61 owner follow-up notes state; never caches tokens or cross-org notes. */
import type {P4R61CiLeadNotesClient,P4R61LeadNote}
 from "./p4-r61-ci-lead-notes-client";
export type P4R61NoteView=Readonly<{
 phase:"idle"|"ready"|"denied";
 orgId:string|null;leadId:string|null;
 notes:readonly P4R61LeadNote[];message:string;
}>;
const EMPTY:P4R61NoteView=Object.freeze({phase:"idle",orgId:null,
 leadId:null,notes:Object.freeze([]),message:"Fictional CRM notes inactive"});
export class P4R61CiLeadNotesController{
 private epoch=0;
 private state:P4R61NoteView=EMPTY;
 constructor(private readonly client:Pick<P4R61CiLeadNotesClient,"list"|"add">){}
 snapshot():P4R61NoteView{return this.state;}
 private fail():P4R61NoteView{
  this.state=Object.freeze({...EMPTY,phase:"denied",
   message:"Lead notes unavailable; previous notes removed"});
  return this.state;
 }
 async load(org:string,lead:string):Promise<P4R61NoteView>{
  const seq=++this.epoch;
  this.state=Object.freeze({...EMPTY,orgId:org,leadId:lead});
  try{
   const notes=await this.client.list(org,lead);
   if(seq!==this.epoch)return this.state;
   this.state=Object.freeze({phase:"ready",orgId:org,leadId:lead,
    notes,message:"Persisted fictional follow-up notes loaded"});
  }catch{if(seq===this.epoch)return this.fail();}
  return this.state;
 }
 async add(org:string,lead:string,text:string):Promise<P4R61NoteView>{
  if(this.state.phase!=="ready"||
   this.state.orgId!==org||this.state.leadId!==lead)return this.fail();
  const seq=++this.epoch;
  this.state=Object.freeze({...EMPTY,orgId:org,leadId:lead});
  try{
   await this.client.add(org,lead,text);
   if(seq!==this.epoch)return this.state;
   return this.load(org,lead);
  }catch{if(seq===this.epoch)return this.fail();}
  return this.state;
 }
 reset():void{++this.epoch;this.state=EMPTY;}
}
