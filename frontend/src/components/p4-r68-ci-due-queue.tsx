"use client";
/** R68 real React owner follow-up work queue across leads; synthetic only. */
import React,{useEffect,useState,type FormEvent} from "react";
import type {P4R68CiDueQueueController,P4R68DueQueueView}
 from "../lib/p4-r68-ci-due-queue-controller";
export type P4R68DueQueuePanelProps=Readonly<{
 view:P4R68DueQueueView;
 onThrough:(date:string)=>void;
 onMore:()=>void;onComplete:(id:string)=>void;
 onOpenLead?:(leadId:string)=>void;
}>;
const button="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-50";
export function P4R68CiDueQueuePanel(p:P4R68DueQueuePanelProps){
 const v=p.view,ready=v.phase==="ready";
 const [through,setThrough]=useState(v.through);
 const [confirm,setConfirm]=useState<string|null>(null);
 useEffect(()=>{setThrough(v.through);setConfirm(null);},[v.orgId,v.through]);
 const submit=(e:FormEvent<HTMLFormElement>)=>{
  e.preventDefault();
  if(ready)p.onThrough(through);
 };
 const complete=(id:string)=>{
  if(confirm===id){setConfirm(null);p.onComplete(id);}
  else setConfirm(id);
 };
 return <section aria-label="Organization follow-up work queue"
  data-ci-due-work-queue="fictional-only"
  className="mx-auto max-w-7xl p-6 text-slate-900">
  <header className="flex flex-wrap items-end justify-between gap-4">
   <div>
    <h2 className="text-xl font-bold">Follow-up work queue</h2>
    <p className="mt-1 text-sm text-slate-600">
     Open tasks from verified CRM leads, sorted by earliest due date.
    </p>
   </div>
   <form onSubmit={submit} className="flex items-end gap-2">
    <label className="text-sm font-semibold">Due through
     <input type="date" min="2026-01-01" max="2032-12-31"
      required disabled={!ready} value={through}
      onChange={e=>setThrough(e.target.value)}
      className="mt-2 block rounded-lg border border-slate-300 px-3 py-2"/>
    </label>
    <button type="submit" disabled={!ready} className={button}>Apply</button>
   </form>
  </header>
  <p role={v.phase==="denied"?"alert":"status"} aria-live="polite"
   className="my-4 text-sm text-slate-600">{v.message}</p>
  {ready&&<>
   <p className="text-sm font-semibold">Open tasks shown: {v.items.length}</p>
   <ul aria-label="Open follow-up tasks by due date"
    className="mt-3 divide-y divide-slate-200 rounded-xl border border-slate-200">
    {v.items.map(({task,companyName})=><li key={task.taskId}
     className="flex flex-wrap items-center justify-between gap-3 p-4">
     <div>
      <p className="text-sm font-bold">{companyName}</p>
      <p className="mt-1 text-sm">{task.title}</p>
      <p className="mt-1 text-xs text-slate-500">
       Due {task.dueDate} · Open · Created {task.createdAt.slice(0,10)}
      </p>
     </div>
     <div className="flex gap-2">
      {p.onOpenLead&&<button type="button" className={button}
       onClick={()=>p.onOpenLead?.(task.leadId)}>Open lead</button>}
      <button type="button" className={button}
       onClick={()=>complete(task.taskId)}>
       {confirm===task.taskId?"Confirm completion":"Mark Done"}
      </button>
     </div>
    </li>)}
   </ul>
   {v.items.length===0&&<p className="mt-4 text-sm">
    No open follow-up tasks due by this date.</p>}
   {v.nextCursor&&<button type="button" className={button+" mt-4"}
    onClick={p.onMore}>Load more due tasks</button>}
   <p className="mt-4 text-xs text-slate-500">
    Only loaded tasks are counted. Completion removes the task from this
    open queue after a verified database read.</p>
  </>}
 </section>;
}
export function P4R68CiDueQueueBound({
 controller,orgId,onOpenLead,
}:Readonly<{
 controller:P4R68CiDueQueueController;orgId:string;
 onOpenLead?:(leadId:string)=>void;
}>){
 const [view,setView]=useState<P4R68DueQueueView>(controller.snapshot());
 useEffect(()=>{
  let active=true;
  void controller.load(orgId).then(v=>{if(active)setView(v);});
  return ()=>{active=false;controller.reset();};
 },[controller,orgId]);
 const call=(action:Promise<P4R68DueQueueView>)=>{
  setView(controller.snapshot());
  void action.then(setView);
 };
 return <P4R68CiDueQueuePanel view={view}
  onThrough={due=>call(controller.load(orgId,due))}
  onMore={()=>call(controller.more())}
  onComplete={id=>call(controller.complete(id))}
  onOpenLead={onOpenLead}/>;
}
