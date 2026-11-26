"use client";
import {useState} from "react";
import type {DirectoryResult,OrganizationItem} from "@/lib/staging-organization-directory";
export function StagingOrganizationDirectory(){
 const [items,setItems]=useState<OrganizationItem[]>([]),[cursor,setCursor]=useState<string|null>(null);
 const [message,setMessage]=useState(""),[busy,setBusy]=useState(false),[selected,setSelected]=useState("");
 async function load(after:string|null){
  setBusy(true);setSelected("");setItems([]);setCursor(null);setMessage("");
  try{
   const r=await fetch("/api/platform/staging-organizations"+(after?"?after="+encodeURIComponent(after):""),{
    headers:{"X-P4-Membership-Check":"1"},cache:"no-store",redirect:"error",signal:AbortSignal.timeout(8000)});
   const data=await r.json() as DirectoryResult;
   if(r.ok&&data.status==="verified"&&data.applicationAccess===false){
    setItems(data.items);setCursor(data.nextCursor);setMessage(data.items.length?"Active memberships found.":"No active memberships.");
   }else setMessage(data.status==="unauthenticated"?"Sign in again.":"Organization directory unavailable.");
  }catch{setMessage("Organization directory unavailable.");}finally{setBusy(false);}
 }
 return <section style={{marginTop:24,padding:20,border:"1px solid currentColor",borderRadius:8}}>
  <h2>Your organizations</h2>
  <p>Only active memberships are listed. Selecting an organization does not grant application access.</p>
  <button disabled={busy} onClick={()=>void load(null)}>{busy?"Loading…":"Load organizations"}</button>
  {items.length>0&&<div>
   <label htmlFor="stage-organization-selection">Select an organization</label>
   <select id="stage-organization-selection" value={selected} disabled={busy} onChange={e=>setSelected(e.target.value)} style={{display:"block",width:"100%",padding:8,margin:"8px 0"}}>
    <option value="">Choose an organization</option>
    {items.map(item=><option key={item.organizationId} value={item.organizationId}>{item.organizationId} — {item.membershipRole==="OWNER"?"Owner":"Member"}</option>)}
   </select>
  </div>}
  {selected&&<p>Selected: {selected}. CRM access remains disabled.</p>}
  {cursor&&<button disabled={busy} onClick={()=>void load(cursor)}>Next page</button>}
  <p role="status" aria-live="polite">{message}</p>
 </section>;
}
