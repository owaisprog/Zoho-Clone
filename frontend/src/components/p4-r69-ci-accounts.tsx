"use client";
import React,{useEffect,useRef,useState,type FormEvent} from "react";
import {P4R69CiAccountsClient,SalesAccountError,type Account} from "../lib/p4-r69-ci-accounts-client";
export function P4R69AccountsPanel({client,orgId}:{client:P4R69CiAccountsClient;orgId:string}){
 const epoch=useRef(0),[scope,setScope]=useState(""),[items,setItems]=useState<readonly Account[]>([]),
 [cursor,setCursor]=useState<string|null>(null),[name,setName]=useState(""),[website,setWebsite]=useState(""),
 [selected,setSelected]=useState<Account|null>(null),[busy,setBusy]=useState(true),[message,setMessage]=useState("Loading accounts");
 async function load(append=false){
  const seq=++epoch.current;setBusy(true);
  try{const p=await client.page(orgId,append?cursor:null);if(seq!==epoch.current)return;
   setItems(old=>append?[...old,...p.items]:p.items);setCursor(p.nextCursor);setScope(orgId);setMessage("Sales accounts loaded");
  }catch{if(seq===epoch.current){setItems([]);setCursor(null);setScope("");setMessage("Account access denied or unavailable");}}
  finally{if(seq===epoch.current)setBusy(false);}
 }
 useEffect(()=>{setScope("");setItems([]);setCursor(null);setSelected(null);setName("");setWebsite("");void load();return()=>{++epoch.current;};},[client,orgId]);
 async function save(e:FormEvent){
  e.preventDefault();if(busy||scope!==orgId)return;
  const seq=++epoch.current;setBusy(true);
  try{const input={name,websiteLabel:website||null};
   if(selected)await client.update(orgId,selected.id,input,selected.revision);else await client.create(orgId,input);
   if(seq!==epoch.current)return;setSelected(null);setName("");setWebsite("");await load();
  }catch(err){if(seq===epoch.current){setItems([]);setCursor(null);setScope("");setSelected(null);setName("");setWebsite("");
   setMessage(err instanceof SalesAccountError&&err.status===409?"Possible duplicate account or stale revision. Reload before retrying.":"Account request denied or unavailable");setBusy(false);}}
 }
 const ready=scope===orgId&&!busy;
 return <section aria-label="CRM Accounts" className="mx-auto max-w-5xl p-6">
  <h2 className="text-xl font-semibold">CRM Accounts</h2><p role="status">{message}</p>
  <button type="button" disabled={busy} onClick={()=>void load()}>Reload accounts</button>
  {ready&&<><form onSubmit={save} className="grid gap-3 py-4">
   <label>Account name<input required value={name} maxLength={154} onChange={e=>setName(e.target.value)} placeholder="Demo Business" /></label>
   <label>Example website<input value={website} onChange={e=>setWebsite(e.target.value)} placeholder="https://demo.example.com" /></label>
   <button type="submit">{selected?"Save account":"Create account"}</button>
   <button type="button" onClick={()=>{setSelected(null);setName("");setWebsite("");}}>Clear form</button>
  </form><ul>{items.map(a=><li key={a.id} className="border-b py-3"><span>{a.name} · {a.websiteLabel??"No website"} · Revision {a.revision}</span> <button type="button" onClick={()=>{setSelected(a);setName(a.name);setWebsite(a.websiteLabel??"");}}>Edit account</button></li>)}</ul>
  {cursor&&<button type="button" onClick={()=>void load(true)}>Load more accounts</button>}</>}
 </section>;
}
