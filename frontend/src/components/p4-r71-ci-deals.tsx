"use client";
import React,{useEffect,useRef,useState,type FormEvent} from "react";
import {P4R71CiDealsClient,SalesDealError,type Deal,type DealStage} from "../lib/p4-r71-ci-deals-client";
import {P4R69CiAccountsClient,type Account} from "../lib/p4-r69-ci-accounts-client";
import {P4R70CiContactsClient,type Contact} from "../lib/p4-r70-ci-contacts-client";
const NEXT:Record<DealStage,readonly DealStage[]>={OPEN:["DISCOVERY","LOST"],DISCOVERY:["PROPOSAL","LOST"],PROPOSAL:["NEGOTIATION","LOST"],NEGOTIATION:["WON","LOST"],WON:[],LOST:[]};
export function P4R71DealsPanel({client,accounts,contacts,orgId}:{client:P4R71CiDealsClient;accounts:P4R69CiAccountsClient;contacts:P4R70CiContactsClient;orgId:string}){
 const epoch=useRef(0),[scope,setScope]=useState(""),[items,setItems]=useState<readonly Deal[]>([]),
 [accountOptions,setAccounts]=useState<readonly Account[]>([]),[contactOptions,setContacts]=useState<readonly Contact[]>([]),
 [cursor,setCursor]=useState<string|null>(null),[ac,setAc]=useState<string|null>(null),[cc,setCc]=useState<string|null>(null),
 [title,setTitle]=useState(""),[accountId,setAccountId]=useState(""),[contactId,setContactId]=useState(""),
 [busy,setBusy]=useState(true),[message,setMessage]=useState("Loading deals");
 function clear(){setScope("");setItems([]);setAccounts([]);setContacts([]);setCursor(null);setAc(null);setCc(null);setTitle("");setAccountId("");setContactId("");}
 async function load(append=false){
  const seq=++epoch.current;setBusy(true);
  try{const p=await client.page(orgId,append?cursor:null);const opts=append?null:await Promise.all([accounts.page(orgId),contacts.page(orgId)]);
   if(seq!==epoch.current)return;setItems(old=>append?[...old,...p.items]:p.items);setCursor(p.nextCursor);
   if(opts){setAccounts(opts[0].items);setAc(opts[0].nextCursor);setContacts(opts[1].items);setCc(opts[1].nextCursor);}
   setScope(orgId);setMessage("Sales deals loaded");
  }catch{if(seq===epoch.current){clear();setMessage("Deal access denied or unavailable");}}
  finally{if(seq===epoch.current)setBusy(false);}
 }
 useEffect(()=>{clear();void load();return()=>{++epoch.current;};},[client,accounts,contacts,orgId]);
 async function moreOptions(kind:"account"|"contact"){
  if(busy||scope!==orgId||!(kind==="account"?ac:cc))return;
  const seq=++epoch.current;setBusy(true);
  try{
   if(kind==="account"){const p=await accounts.page(orgId,ac);if(seq!==epoch.current)return;setAccounts(old=>[...old,...p.items]);setAc(p.nextCursor);}
   else{const p=await contacts.page(orgId,cc);if(seq!==epoch.current)return;setContacts(old=>[...old,...p.items]);setCc(p.nextCursor);}
  }catch{if(seq===epoch.current){clear();setMessage("Linked records unavailable");}}
  finally{if(seq===epoch.current)setBusy(false);}
 }
 async function mutate(action:()=>Promise<Deal>){
  if(busy||scope!==orgId)return;const seq=++epoch.current;setBusy(true);
  try{await action();if(seq!==epoch.current)return;setTitle("");setAccountId("");setContactId("");await load();}
  catch(err){if(seq===epoch.current){clear();setMessage(err instanceof SalesDealError&&err.status===409?"Deal conflict. Reload to check the current stage and linked records.":"Deal request denied or unavailable");setBusy(false);}}
 }
 const submit=(e:FormEvent)=>{e.preventDefault();void mutate(()=>client.create(orgId,{title,accountId,contactId}));};
 const ready=scope===orgId&&!busy;
 return <section aria-label="CRM Deals" className="mx-auto max-w-5xl p-6">
  <h2 className="text-xl font-semibold">CRM Deals</h2><p role="status">{message}</p>
  <p>Demo sales pipeline only. Won does not indicate processor approval or activation.</p>
  <button type="button" disabled={busy} onClick={()=>void load()}>Reload deals</button>
  {ready&&<><form onSubmit={submit} className="grid gap-3 py-4">
   <label>Deal title<input required value={title} maxLength={154} onChange={e=>setTitle(e.target.value)} placeholder="Demo Sales Opportunity"/></label>
   <label>Account<select required value={accountId} onChange={e=>{setAccountId(e.target.value);setContactId("");}}><option value="">Choose account</option>{accountOptions.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
   {ac&&<button type="button" onClick={()=>void moreOptions("account")}>Load more account options</button>}
   <label>Contact<select required value={contactId} onChange={e=>setContactId(e.target.value)}><option value="">Choose linked contact</option>{contactOptions.filter(x=>x.accountId===accountId).map(x=><option key={x.id} value={x.id}>{x.displayName}</option>)}</select></label>
   {cc&&<button type="button" onClick={()=>void moreOptions("contact")}>Load more contact options</button>}
   <button type="submit">Create deal</button>
  </form><ul>{items.map(d=><li key={d.id} className="border-b py-3"><strong>{d.title}</strong> · {d.stage} · Revision {d.revision}
    {NEXT[d.stage].map(next=><button type="button" key={next} className="ml-2" onClick={()=>void mutate(()=>client.changeStage(orgId,d.id,next,d.revision))}>Move to {next}</button>)}</li>)}</ul>
  {cursor&&<button type="button" onClick={()=>void load(true)}>Load more deals</button>}</>}
 </section>;
}
