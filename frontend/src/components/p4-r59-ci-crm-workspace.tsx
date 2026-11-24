"use client";
/** R59 real React fictional CRM leads, owner-scoped to signed CI APIs only. */
import React,{useEffect,useState,type FormEvent} from "react";
import type {P4R59CiCrmWorkspaceController,P4R59CiCrmView,P4R59LeadFilter}
 from "../lib/p4-r59-ci-crm-workspace-controller";
import type {P4R58Status} from "../lib/p4-r58-ci-crm-lead-stage-client";
import type {P4R57NewLead,P4R57LeadSource}
 from "../lib/p4-r57-ci-crm-lead-client";
export type P4R59CiCrmPanelProps=Readonly<{
 view:P4R59CiCrmView;
 onOrg:(id:string)=>void;onRefresh:()=>void;
 onCreate:(input:P4R57NewLead)=>void;
 onSelect:(id:string)=>void;onFilter:(filter:P4R59LeadFilter)=>void;
 onStage:(status:P4R58Status)=>void;
}>;
const STATUSES=["all","NEW","CONTACTED","QUALIFIED","LOST"] as const;
const SOURCES=["WEBSITE","REFERRAL","EVENT"] as const;
const field="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";
const button="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50";
export function P4R59CiCrmWorkspacePanel(p:P4R59CiCrmPanelProps){
 const v=p.view,ready=v.phase==="ready";
 const [name,setName]=useState("");
 const [email,setEmail]=useState("");
 const [source,setSource]=useState<P4R57LeadSource>("WEBSITE");
 const [confirm,setConfirm]=useState<string|null>(null);
 const visible=v.filter==="all"?v.leads:
  v.leads.filter(x=>x.status===v.filter);
 const lead=v.leads.find(x=>x.leadId===v.selectedLeadId);
 const counts={
  NEW:v.leads.filter(x=>x.status==="NEW").length,
  CONTACTED:v.leads.filter(x=>x.status==="CONTACTED").length,
  QUALIFIED:v.leads.filter(x=>x.status==="QUALIFIED").length,
  LOST:v.leads.filter(x=>x.status==="LOST").length,
 };
 const submit=(e:FormEvent<HTMLFormElement>)=>{
  e.preventDefault();
  if(!ready)return;
  const data={companyName:name,contactEmail:email,source};
  setName("");setEmail("");
  p.onCreate(data);
 };
 const stage=(status:P4R58Status)=>{
  if(confirm===status){setConfirm(null);p.onStage(status);}
  else setConfirm(status);
 };
 return (
  <main data-ci-crm-workspace="fictional-only"
   className="min-h-screen bg-slate-50 p-4 text-slate-900 md:p-8">
   <div className="mx-auto max-w-7xl space-y-6">
    <header className="space-y-2">
     <p className="text-xs font-bold uppercase tracking-widest text-indigo-700">
      CI only · fictional customer records
     </p>
     <h1 className="text-3xl font-bold tracking-tight">CRM Leads</h1>
     <p className="text-sm text-slate-600">
      Create fictional leads, move opportunities forward and review their history
     </p>
    </header>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
     aria-label="Select CRM organization">
     <div className="flex flex-wrap items-end gap-4">
      <label className="min-w-0 flex-1 text-sm font-semibold">
       Owner organization
       <select className={field+" mt-2"} value={v.orgId??""}
        onChange={e=>p.onOrg(e.target.value)} disabled={!ready}>
        <option value="">Select a verified organization</option>
        {v.organizations.map(o=><option key={o.id} value={o.id}>
         {o.name}</option>)}
       </select>
      </label>
      <button type="button" className={button} disabled={!ready}
       onClick={p.onRefresh}>Refresh CRM</button>
     </div>
     <p role={v.phase==="denied"?"alert":"status"} aria-live="polite"
      className="mt-3 text-sm text-slate-600">{v.message}</p>
    </section>
    <section className="grid grid-cols-2 gap-3 md:grid-cols-4"
     aria-label="Fictional CRM lead counts">
     {STATUSES.filter(x=>x!=="all").map(status=>(
      <div key={status} className="rounded-xl border border-slate-200 bg-white p-4">
       <p className="text-xs font-semibold uppercase text-slate-600">{status}</p>
       <p className="mt-1 text-3xl font-bold" data-ci-crm-count={status}>
        {ready?counts[status as keyof typeof counts]:"—"}</p>
      </div>
     ))}
    </section>
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
     <div className="space-y-6">
      <section aria-label="Lead directory"
       className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
       <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-lg font-bold">Lead directory</h2>
        <label className="text-sm font-medium">Lead stage
         <select className={field+" mt-1"} value={v.filter}
          disabled={!ready}
          onChange={e=>p.onFilter(e.target.value as P4R59LeadFilter)}>
          {STATUSES.map(x=><option key={x} value={x}>{x}</option>)}
         </select>
        </label>
       </div>
       <ul className="divide-y divide-slate-200" aria-label="Persisted fictional CRM leads">
        {visible.map(item=>(
         <li key={item.leadId} className="flex flex-wrap items-center justify-between gap-2 py-3">
          <div>
           <p className="text-sm font-semibold">{item.companyName}</p>
           <p className="text-xs text-slate-600">{item.contactEmail} · {item.source}</p>
           <p className="text-xs text-slate-500">Revision {item.revision}</p>
          </div>
          <div className="flex items-center gap-2">
           <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold">
            {item.status}</span>
           <button type="button" className={button} disabled={!ready}
            onClick={()=>{setConfirm(null);p.onSelect(item.leadId);}}>
            View lead</button>
          </div>
         </li>
        ))}
       </ul>
       {ready&&visible.length===0&&<p className="py-4 text-sm text-slate-500">
        No leads in this stage.</p>}
       <p className="mt-3 text-xs text-slate-500">
        Showing up to 20 fictional leads; larger directories remain blocked pending pagination.
       </p>
      </section>
      <section aria-label="Selected lead history"
       className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
       <h2 className="text-lg font-bold">Lead details &amp; history</h2>
       {lead&&ready?(
        <div className="mt-3 space-y-4">
         <div>
          <p className="font-semibold">{lead.companyName}</p>
          <p className="text-sm text-slate-600">
           {lead.contactEmail} · {lead.status} · Revision {lead.revision}
          </p>
         </div>
         <div className="flex flex-wrap gap-2">
          {lead.status==="NEW"&&
           <button className={button} type="button"
            onClick={()=>stage("CONTACTED")}>
            {confirm==="CONTACTED"?"Confirm contact":"Mark Contacted"}
           </button>}
          {lead.status==="CONTACTED"&&<>
           <button className={button} type="button"
            onClick={()=>stage("QUALIFIED")}>
            {confirm==="QUALIFIED"?"Confirm qualification":"Qualify Lead"}
           </button>
           <button className={button} type="button"
            onClick={()=>stage("LOST")}>
            {confirm==="LOST"?"Confirm lost":"Mark Lost"}
           </button>
          </>}
          {(lead.status==="QUALIFIED"||lead.status==="LOST")&&
           <span className="text-sm font-semibold text-slate-600">
            Final stage — no further transitions
           </span>}
         </div>
         <ol className="divide-y divide-slate-200" aria-label="Immutable CRM lead events">
          {v.history.map(e=>(
           <li key={e.eventId} className="py-2 text-sm">
            <p className="font-medium">{e.eventKind==="CREATED"?
             "Lead created":e.beforeStatus+" → "+e.afterStatus}</p>
            <p className="text-xs text-slate-600">
             {e.actorUserId} · Revision {e.revision}
            </p>
            <time dateTime={e.occurredAt} className="text-xs text-slate-500">
             {e.occurredAt}</time>
           </li>
          ))}
         </ol>
        </div>
       ):<p className="mt-3 text-sm text-slate-500">
        Select a lead to review its stage history.</p>}
      </section>
     </div>
     <section aria-label="Create a fictional CRM lead"
      className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-bold">New lead</h2>
      <form onSubmit={submit} className="space-y-4">
       <label className="block text-sm font-medium">Company name
        <input className={field+" mt-1"} required
         value={name} onChange={e=>setName(e.target.value)}
         placeholder="Demo Maple Payments"
         minLength={7} maxLength={53} disabled={!ready}/>
       </label>
       <label className="block text-sm font-medium">Fictional contact email
        <input className={field+" mt-1"} type="email" required
         autoComplete="off" value={email}
         onChange={e=>setEmail(e.target.value)}
         placeholder="contact@example.com" disabled={!ready}/>
       </label>
       <label className="block text-sm font-medium">Source
        <select className={field+" mt-1"} value={source}
         onChange={e=>setSource(e.target.value as P4R57LeadSource)}
         disabled={!ready}>
         {SOURCES.map(x=><option key={x} value={x}>{x}</option>)}
        </select>
       </label>
       <button type="submit" disabled={!ready}
        className="w-full rounded-lg bg-indigo-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">
        Create Lead</button>
       <p className="text-xs text-slate-500">
        Only original fictional demo names and example.com emails are accepted.
       </p>
      </form>
     </section>
    </div>
   </div>
  </main>
 );
}
export function P4R59CiCrmWorkspaceBound({
 controller,
}:Readonly<{controller:P4R59CiCrmWorkspaceController}>){
 const [view,setView]=useState<P4R59CiCrmView>(controller.snapshot());
 useEffect(()=>{
  let alive=true;
  void controller.discover().then(v=>{if(alive)setView(v);});
  return ()=>{alive=false;controller.reset();};
 },[controller]);
 const call=(p:Promise<P4R59CiCrmView>)=>{
  setView(controller.snapshot());
  void p.then(setView);
 };
 return <P4R59CiCrmWorkspacePanel view={view}
  onOrg={org=>call(controller.selectOrg(org))}
  onRefresh={()=>call(controller.refresh())}
  onCreate={data=>call(controller.create(data))}
  onSelect={id=>call(controller.selectLead(id))}
  onFilter={value=>setView(controller.setFilter(value))}
  onStage={next=>call(controller.changeStage(next))}/>;
}
