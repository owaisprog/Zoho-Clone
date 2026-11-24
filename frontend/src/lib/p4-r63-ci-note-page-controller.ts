/** R63 paginated note directory; clears prior tenant or lead data on denial. */
import type {P4R61LeadNote} from "./p4-r61-ci-lead-notes-client";
import type {P4R63CiNotePageClient}
 from "./p4-r63-ci-note-page-client";
export type P4R63NotesView=Readonly<{
 phase:"idle"|"ready"|"denied";orgId:string|null;leadId:string|null;
 notes:readonly P4R61LeadNote[];nextCursor:string|null;message:string;
}>;
const EMPTY:P4R63NotesView=Object.freeze({
 phase:"idle",orgId:null,leadId:null,notes:Object.freeze([]),
 nextCursor:null,message:"Fictional notes directory inactive",
});
export class P4R63CiNotePageController{
 private epoch=0;private view:P4R63NotesView=EMPTY;
 constructor(private readonly api:Pick<P4R63CiNotePageClient,"page">){}
 snapshot():P4R63NotesView{return this.view;}
 private deny():P4R63NotesView{
  this.view=Object.freeze({...EMPTY,phase:"denied",
   message:"Lead notes unavailable; previous notes cleared"});
  return this.view;
 }
 async refresh(org:string,lead:string):Promise<P4R63NotesView>{
  const seq=++this.epoch;
  this.view=EMPTY;
  try{
   const page=await this.api.page(org,lead,null);
   if(seq!==this.epoch)return this.view;
   this.view=Object.freeze({phase:"ready",orgId:org,leadId:lead,
    notes:page.items,nextCursor:page.nextCursor,
    message:"Signed fictional notes page loaded"});
  }catch{if(seq===this.epoch)return this.deny();}
  return this.view;
 }
 async more():Promise<P4R63NotesView>{
  const v=this.view;
  if(v.phase!=="ready"||!v.orgId||!v.leadId||!v.nextCursor)
   return this.deny();
  const seq=++this.epoch;this.view=Object.freeze({...EMPTY});
  try{
   const page=await this.api.page(v.orgId,v.leadId,v.nextCursor);
   if(seq!==this.epoch)return this.view;
   const notes=[...v.notes,...page.items];
   if(notes.some((n,i)=>n.leadId!==v.leadId||
    (i>0&&n.createdAt>notes[i-1]!.createdAt))||
    new Set(notes.map(n=>n.noteId)).size!==notes.length)
    return this.deny();
   this.view=Object.freeze({...v,notes:Object.freeze(notes),
    nextCursor:page.nextCursor,message:"Additional immutable notes loaded"});
  }catch{if(seq===this.epoch)return this.deny();}
  return this.view;
 }
 reset():void{++this.epoch;this.view=EMPTY;}
}
