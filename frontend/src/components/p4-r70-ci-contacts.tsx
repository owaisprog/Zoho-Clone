"use client";
import React,{useEffect,useRef,useState,type FormEvent} from "react";
import {P4R70CiContactsClient,SalesContactError,type Contact} from "../lib/p4-r70-ci-contacts-client";
import {P4R69CiAccountsClient,type Account} from "../lib/p4-r69-ci-accounts-client";
export function P4R70ContactsPanel({client,accounts,orgId}:{client:P4R70CiContactsClient;accounts:P4R69CiAccountsClient;orgId:string}){
 const epoch=useRef(0),[scope,setScope]=useState(""),[items,setItems]=useState<readonly Contact[]>([]),
 [options,setOptions]=useState<readonly Account[]>([]),[accountCursor,setAccountCursor]=useState<string|null>(null),
 [cursor,setCursor]=useState<string|null>(null),[name,setName]=useState(""),[email,setEmail]=useState(""),[accountId,setAccountId]=useState(""),
 [selected,setSelected]=useState<Contact|null>(null),[busy,setBusy]=useState(true),[message,setMessage]=useState("Loading contacts");
 function clear(){setItems([]);setOptions([]);setCursor(null);setAccountCursor(null);setScope("");setSelected(null);setName("");setEmail("");setAccountId("");}
 async function load(append=false){
  const seq=++epoch.current;setBusy(true);
  try{const p=await client.page(orgId,append?cursor:null);const a=append?null:await accounts.page(orgId);
   if(seq!==epoch.current)return;
   setItems(old=>append?[...old,...p.items]:p.items);setCursor(p.nextCursor);
   if(a){setOptions(a.items);setAccountCursor(a.nextCursor);}
   setScope(orgId);setMessage("Sales contacts loaded");
  }catch{if(seq===epoch.current){clear();setMessage("Contact access denied or unavailable");}}
  finally{if(seq===epoch.current)setBusy(false);}
 }
 useEffect(()=>{clear();void load();return()=>{++epoch.current;};},[client,accounts,orgId]);
 async function moreAccounts(){
  if(!accountCursor||busy||scope!==orgId)return;
  const seq=++epoch.current;setBusy(true);
  try{const a=await accounts.page(orgId,accountCursor);if(seq!==epoch.current)return;setOptions(old=>[...old,...a.items]);setAccountCursor(a.nextCursor);}
  catch{if(seq===epoch.current){clear();setMessage("Account access denied");}}
  finally{if(seq===epoch.current)setBusy(false);}
 }
 async function save(e:FormEvent){
  e.preventDefault();if(busy||scope!==orgId)return;
  const seq=++epoch.current;setBusy(true);
  try{const input={displayName:name,email,accountId:accountId||null};
   if(selected)await client.update(orgId,selected.id,input,selected.revision);else await client.create(orgId,input);
   if(seq!==epoch.current)return;setSelected(null);setName("");setEmail("");setAccountId("");await load();
  }catch(err){if(seq===epoch.current){clear();setMessage(err instanceof SalesContactError&&err.status===409?"Possible duplicate contact, stale revision or unavailable account. Reload before retrying.":"Contact request denied or unavailable");setBusy(false);}}
 }
 const ready=scope===orgId&&!busy;
 return <section aria-label="CRM Contacts" className="mx-auto max-w-5xl p-6">
  <h2 className="text-xl font-semibold">CRM Contacts</h2><p role="status">{message}</p>
  <button type="button" disabled={busy} onClick={()=>void load()}>Reload contacts</button>
  {ready&&<><form onSubmit={save} className="grid gap-3 py-4">
   <label>Contact name<input required value={name} maxLength={154} onChange={e=>setName(e.target.value)} placeholder="Demo Contact" /></label>
   <label>Fictional email<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} /></label>
   <label>Linked account<select value={accountId} onChange={e=>setAccountId(e.target.value)}><option value="">No account</option>
    {accountId&&!options.some(a=>a.id===accountId)&&<option value={accountId}>Current linked account</option>}
    {options.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
   {accountCursor&&<button type="button" onClick={()=>void moreAccounts()}>Load more account options</button>}
   <button type="submit">{selected?"Save contact":"Create contact"}</button>
   <button type="button" onClick={()=>{setSelected(null);setName("");setEmail("");setAccountId("");}}>Clear form</button>
  </form><ul>{items.map(a=><li key={a.id} className="border-b py-3"><span>{a.displayName} · {a.email} · {options.find(x=>x.id===a.accountId)?.name??(a.accountId?"Linked account":"No account")} · Revision {a.revision}</span> <button type="button" onClick={()=>{setSelected(a);setName(a.displayName);setEmail(a.email);setAccountId(a.accountId??"");}}>Edit contact</button></li>)}</ul>
  {cursor&&<button type="button" onClick={()=>void load(true)}>Load more contacts</button>}</>}
 </section>;
}
