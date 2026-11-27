"use client";
import {useRef,useState} from "react";
import {LeadClientError,type Lead,type LeadPage,type LeadClient} from "@/lib/p5-leads-client";
import type {Account,AccountClient,Industry} from "@/lib/p5-accounts-client";
import type {Contact,ContactClient} from "@/lib/p5-contacts-client";
import type {ConversionClient,ConversionCommand,Receipt,DealPage} from "@/lib/p5-conversion-client";
export function P5ConversionWorkspace({organizationId,leads,accounts,contacts,client}:{organizationId:string;leads:LeadClient;accounts:AccountClient;contacts:ContactClient;client:ConversionClient}){
 const [page,setPage]=useState<LeadPage|null>(null),[lead,setLead]=useState<Lead|null>(null),[receipt,setReceipt]=useState<Receipt|null>(null);
 const [contactName,setContactName]=useState(""),[dealTitle,setDealTitle]=useState(""),[industry,setIndustry]=useState<Industry>("OTHER");
 const [linked,setLinked]=useState<{account:Account;contact:Contact}|null>(null),[deals,setDeals]=useState<DealPage|null>(null);
 const [pending,setPending]=useState<{id:string;command:ConversionCommand}|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const running=useRef(false),blocked=busy||!!pending;
 async function run(fn:()=>Promise<void>){
  if(running.current)return;running.current=true;setBusy(true);setMessage("");
  try{await fn();}catch(e){setLead(null);setPage(null);setReceipt(null);setLinked(null);setDeals(null);if(e instanceof LeadClientError&&[400,401,403,404,409].includes(e.status)){setPending(null);setMessage(e.status===409?"Conversion conflict. Reload lead.":"Conversion request denied or invalid.");}else setMessage("Conversion unavailable. Retry the same pending request.");}finally{running.current=false;setBusy(false);}
 }
 function load(after:string|null){return run(async()=>{setLead(null);setPage(null);setReceipt(null);setLinked(null);setPage(await leads.list(organizationId,after,{search:"",source:null,status:"QUALIFIED"}));setMessage("Qualified leads loaded.");});}
 function convert(id:string,command:ConversionCommand){return run(async()=>{setPage(null);setLead(null);setReceipt(null);setLinked(null);setDeals(null);setPending({id,command});const result=await client.convert(organizationId,id,command);setPending(null);setReceipt(result);setMessage("Lead converted.");});}
 return <main className="mx-auto max-w-5xl space-y-5 p-6">
 <nav><a href="/">Leads</a> · <a href="/accounts">Accounts</a> · <a href="/contacts">Contacts</a> · <a href="/conversion">Conversion</a> · <a href="/deals">Deals</a> · <a href="/pipelines">Pipelines</a></nav>
 <h1>Sales CRM — Lead conversion</h1><p>Fictional records only. Self-owned qualified leads with stage permission; creates new records, never merges.</p>
 <button disabled={blocked} onClick={()=>void load(null)}>Load qualified leads</button>
 {page&&<section aria-label="Qualified leads">{page.items.map(row=><button key={row.id} disabled={blocked} onClick={()=>void run(async()=>{setLead(null);setReceipt(null);setLinked(null);const result=await leads.detail(organizationId,row.id);if(result.status!=="QUALIFIED")throw new LeadClientError(409);setLead(result);setMessage("Qualified lead selected.");})}>Select {row.companyName}</button>)}{page.items.length===0&&<p>No qualified leads.</p>}{page.nextCursor&&<button disabled={blocked} onClick={()=>void load(page.nextCursor)}>Next qualified leads</button>}</section>}
 {lead&&<form onSubmit={e=>{e.preventDefault();if(!blocked)void convert(lead.id,{requestId:crypto.randomUUID(),accountId:crypto.randomUUID(),contactId:crypto.randomUUID(),dealId:crypto.randomUUID(),expectedRevision:lead.revision,contactName,industry,dealTitle});}}>
 <h2>{lead.companyName}</h2><p>{lead.contactEmail}</p>
 <label htmlFor="conversion-contact">New contact name</label><input id="conversion-contact" required maxLength={80} disabled={blocked} value={contactName} onChange={e=>setContactName(e.target.value)}/>
 <label htmlFor="conversion-industry">New account industry</label><select id="conversion-industry" disabled={blocked} value={industry} onChange={e=>setIndustry(e.target.value as Industry)}>{["OTHER","SERVICES","RETAIL","TECHNOLOGY"].map(x=><option key={x}>{x}</option>)}</select>
 <label htmlFor="conversion-title">New deal title</label><input id="conversion-title" required maxLength={80} disabled={blocked} value={dealTitle} onChange={e=>setDealTitle(e.target.value)}/>
 <button disabled={blocked}>Convert lead</button></form>}
 {pending&&<button disabled={busy} onClick={()=>void convert(pending.id,pending.command)}>Retry same conversion</button>}
 {receipt&&<section aria-label="Conversion receipt"><h2>Conversion completed</h2><p>Account, contact and open deal created together.</p><button disabled={blocked} onClick={()=>void run(async()=>{setLinked(null);const [account,contact]=await Promise.all([accounts.detail(organizationId,receipt.accountId),contacts.detail(organizationId,receipt.contactId)]);if(contact.accountId!==account.id)throw new LeadClientError(409);setLinked({account,contact});setMessage("Linked records loaded.");})}>Load linked records</button>{linked&&<div><p>{linked.account.name}</p><p>{linked.contact.displayName} · {linked.contact.email}</p></div>}</section>}
 <button disabled={blocked} onClick={()=>void run(async()=>{setDeals(null);setDeals(await client.deals(organizationId));setMessage("Deals loaded.");})}>Load deals</button>
 {deals&&<section aria-label="Deals"><table><thead><tr><th>Deal</th><th>Stage</th></tr></thead><tbody>{deals.items.map(row=><tr key={row.id}><td>{row.title}</td><td>{row.stage}</td></tr>)}</tbody></table>{deals.nextCursor&&<button disabled={blocked} onClick={()=>void run(async()=>{setDeals(await client.deals(organizationId,deals.nextCursor));setMessage("Deals loaded.");})}>Next deals</button>}</section>}
 <p role="status" aria-live="polite">{message}</p></main>;
}
