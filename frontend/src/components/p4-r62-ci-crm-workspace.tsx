"use client";
/**
 * R62 functional React CRM UI: persisted lead pages, signed ownership,
 * activity history and immutable follow-up notes, all disposable CI only.
 * Existing original R59 lead form/status board stays interactive.
 */
import React,{useEffect,useState,type FormEvent} from "react";
import {P4R59CiCrmWorkspacePanel}
 from "./p4-r59-ci-crm-workspace";
import type {P4R62CiCrmWorkspaceController,P4R62CiCrmView}
 from "../lib/p4-r62-ci-crm-workspace-controller";
import type {P4R60LeadFilter} from "../lib/p4-r60-ci-crm-lead-page-client";
import type {P4R57NewLead} from "../lib/p4-r57-ci-crm-lead-client";
import type {P4R58Status} from "../lib/p4-r58-ci-crm-lead-stage-client";
import type {P4R61LeadNote} from "../lib/p4-r61-ci-lead-notes-client";
export type P4R62CiCrmPanelProps=Readonly<{
 view:P4R62CiCrmView;
 onOrg:(org:string)=>void;onRefresh:()=>void;
 onCreate:(lead:P4R57NewLead)=>void;
 onSelect:(id:string)=>void;onFilter:(filter:P4R60LeadFilter)=>void;
 onStage:(stage:P4R58Status)=>void;
 onSearch:(value:string)=>void;onMore:()=>void;onAddNote:(value:string)=>void;
 notePage?:Readonly<{items:readonly P4R61LeadNote[];nextCursor:string|null}>;
 onMoreNotes?:()=>void;
}>;
const button="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";
export function P4R62CiCrmWorkspacePanel(p:P4R62CiCrmPanelProps){
 const v=p.view,ready=v.phase==="ready";
 const [query,setQuery]=useState(v.search);
 const [note,setNote]=useState("");
 useEffect(()=>{setQuery(v.search);setNote("");},[v.orgId]);
 const selected=v.leads.find(x=>x.leadId===v.selectedLeadId);
 const displayedNotes=p.notePage?.items??v.notes;
 const submit=(event:FormEvent<HTMLFormElement>)=>{
  event.preventDefault();
  if(!ready||!selected)return;
  const text=note;setNote("");
  p.onAddNote(text);
 };
 return (
  <div data-ci-crm-complete="fictional-only" className="bg-slate-50 text-slate-900">
   <section aria-label="Search paginated fictional CRM leads"
    className="mx-auto max-w-7xl p-4 md:px-8">
    <div className="rounded-xl border border-slate-200 bg-white p-4">
     <div className="flex flex-wrap items-end gap-3">
      <label className="min-w-0 flex-1 text-sm font-semibold">
       Search persisted leads
       <input className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2"
        aria-label="Search persisted leads" value={query}
        onChange={e=>setQuery(e.target.value)}
        placeholder="Demo Payments" maxLength={40} disabled={!ready}/>
      </label>
      <button type="button" className={button} disabled={!ready}
       onClick={()=>p.onSearch(query)}>Search leads</button>
     </div>
     <p className="mt-2 text-xs text-slate-600">
      Stage counts below summarize loaded rows only, not the entire organization.
      Leads load in signed pages of up to 20 records.
     </p>
    </div>
   </section>
   <P4R59CiCrmWorkspacePanel key={v.orgId??"none"}
    view={v} onOrg={p.onOrg} onRefresh={p.onRefresh}
    onCreate={p.onCreate} onSelect={p.onSelect}
    onFilter={p.onFilter} onStage={p.onStage}/>
   <section aria-label="CRM pagination and immutable follow-up notes"
    className="mx-auto max-w-7xl space-y-5 px-4 pb-12 md:px-8">
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
     <p className="text-sm text-slate-600">
      {ready?v.leads.length:"—"} persisted fictional leads currently loaded
     </p>
     <button type="button" className={button}
      disabled={!ready||!v.nextCursor}
      onClick={p.onMore}>Load more leads</button>
    </div>
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
     <h2 className="text-lg font-bold">Lead follow-up notes</h2>
     {ready&&selected?(
      <>
       <p className="mt-2 text-sm text-slate-600">
        Immutable notes for {selected.companyName}
       </p>
       <form onSubmit={submit} className="mt-4 space-y-3">
        <label htmlFor="ci-crm-note" className="block text-sm font-semibold">
         Add a fictional follow-up note
        </label>
        <textarea id="ci-crm-note" rows={3} required
         minLength={13} maxLength={135} value={note}
         onChange={e=>setNote(e.target.value)}
         placeholder="Demo called and arranged a follow up"
         className="w-full rounded-lg border border-slate-300 p-3 text-sm"/>
        <button type="submit" disabled={!ready}
         className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
         Save follow-up note
        </button>
       </form>
       <ul aria-label="Persisted immutable lead notes"
        className="mt-4 divide-y divide-slate-200">
        {displayedNotes.map(item=>(
         <li key={item.noteId} className="space-y-1 py-3">
          <p className="text-sm font-medium">{item.noteText}</p>
          <p className="text-xs text-slate-600">{item.actorUserId}</p>
          <time dateTime={item.createdAt} className="text-xs text-slate-500">
           {item.createdAt}</time>
         </li>
        ))}
       </ul>
       {displayedNotes.length===0&&<p className="text-sm text-slate-500">
        No follow-up notes recorded for this fictional lead.</p>}
       {p.onMoreNotes&&<button type="button" className={button}
        disabled={!ready||!p.notePage?.nextCursor}
        onClick={p.onMoreNotes}>Load more notes</button>}
       <p className="mt-3 text-xs text-slate-500">
        Notes cannot be edited or deleted. More notes are available in signed pages.
       </p>
      </>
     ):<p className="mt-2 text-sm text-slate-500">
      Select a verified fictional lead to review and add notes.
     </p>}
    </div>
   </section>
  </div>
 );
}
/** Bound component is functional in a disposable signed CI harness only. */
export function P4R62CiCrmWorkspaceBound({
 controller,
}:Readonly<{controller:P4R62CiCrmWorkspaceController}>){
 const [view,setView]=useState<P4R62CiCrmView>(controller.snapshot());
 useEffect(()=>{
  let alive=true;
  void controller.discover().then(v=>{if(alive)setView(v);});
  return ()=>{alive=false;controller.reset();};
 },[controller]);
 const call=(action:Promise<P4R62CiCrmView>)=>{
  setView(controller.snapshot());
  void action.then(setView);
 };
 return <P4R62CiCrmWorkspacePanel view={view}
  onOrg={org=>call(controller.selectOrg(org))}
  onRefresh={()=>call(controller.refresh())}
  onCreate={lead=>call(controller.create(lead))}
  onSelect={id=>call(controller.selectLead(id))}
  onFilter={filter=>call(controller.search(filter,controller.snapshot().search))}
  onStage={next=>call(controller.changeStage(next))}
  onSearch={query=>call(controller.search(controller.snapshot().filter,query))}
  onMore={()=>call(controller.more())}
  onAddNote={text=>call(controller.addNote(text))}/>;
}
