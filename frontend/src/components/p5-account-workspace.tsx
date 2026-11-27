"use client";
import {useRef,useState} from "react";
import type {Account,AccountClient,AccountPage,AccountWrite,Industry} from "@/lib/p5-accounts-client";
import {LeadClientError} from "@/lib/p5-leads-client";
export function P5AccountWorkspace({organizationId,client}:{organizationId:string;client:AccountClient}){
 const [page,setPage]=useState<AccountPage|null>(null),[detail,setDetail]=useState<Account|null>(null);
 const [name,setName]=useState(""),[industry,setIndustry]=useState<Industry>("SERVICES"),[search,setSearch]=useState("");
 const [editName,setEditName]=useState(""),[editIndustry,setEditIndustry]=useState<Industry>("SERVICES");
 const [filter,setFilter]=useState({search:"",duplicate:false}),[pending,setPending]=useState<{id:string|null;command:AccountWrite}|null>(null);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState("");const running=useRef(false);
 const blocked=busy||!!pending;
 function show(row:Account){setDetail(row);setEditName(row.name);setEditIndustry(row.industry);}
 async function run(fn:()=>Promise<void>){
  if(running.current)return;running.current=true;setBusy(true);setMessage("");
  try{await fn();}catch(e){setPage(null);setDetail(null);if(e instanceof LeadClientError&&[400,401,403,404,409].includes(e.status)){setPending(null);setMessage(e.status===409?"Account conflict. Reload current record.":"Account request denied or invalid.");}else setMessage("Account unavailable. Retry the same pending request.");}finally{running.current=false;setBusy(false);}
 }
 function load(after:string|null,query=after?filter:{search,duplicate:false}){return run(async()=>{setPage(null);setDetail(null);setFilter(query);setPage(await client.list(organizationId,after,query.search,query.duplicate));setMessage(query.duplicate?"Account duplicate review loaded.":"Accounts loaded.");});}
 function save(id:string|null,command:AccountWrite){return run(async()=>{setDetail(null);setPage(null);setPending({id,command});const row=await client.write(organizationId,id,command);setPending(null);show(row);setName("");setMessage(id?"Account updated.":"Account saved.");});}
 const choices=["SERVICES","RETAIL","TECHNOLOGY","OTHER"] as const;
 return <main className="mx-auto max-w-5xl space-y-5 p-6">
  <nav><a href="/">Leads</a> · <a href="/accounts">Accounts</a> · <a href="/contacts">Contacts</a></nav>
  <h1>Sales CRM — Accounts</h1><p>Fictional company records only. Live CRM remains disabled.</p>
  <form onSubmit={e=>{e.preventDefault();if(!blocked)void save(null,{id:crypto.randomUUID(),requestId:crypto.randomUUID(),name,industry});}}>
   <h2>Create account</h2><label htmlFor="account-name">Account name</label><input id="account-name" value={name} onChange={e=>setName(e.target.value)} required maxLength={80} disabled={blocked}/>
   <label htmlFor="account-industry">Industry</label><select id="account-industry" value={industry} disabled={blocked} onChange={e=>setIndustry(e.target.value as Industry)}>{choices.map(x=><option key={x}>{x}</option>)}</select>
   <button type="submit" disabled={blocked}>Save account</button>
   <button type="button" disabled={blocked||!name} onClick={()=>void load(null,{search:name,duplicate:true})}>Review account duplicates</button>
  </form>
  {pending&&<button disabled={busy} onClick={()=>void save(pending.id,pending.command)}>Retry same account request</button>}
  <label htmlFor="account-search">Search accounts</label><input id="account-search" value={search} maxLength={80} disabled={blocked} onChange={e=>setSearch(e.target.value)}/>
  <button disabled={blocked} onClick={()=>void load(null)}>Load accounts</button>
  {page&&<section aria-label="Account results"><p>{filter.duplicate?"Visible possible duplicates only; no automatic merge.":"Authorized accounts"}</p><table><thead><tr><th>Name</th><th>Industry</th><th>Action</th></tr></thead><tbody>{page.items.map(row=><tr key={row.id}><td>{row.name}</td><td>{row.industry}</td><td><button disabled={blocked} onClick={()=>void run(async()=>{setDetail(null);show(await client.detail(organizationId,row.id));setMessage("Account details loaded.");})}>View {row.name}</button></td></tr>)}</tbody></table>{page.items.length===0&&<p>No visible accounts.</p>}{page.nextCursor&&<button disabled={blocked} onClick={()=>void load(page.nextCursor)}>Next accounts</button>}</section>}
  {detail&&<section aria-label="Account details"><h2>{detail.name}</h2><p>{detail.industry} · revision {detail.revision}</p><form onSubmit={e=>{e.preventDefault();if(!blocked)void save(detail.id,{requestId:crypto.randomUUID(),expectedRevision:detail.revision,name:editName,industry:editIndustry});}}>
   <label htmlFor="account-edit-name">Edit account name</label><input id="account-edit-name" value={editName} required maxLength={80} disabled={blocked} onChange={e=>setEditName(e.target.value)}/>
   <label htmlFor="account-edit-industry">Edit industry</label><select id="account-edit-industry" value={editIndustry} disabled={blocked} onChange={e=>setEditIndustry(e.target.value as Industry)}>{choices.map(x=><option key={x}>{x}</option>)}</select>
   <button disabled={blocked||detail.revision>=1000000}>Save account changes</button>
  </form></section>}
  <p role="status" aria-live="polite">{message}</p>
 </main>;
}
