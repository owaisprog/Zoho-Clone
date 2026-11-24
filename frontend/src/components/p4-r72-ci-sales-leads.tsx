"use client";
import React,{useEffect,useRef,useState,type FormEvent} from "react";
import {P4R72CiSalesLeadsClient,SalesLeadError,type SalesLead,type LeadStatus} from "../lib/p4-r72-ci-sales-leads-client";
const NEXT:Record<LeadStatus,readonly LeadStatus[]>={NEW:["CONTACTED","LOST"],CONTACTED:["QUALIFIED","LOST"],QUALIFIED:["LOST"],LOST:[],CONVERTED:[]};
export function P4R72SalesLeadsPanel({client,orgId,onConverted}:{client:P4R72CiSalesLeadsClient;orgId:string;onConverted?:(lead:SalesLead)=>void}){
 const epoch=useRef(0),[scope,setScope]=useState(""),[items,setItems]=useState<readonly SalesLead[]>([]),
 [cursor,setCursor]=useState<string|null>(null),[companyName,setCompany]=useState(""),[contactName,setContact]=useState(""),[email,setEmail]=useState(""),
 [busy,setBusy]=useState(true),[message,setMessage]=useState("Loading sales leads"),[selected,setSelected]=useState<SalesLead|null>(null),[title,setTitle]=useState("");
 function clear(){setScope("");setItems([]);setCursor(null);setSelected(null);setTitle("");setCompany("");setContact("");setEmail("");}
 async function load(append=false){
  const seq=++epoch.current;setBusy(true);
  try{const p=await client.page(orgId,append?cursor:null);if(seq!==epoch.current)return;
   setItems(old=>append?[...old,...p.items]:p.items);setCursor(p.nextCursor);setScope(orgId);setMessage("Sales leads loaded");
  }catch{if(seq===epoch.current){clear();setMessage("Lead access denied or unavailable");}}
  finally{if(seq===epoch.current)setBusy(false);}
 }
 useEffect(()=>{clear();void load();return()=>{++epoch.current;};},[client,orgId]);
 async function mutate(action:()=>Promise<SalesLead>,conversion=false){
  if(busy||scope!==orgId)return;const seq=++epoch.current;setBusy(true);
  try{const saved=await action();if(seq!==epoch.current)return;setSelected(null);setTitle("");setCompany("");setContact("");setEmail("");
   await load();if(conversion&&saved.status==="CONVERTED"&&epoch.current===seq+1)onConverted?.(saved);
  }catch(err){if(seq===epoch.current){clear();setMessage(err instanceof SalesLeadError&&err.status===409?"Lead conflict, duplicate account/contact or pipeline unavailable. Reload before retrying.":"Lead request denied or unavailable");setBusy(false);}}
 }
 const submit=(e:FormEvent)=>{e.preventDefault();void mutate(()=>client.create(orgId,{companyName,contactName,email}));};
 const ready=scope===orgId&&!busy;
 return <section aria-label="Sales CRM Leads" className="mx-auto max-w-5xl p-6">
  <h2 className="text-xl font-semibold">Sales CRM Leads</h2><p role="status">{message}</p>
  <button type="button" disabled={busy} onClick={()=>void load()}>Reload leads</button>
  {ready&&<><form onSubmit={submit} className="grid gap-3 py-4">
   <label>Company<input required maxLength={54} value={companyName} onChange={e=>setCompany(e.target.value)} placeholder="Demo Business"/></label>
   <label>Contact name<input required maxLength={54} value={contactName} onChange={e=>setContact(e.target.value)} placeholder="Demo Contact"/></label>
   <label>Fictional email<input required type="email" value={email} onChange={e=>setEmail(e.target.value)}/></label>
   <button type="submit">Create lead</button></form>
   <ul>{items.map(l=><li key={l.id} className="border-b py-3">{l.companyName} · {l.contactName} · {l.status}
   {NEXT[l.status].map(n=><button type="button" key={n} onClick={()=>void mutate(()=>client.changeStage(orgId,l.id,n,l.revision))}>Move to {n}</button>)}
   {l.status==="QUALIFIED"&&<button type="button" onClick={()=>{setSelected(l);setTitle(l.companyName+" Opportunity");}}>Convert lead</button>}
   {l.status==="CONVERTED"&&<span>Account, Contact and Deal created</span>}</li>)}</ul>
   {selected&&<form onSubmit={e=>{e.preventDefault();void mutate(()=>client.convert(orgId,selected.id,title,selected.revision),true);}}><label>Deal title<input required value={title} onChange={e=>setTitle(e.target.value)} maxLength={154}/></label><button type="submit">Confirm conversion</button><button type="button" onClick={()=>setSelected(null)}>Cancel</button></form>}
   {cursor&&<button type="button" onClick={()=>void load(true)}>Load more leads</button>}</>}
 </section>;
}
