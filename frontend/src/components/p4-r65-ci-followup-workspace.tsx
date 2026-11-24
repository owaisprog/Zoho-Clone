"use client";
/** R65 actual CI-only React CRM with paginated notes and follow-up task manager. */
import React,{useEffect,useState,type FormEvent} from "react";
import {P4R62CiCrmWorkspacePanel}
 from "./p4-r62-ci-crm-workspace";
import type {P4R65CiFollowUpWorkspaceController,P4R65View}
 from "../lib/p4-r65-ci-followup-workspace-controller";
import type {P4R60LeadFilter} from "../lib/p4-r60-ci-crm-lead-page-client";
import type {P4R57NewLead} from "../lib/p4-r57-ci-crm-lead-client";
import type {P4R58Status} from "../lib/p4-r58-ci-crm-lead-stage-client";
import type {P4R64NewTask} from "../lib/p4-r64-ci-task-client";
export type P4R65CiFollowUpPanelProps=Readonly<{
 view:P4R65View;
 onOrg:(org:string)=>void;onRefresh:()=>void;
 onCreateLead:(v:P4R57NewLead)=>void;onSelectLead:(id:string)=>void;
 onFilter:(v:P4R60LeadFilter)=>void;onStage:(v:P4R58Status)=>void;
 onSearch:(v:string)=>void;onMoreLeads:()=>void;
 onAddNote:(v:string)=>void;onMoreNotes:()=>void;
 onCreateTask:(v:P4R64NewTask)=>void;onCompleteTask:(id:string)=>void;
}>;
const button="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50";
export function P4R65CiFollowUpWorkspacePanel(p:P4R65CiFollowUpPanelProps){
 const v=p.view,ready=v.phase==="ready"&&v.crm.phase==="ready";
 const selected=v.crm.leads.find(x=>x.leadId===v.crm.selectedLeadId);
 const [title,setTitle]=useState("");
 const [dueDate,setDueDate]=useState("2026-12-05");
 const [confirm,setConfirm]=useState<string|null>(null);
 useEffect(()=>{
  setTitle("");setConfirm(null);
 },[v.crm.orgId,v.crm.selectedLeadId]);
 const submit=(e:FormEvent<HTMLFormElement>)=>{
  e.preventDefault();
  if(!ready||!selected)return;
  p.onCreateTask({title,dueDate});setTitle("");
 };
 const done=(id:string)=>{
  if(confirm===id){setConfirm(null);p.onCompleteTask(id);}
  else setConfirm(id);
 };
 const open=v.tasks.filter(x=>x.status==="OPEN").length;
 return <div data-ci-crm-followups="fictional-only"
  className="min-h-screen bg-slate-50 text-slate-900">
  <P4R62CiCrmWorkspacePanel view={v.crm}
   onOrg={p.onOrg} onRefresh={p.onRefresh}
   onCreate={p.onCreateLead} onSelect={p.onSelectLead}
   onFilter={p.onFilter} onStage={p.onStage}
   onSearch={p.onSearch} onMore={p.onMoreLeads}
   onAddNote={p.onAddNote}
   notePage={{items:v.notes,nextCursor:v.noteNextCursor}}
   onMoreNotes={p.onMoreNotes}/>
  <section aria-label="CRM lead follow-up tasks"
   className="mx-auto max-w-7xl px-4 pb-12 md:px-8">
   <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex flex-wrap justify-between gap-3">
     <div>
      <h2 className="text-lg font-bold">Lead follow-up tasks</h2>
      <p className="mt-1 text-sm text-slate-600">
       {ready&&selected?selected.companyName:
        "Select a verified fictional lead to manage its tasks"}
      </p>
     </div>
     <div className="text-right">
      <p className="text-xs font-semibold uppercase text-slate-600">Open tasks</p>
      <p className="text-2xl font-bold">{ready?open:"—"}</p>
     </div>
    </div>
    <p role={v.phase==="denied"?"alert":"status"}
     aria-live="polite" className="mt-3 text-sm text-slate-600">
     {v.message}</p>
    {ready&&selected&&<>
     <form onSubmit={submit}
      className="mt-5 grid gap-3 rounded-xl border border-slate-200 p-4 md:grid-cols-[minmax(0,2fr)_minmax(150px,1fr)_auto] md:items-end">
      <label className="block text-sm font-semibold">
       Follow-up task
       <input className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2"
        required minLength={13} maxLength={75}
        value={title} onChange={e=>setTitle(e.target.value)}
        placeholder="Demo call client about next steps"/>
      </label>
      <label className="block text-sm font-semibold">
       Due date
       <input type="date" required min="2026-01-01" max="2032-12-31"
        className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2"
        value={dueDate} onChange={e=>setDueDate(e.target.value)}/>
      </label>
      <button type="submit" className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white">
       Add follow-up task</button>
     </form>
     <ul aria-label="Persisted CRM follow-up tasks"
      className="mt-5 divide-y divide-slate-200">
      {v.tasks.map(task=><li key={task.taskId}
       className="flex flex-wrap items-center justify-between gap-3 py-4">
       <div className="space-y-1">
        <p className="text-sm font-semibold">{task.title}</p>
        <p className="text-xs text-slate-600">
         Due {task.dueDate} · {task.status} · Revision {task.revision}
        </p>
        <p className="text-xs text-slate-500">
         Created by {task.createdBy}
        </p>
        {task.completedAt&&<time dateTime={task.completedAt}
         className="text-xs text-slate-500">
         Completed {task.completedAt}</time>}
       </div>
       {task.status==="OPEN"?<button type="button" className={button}
        onClick={()=>done(task.taskId)}>
        {confirm===task.taskId?"Confirm completion":"Mark Done"}
       </button>:<span className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold">
        Completed</span>}
      </li>)}
     </ul>
     {v.tasks.length===0&&<p className="mt-4 text-sm text-slate-500">
      No follow-up tasks for this fictional lead.</p>}
     <p className="mt-4 text-xs text-slate-500">
      Tasks are tied to the selected lead. Completion is permanent and audited.
      Lists over 20 tasks remain blocked pending pagination.
     </p>
    </>}
   </div>
  </section>
 </div>;
}
export function P4R65CiFollowUpWorkspaceBound({
 controller,
}:Readonly<{controller:P4R65CiFollowUpWorkspaceController}>){
 const [view,setView]=useState<P4R65View>(controller.snapshot());
 useEffect(()=>{
  let active=true;
  void controller.discover().then(v=>{if(active)setView(v);});
  return ()=>{active=false;controller.reset();};
 },[controller]);
 const call=(operation:Promise<P4R65View>)=>{
  setView(controller.snapshot());
  void operation.then(setView);
 };
 return <P4R65CiFollowUpWorkspacePanel view={view}
  onOrg={org=>call(controller.selectOrg(org))}
  onRefresh={()=>call(controller.refresh())}
  onCreateLead={lead=>call(controller.createLead(lead))}
  onSelectLead={id=>call(controller.selectLead(id))}
  onFilter={f=>call(controller.search(f,controller.snapshot().crm.search))}
  onStage={status=>call(controller.changeStage(status))}
  onSearch={q=>call(controller.search(controller.snapshot().crm.filter,q))}
  onMoreLeads={()=>call(controller.moreLeads())}
  onAddNote={n=>call(controller.addNote(n))}
  onMoreNotes={()=>call(controller.moreNotes())}
  onCreateTask={task=>call(controller.createTask(task))}
  onCompleteTask={id=>call(controller.completeTask(id))}/>;
}
