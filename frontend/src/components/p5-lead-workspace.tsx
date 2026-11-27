"use client";
import {useRef,useState} from "react";
import {LeadClientError,type Lead,type LeadClient,type LeadDraft,type LeadPage,type LeadSource} from "@/lib/p5-leads-client";
/** Integrated only in the disposable signed-session harness; no live CRM route. */
export function P5LeadWorkspace({organizationId,client}:{organizationId:string;client:LeadClient}){
 const [page,setPage]=useState<LeadPage|null>(null),[detail,setDetail]=useState<Lead|null>(null);
 const [company,setCompany]=useState(""),[email,setEmail]=useState(""),[source,setSource]=useState<LeadSource>("WEBSITE");
 const [pending,setPending]=useState<LeadDraft|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const running=useRef(false);
 function clear(){setPage(null);setDetail(null);}
 async function run(action:()=>Promise<void>){
  if(running.current)return;running.current=true;setBusy(true);setMessage("");
  try{await action();}catch(e){clear();if(e instanceof LeadClientError&&[400,401,403,404,409].includes(e.status)){setPending(null);setMessage(e.status===409?"Lead conflict. Reload before creating again.":"Request denied or invalid.");}else setMessage("Request unavailable. Retry the same create request if pending.");}
  finally{running.current=false;setBusy(false);}
 }
 function load(after:string|null){return run(async()=>{clear();setPage(await client.list(organizationId,after));setMessage("Leads loaded.");});}
 function create(draft:LeadDraft){return run(async()=>{clear();setPending(draft);const lead=await client.create(organizationId,draft);setPending(null);setCompany("");setEmail("");setDetail(lead);setMessage("Lead saved.");});}
 return <main className="mx-auto max-w-5xl space-y-5 p-6">
  <h1 className="text-2xl font-semibold">Sales CRM — Leads</h1>
  <p>Fictional data only. Use Demo company names and example.com addresses. Live CRM access is disabled.</p>
  <form className="space-y-3 rounded-lg border p-4" onSubmit={e=>{e.preventDefault();if(!pending)void create({id:crypto.randomUUID(),requestId:crypto.randomUUID(),companyName:company,contactEmail:email,source});}}>
   <h2>Create lead</h2>
   <label htmlFor="p5-company">Company name</label><input id="p5-company" className="block w-full rounded border p-2" value={company} disabled={busy||!!pending} onChange={e=>setCompany(e.target.value)} placeholder="Demo Company" required maxLength={54}/>
   <label htmlFor="p5-email">Contact email</label><input id="p5-email" className="block w-full rounded border p-2" type="email" value={email} disabled={busy||!!pending} onChange={e=>setEmail(e.target.value)} placeholder="contact@example.com" required maxLength={53}/>
   <label htmlFor="p5-source">Lead source</label><select id="p5-source" value={source} disabled={busy||!!pending} onChange={e=>setSource(e.target.value as LeadSource)}><option value="WEBSITE">Website</option><option value="REFERRAL">Referral</option><option value="EVENT">Event</option></select>
   <button type="submit" disabled={busy||!!pending}>Save lead</button>
   {pending&&<button type="button" disabled={busy} onClick={()=>void create(pending)}>Retry same create request</button>}
  </form>
  <button type="button" disabled={busy} onClick={()=>void load(null)}>Load leads</button>
  {page&&<table><thead><tr><th>Company</th><th>Source</th><th>Status</th><th>Action</th></tr></thead><tbody>{page.items.map(row=><tr key={row.id}><td>{row.companyName}</td><td>{row.source}</td><td>{row.status}</td><td><button disabled={busy} onClick={()=>void run(async()=>{setDetail(null);setDetail(await client.detail(organizationId,row.id));setMessage("Lead details loaded.");})}>View {row.companyName}</button></td></tr>)}</tbody></table>}
  {page?.items.length===0&&<p>No authorized leads.</p>}
  {page?.nextCursor&&<button disabled={busy} onClick={()=>void load(page.nextCursor)}>Next leads</button>}
  {detail&&<section aria-label="Lead details"><h2>{detail.companyName}</h2><p>{detail.contactEmail}</p><p>{detail.source} · {detail.status} · revision {detail.revision}</p></section>}
  <p role="status" aria-live="polite">{message}</p>
 </main>;
}
