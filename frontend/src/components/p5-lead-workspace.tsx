"use client";
import {useRef,useState} from "react";
import {LeadClientError,type Lead,type LeadClient,type LeadDraft,type LeadPage,type LeadSource,type LeadFilter,type LeadChange,type HistoryPage,type LeadAssignment,type AssignmentOptions,type DuplicateQuery} from "@/lib/p5-leads-client";
/** Integrated only in the disposable signed-session harness; no live CRM route. */
export function P5LeadWorkspace({organizationId,client}:{organizationId:string;client:LeadClient}){
 const [page,setPage]=useState<LeadPage|null>(null),[detail,setDetail]=useState<Lead|null>(null);
 const [company,setCompany]=useState(""),[email,setEmail]=useState(""),[source,setSource]=useState<LeadSource>("WEBSITE");
 const [pending,setPending]=useState<LeadDraft|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const [search,setSearch]=useState(""),[sourceFilter,setSourceFilter]=useState<LeadSource|null>(null),[statusFilter,setStatusFilter]=useState<Lead["status"]|null>(null);
 const [appliedFilter,setAppliedFilter]=useState<LeadFilter>({search:"",source:null,status:null});
 const [editCompany,setEditCompany]=useState(""),[editEmail,setEditEmail]=useState(""),[editSource,setEditSource]=useState<LeadSource>("WEBSITE");
 const [history,setHistory]=useState<HistoryPage|null>(null),[pendingChange,setPendingChange]=useState<{id:string;command:LeadChange}|null>(null);
 const [options,setOptions]=useState<AssignmentOptions|null>(null),[assignee,setAssignee]=useState("");
 const [pendingAssignment,setPendingAssignment]=useState<{id:string;command:LeadAssignment}|null>(null);
 const [duplicates,setDuplicates]=useState<LeadPage|null>(null),[duplicateQuery,setDuplicateQuery]=useState<DuplicateQuery|null>(null);
 const running=useRef(false);
 function showLead(lead:Lead){setDetail(lead);setEditCompany(lead.companyName);setEditEmail(lead.contactEmail);setEditSource(lead.source);setHistory(null);setOptions(null);setAssignee("");}
 function clear(){setPage(null);setDetail(null);setHistory(null);setOptions(null);setAssignee("");setDuplicates(null);setDuplicateQuery(null);}
 async function run(action:()=>Promise<void>){
  if(running.current)return;running.current=true;setBusy(true);setMessage("");
  try{await action();}catch(e){clear();if(e instanceof LeadClientError&&[400,401,403,404,409].includes(e.status)){setPending(null);setPendingChange(null);setPendingAssignment(null);setMessage(e.status===409?"Lead conflict. Reload before creating again.":"Request denied or invalid.");}else setMessage("Request unavailable. Retry the same pending request.");}
  finally{running.current=false;setBusy(false);}
 }
 function load(after:string|null,filter:LeadFilter=after===null?{search,source:sourceFilter,status:statusFilter}:appliedFilter){return run(async()=>{clear();setAppliedFilter(filter);setPage(await client.list(organizationId,after,filter));setMessage("Leads loaded.");});}
 function change(id:string,command:LeadChange){return run(async()=>{clear();setPendingChange({id,command});const lead=await client.change(organizationId,id,command);setPendingChange(null);showLead(lead);setMessage("Lead updated.");});}
 function loadOptions(id:string,after:string|null=null){return run(async()=>{setOptions(null);setAssignee("");setOptions(await client.assignmentOptions(organizationId,id,after));setMessage("Eligible team members loaded.");});}
 function assign(id:string,command:LeadAssignment){return run(async()=>{clear();setPendingAssignment({id,command});const lead=await client.assign(organizationId,id,command);setPendingAssignment(null);showLead(lead);setMessage("Lead assigned.");});}
 function review(query:DuplicateQuery){return run(async()=>{setDuplicates(null);setDuplicateQuery(query);setDuplicates(await client.duplicates(organizationId,query));setMessage("Duplicate review loaded.");});}
 function loadHistory(id:string,after=-1){return run(async()=>{setHistory(null);setHistory(await client.history(organizationId,id,after));setMessage("Lead history loaded.");});}
 function create(draft:LeadDraft){return run(async()=>{clear();setPending(draft);const lead=await client.create(organizationId,draft);setPending(null);setCompany("");setEmail("");showLead(lead);setMessage("Lead saved.");});}
 return <main className="mx-auto max-w-5xl space-y-5 p-6">
  <nav><a href="/">Leads</a> · <a href="/accounts">Accounts</a> · <a href="/contacts">Contacts</a> · <a href="/conversion">Conversion and deals</a></nav>
  <h1 className="text-2xl font-semibold">Sales CRM — Leads</h1>
  <p>Fictional data only. Use Demo company names and example.com addresses. Live CRM access is disabled.</p>
  <form className="space-y-3 rounded-lg border p-4" onSubmit={e=>{e.preventDefault();if(!pending&&!pendingChange&&!pendingAssignment)void create({id:crypto.randomUUID(),requestId:crypto.randomUUID(),companyName:company,contactEmail:email,source});}}>
   <h2>Create lead</h2>
   <label htmlFor="p5-company">Company name</label><input id="p5-company" className="block w-full rounded border p-2" value={company} disabled={busy||!!pending||!!pendingChange||!!pendingAssignment} onChange={e=>{setCompany(e.target.value);setDuplicates(null);setDuplicateQuery(null);}} placeholder="Demo Company" required maxLength={54}/>
   <label htmlFor="p5-email">Contact email</label><input id="p5-email" className="block w-full rounded border p-2" type="email" value={email} disabled={busy||!!pending||!!pendingChange||!!pendingAssignment} onChange={e=>{setEmail(e.target.value);setDuplicates(null);setDuplicateQuery(null);}} placeholder="contact@example.com" required maxLength={53}/>
   <label htmlFor="p5-source">Lead source</label><select id="p5-source" value={source} disabled={busy||!!pending||!!pendingChange||!!pendingAssignment} onChange={e=>setSource(e.target.value as LeadSource)}><option value="WEBSITE">Website</option><option value="REFERRAL">Referral</option><option value="EVENT">Event</option></select>
   <button type="button" disabled={busy||!!pending||!!pendingChange||!!pendingAssignment||!company||!email} onClick={()=>void review({companyName:company,contactEmail:email,after:null})}>Review possible duplicates</button>
   <button type="submit" disabled={busy||!!pending||!!pendingChange||!!pendingAssignment}>Save lead</button>
   {pending&&<button type="button" disabled={busy} onClick={()=>void create(pending)}>Retry same create request</button>}
  </form>
  {duplicates&&duplicateQuery&&<section aria-label="Duplicate candidates">
   <h2>Possible duplicates in your authorized records</h2>
   {duplicates.items.length===0?<p>No visible matches. Other records may exist.</p>:<ul>{duplicates.items.map(row=><li key={row.id}>{row.companyName} · {row.contactEmail}</li>)}</ul>}
   {duplicates.nextCursor&&<button disabled={busy||!!pending||!!pendingChange||!!pendingAssignment} onClick={()=>void review({...duplicateQuery,after:duplicates.nextCursor})}>Next matches</button>}
   <p>Review only. No automatic merge.</p>
  </section>}
  <section aria-label="Lead filters" className="space-y-2">
   <label htmlFor="p5-search">Search leads</label><input id="p5-search" value={search} maxLength={50} onChange={e=>setSearch(e.target.value)} disabled={busy||!!pending||!!pendingChange||!!pendingAssignment}/>
   <label htmlFor="p5-filter-source">Filter by source</label><select id="p5-filter-source" value={sourceFilter??""} onChange={e=>setSourceFilter(e.target.value as LeadSource||null)} disabled={busy||!!pending||!!pendingChange||!!pendingAssignment}><option value="">All sources</option><option>WEBSITE</option><option>REFERRAL</option><option>EVENT</option></select>
   <label htmlFor="p5-filter-status">Filter by status</label><select id="p5-filter-status" value={statusFilter??""} onChange={e=>setStatusFilter(e.target.value as Lead["status"]||null)} disabled={busy||!!pending||!!pendingChange||!!pendingAssignment}><option value="">All statuses</option><option>NEW</option><option>CONTACTED</option><option>QUALIFIED</option><option>LOST</option><option>CONVERTED</option></select>
   <button type="button" disabled={busy||!!pending||!!pendingChange||!!pendingAssignment} onClick={()=>void load(null)}>Load leads</button>
  </section>
  {pendingAssignment&&<button type="button" disabled={busy} onClick={()=>void assign(pendingAssignment.id,pendingAssignment.command)}>Retry same assignment request</button>}
  {pendingChange&&<button type="button" disabled={busy} onClick={()=>void change(pendingChange.id,pendingChange.command)}>Retry same update request</button>}
  {page&&<table><thead><tr><th>Company</th><th>Source</th><th>Status</th><th>Action</th></tr></thead><tbody>{page.items.map(row=><tr key={row.id}><td>{row.companyName}</td><td>{row.source}</td><td>{row.status}</td><td><button disabled={busy||!!pending||!!pendingChange||!!pendingAssignment} onClick={()=>void run(async()=>{setDetail(null);setHistory(null);showLead(await client.detail(organizationId,row.id));setMessage("Lead details loaded.");})}>View {row.companyName}</button></td></tr>)}</tbody></table>}
  {page?.items.length===0&&<p>No authorized leads.</p>}
  {page?.nextCursor&&<button disabled={busy||!!pending||!!pendingChange||!!pendingAssignment} onClick={()=>void load(page.nextCursor)}>Next leads</button>}
  {detail&&<section aria-label="Lead details" className="rounded-lg border p-4 space-y-3"><h2>{detail.companyName}</h2><p>{detail.contactEmail}</p><p>{detail.source} · {detail.status} · revision {detail.revision}</p>
   <form onSubmit={e=>{e.preventDefault();if(!pending&&!pendingChange&&!pendingAssignment)void change(detail.id,{operation:"edit",requestId:crypto.randomUUID(),expectedRevision:detail.revision,companyName:editCompany,contactEmail:editEmail,source:editSource});}}>
    <label htmlFor="p5-edit-company">Edit company</label><input id="p5-edit-company" value={editCompany} required maxLength={54} disabled={busy||!!pending||!!pendingChange||!!pendingAssignment} onChange={e=>setEditCompany(e.target.value)}/>
    <label htmlFor="p5-edit-email">Edit email</label><input id="p5-edit-email" type="email" value={editEmail} required maxLength={53} disabled={busy||!!pending||!!pendingChange||!!pendingAssignment} onChange={e=>setEditEmail(e.target.value)}/>
    <label htmlFor="p5-edit-source">Edit source</label><select id="p5-edit-source" value={editSource} disabled={busy||!!pending||!!pendingChange||!!pendingAssignment} onChange={e=>setEditSource(e.target.value as LeadSource)}><option>WEBSITE</option><option>REFERRAL</option><option>EVENT</option></select>
    <button disabled={busy||!!pending||!!pendingChange||!!pendingAssignment||(detail.revision>=1000000||detail.status==="CONVERTED")} type="submit">Save changes</button>
   </form>
   <p>Stage transitions require a separate server-verified grant.</p>
   {(detail.status==="NEW"?["CONTACTED"] as const:detail.status==="CONTACTED"?["QUALIFIED","LOST"] as const:[]).map(next=><button key={next} disabled={busy||!!pending||!!pendingChange||!!pendingAssignment||detail.revision>=1000000} onClick={()=>void change(detail.id,{operation:"transition",requestId:crypto.randomUUID(),expectedRevision:detail.revision,nextStatus:next})}>Move to {next}</button>)}
   <button disabled={busy||!!pending||!!pendingChange||!!pendingAssignment} onClick={()=>void loadOptions(detail.id)}>Load eligible assignees</button>
   {options&&<section aria-label="Lead assignment">
    <p>Current owner: {options.currentOwnerId}</p>
    <label htmlFor="p5-assignee">New owner</label><select id="p5-assignee" value={assignee} disabled={busy||!!pendingAssignment} onChange={e=>setAssignee(e.target.value)}>
     <option value="">Choose eligible member</option>{options.items.filter(id=>id!==options.currentOwnerId).map(id=><option key={id} value={id}>{id}</option>)}
    </select>
    <button disabled={busy||!!pendingAssignment||!assignee||options.revision!==detail.revision||options.revision>=1000000} onClick={()=>void assign(detail.id,{ownerId:assignee,expectedRevision:options.revision,requestId:crypto.randomUUID()})}>Assign lead</button>
    {options.nextCursor&&<button disabled={busy||!!pendingAssignment} onClick={()=>void loadOptions(detail.id,options.nextCursor)}>Next eligible members</button>}
   </section>}
   <button disabled={busy||!!pending||!!pendingChange||!!pendingAssignment} onClick={()=>void loadHistory(detail.id)}>Load history</button>
   {history&&<ul>{history.items.map(event=><li key={event.revision}>{event.action} · revision {event.revision}{event.previousStatus&&" · "+event.previousStatus+" to "+event.nextStatus}</li>)}</ul>}
   {history?.nextCursor!==null&&history?.nextCursor!==undefined&&<button disabled={busy} onClick={()=>void loadHistory(detail.id,history.nextCursor!)}>Next history</button>}
  </section>}
  <p role="status" aria-live="polite">{message}</p>
 </main>;
}
