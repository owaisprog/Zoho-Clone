"use client";
import {useRef,useState} from "react";
import type {Contact,ContactClient,ContactPage,ContactWrite} from "@/lib/p5-contacts-client";
import type {AccountClient,AccountPage} from "@/lib/p5-accounts-client";
import {LeadClientError} from "@/lib/p5-leads-client";
export function P5ContactWorkspace({organizationId,client,accounts}:{organizationId:string;client:ContactClient;accounts:AccountClient}){
 const [page,setPage]=useState<ContactPage|null>(null),[detail,setDetail]=useState<Contact|null>(null);
 const [name,setName]=useState(""),[email,setEmail]=useState(""),[accountId,setAccountId]=useState("");
 const [editName,setEditName]=useState(""),[editEmail,setEditEmail]=useState(""),[editAccountId,setEditAccountId]=useState("");
 const [accountSearch,setAccountSearch]=useState(""),[appliedAccountSearch,setAppliedAccountSearch]=useState(""),[options,setOptions]=useState<AccountPage|null>(null);
 const [search,setSearch]=useState(""),[filter,setFilter]=useState({search:"",duplicate:false});
 const [pending,setPending]=useState<{id:string|null;command:ContactWrite}|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const running=useRef(false),blocked=busy||!!pending;
 function show(row:Contact){setDetail(row);setEditName(row.displayName);setEditEmail(row.email);setEditAccountId(row.accountId??"");}
 async function run(fn:()=>Promise<void>){
  if(running.current)return;running.current=true;setBusy(true);setMessage("");
  try{await fn();}catch(e){setPage(null);setDetail(null);setOptions(null);setAccountId("");setEditAccountId("");if(e instanceof LeadClientError&&[400,401,403,404,409].includes(e.status)){setPending(null);setMessage(e.status===409?"Contact conflict. Reload current record.":"Contact request denied or invalid.");}else setMessage("Contact unavailable. Retry the same pending request.");}finally{running.current=false;setBusy(false);}
 }
 function load(after:string|null,query=after?filter:{search,duplicate:false}){return run(async()=>{setPage(null);setDetail(null);setFilter(query);setPage(await client.list(organizationId,after,query.search,query.duplicate));setMessage(query.duplicate?"Contact duplicate review loaded.":"Contacts loaded.");});}
 function loadAccounts(after:string|null){return run(async()=>{const query=after?appliedAccountSearch:accountSearch;setOptions(null);setAppliedAccountSearch(query);setOptions(await accounts.list(organizationId,after,query));setMessage("Available accounts loaded.");});}
 function save(id:string|null,command:ContactWrite){return run(async()=>{setDetail(null);setPage(null);setPending({id,command});const row=await client.write(organizationId,id,command);setPending(null);show(row);setName("");setEmail("");setAccountId("");setMessage(id?"Contact updated.":"Contact saved.");});}
 function accountOptions(selected:string){return <><option value="">No linked account</option>{selected&&!options?.items.some(x=>x.id===selected)&&<option value={selected}>Previously selected account</option>}{options?.items.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</>;}
 return <main className="mx-auto max-w-5xl space-y-5 p-6">
  <nav><a href="/">Leads</a> · <a href="/accounts">Accounts</a> · <a href="/contacts">Contacts</a> · <a href="/conversion">Conversion</a> · <a href="/deals">Deals</a></nav>
  <h1>Sales CRM — Contacts</h1><p>Fictional names and example.com emails only. No live access.</p>
  <section aria-label="Account selector"><label htmlFor="contact-account-search">Find available accounts</label><input id="contact-account-search" value={accountSearch} maxLength={80} disabled={blocked} onChange={e=>setAccountSearch(e.target.value)}/><button disabled={blocked} onClick={()=>void loadAccounts(null)}>Load available accounts</button>{options?.nextCursor&&<button disabled={blocked} onClick={()=>void loadAccounts(options.nextCursor)}>Next available accounts</button>}</section>
  <form onSubmit={e=>{e.preventDefault();if(!blocked)void save(null,{id:crypto.randomUUID(),requestId:crypto.randomUUID(),displayName:name,email,accountId:accountId||null});}}>
   <h2>Create contact</h2><label htmlFor="contact-name">Contact name</label><input id="contact-name" value={name} required maxLength={80} disabled={blocked} onChange={e=>setName(e.target.value)}/>
   <label htmlFor="contact-email">Contact email</label><input id="contact-email" type="email" value={email} required maxLength={53} disabled={blocked} onChange={e=>setEmail(e.target.value)}/>
   <label htmlFor="contact-account">Linked account</label><select id="contact-account" value={accountId} disabled={blocked} onChange={e=>setAccountId(e.target.value)}>{accountOptions(accountId)}</select>
   <button type="submit" disabled={blocked}>Save contact</button>
   <button type="button" disabled={blocked||!email} onClick={()=>void load(null,{search:email,duplicate:true})}>Review contact duplicates</button>
  </form>
  {pending&&<button disabled={busy} onClick={()=>void save(pending.id,pending.command)}>Retry same contact request</button>}
  <label htmlFor="contact-search">Search contacts</label><input id="contact-search" value={search} maxLength={80} disabled={blocked} onChange={e=>setSearch(e.target.value)}/>
  <button disabled={blocked} onClick={()=>void load(null)}>Load contacts</button>
  {page&&<section aria-label="Contact results"><p>{filter.duplicate?"Visible possible duplicates only; no automatic merge.":"Authorized contacts"}</p><table><thead><tr><th>Name</th><th>Email</th><th>Action</th></tr></thead><tbody>{page.items.map(row=><tr key={row.id}><td>{row.displayName}</td><td>{row.email}</td><td><button disabled={blocked} onClick={()=>void run(async()=>{setDetail(null);show(await client.detail(organizationId,row.id));setMessage("Contact details loaded.");})}>View {row.displayName}</button></td></tr>)}</tbody></table>{page.items.length===0&&<p>No visible contacts.</p>}{page.nextCursor&&<button disabled={blocked} onClick={()=>void load(page.nextCursor)}>Next contacts</button>}</section>}
  {detail&&<section aria-label="Contact details"><h2>{detail.displayName}</h2><p>{detail.email} · revision {detail.revision}</p><p>Linked account: {detail.accountId??"None"}</p>
   <form onSubmit={e=>{e.preventDefault();if(!blocked)void save(detail.id,{requestId:crypto.randomUUID(),expectedRevision:detail.revision,displayName:editName,email:editEmail,accountId:editAccountId||null});}}>
   <label htmlFor="contact-edit-name">Edit contact name</label><input id="contact-edit-name" value={editName} required maxLength={80} disabled={blocked} onChange={e=>setEditName(e.target.value)}/>
   <label htmlFor="contact-edit-email">Edit contact email</label><input id="contact-edit-email" type="email" value={editEmail} required maxLength={53} disabled={blocked} onChange={e=>setEditEmail(e.target.value)}/>
   <label htmlFor="contact-edit-account">Edit linked account</label><select id="contact-edit-account" value={editAccountId} disabled={blocked} onChange={e=>setEditAccountId(e.target.value)}>{accountOptions(editAccountId)}</select>
   <button disabled={blocked||detail.revision>=1000000}>Save contact changes</button>
   </form></section>}
  <p role="status" aria-live="polite">{message}</p>
 </main>;
}
