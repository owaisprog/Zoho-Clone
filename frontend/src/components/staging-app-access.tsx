"use client";
import {useRef,useState} from "react";
import type {AppAccessTransport,AppNavigation,LeadPage} from "@/lib/stage-app-access";
/** Synthetic workspace only. Every record request rechecks server permissions. */
export function StagingAppAccess({organizationId,transport}:{organizationId:string;transport:AppAccessTransport}){
 const [nav,setNav]=useState<AppNavigation|null>(null),[page,setPage]=useState<LeadPage|null>(null);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const running=useRef(false);
 async function refresh(){
  if(running.current)return;
  running.current=true;setBusy(true);setNav(null);setPage(null);setMessage("");
  try{const result=await transport.navigation(organizationId);setNav(result);setMessage(result.crmAvailable?"Synthetic CRM access available.":"CRM access denied.");}
  catch{setMessage("Application access unavailable.");}finally{running.current=false;setBusy(false);}
 }
 async function load(after:string|null){
  if(running.current||!nav?.crmAvailable)return;
  running.current=true;setBusy(true);setPage(null);setMessage("");
  try{setPage(await transport.leads(organizationId,after));setMessage("Authorized leads loaded.");}
  catch{setNav(null);setMessage("Application access unavailable.");}finally{running.current=false;setBusy(false);}
 }
 return <section className="rounded-lg border p-4 space-y-3">
  <h2 className="font-semibold">Application access</h2>
  <p>Read-only fictional CRM records. No customer access or writes.</p>
  <button disabled={busy} onClick={()=>void refresh()}>Refresh application access</button>
  {nav?.crmAvailable&&<div>
   <button disabled={busy} onClick={()=>void load(null)}>Load authorized leads</button>
   {page&&<ul>{page.items.map(row=><li key={row.id}>{row.label}</li>)}</ul>}
   {page?.items.length===0&&<p>No authorized leads.</p>}
   {page?.nextCursor&&<button disabled={busy} onClick={()=>void load(page.nextCursor)}>Next leads</button>}
  </div>}
  <p role="status" aria-live="polite">{message}</p>
 </section>;
}
