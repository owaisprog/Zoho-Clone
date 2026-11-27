"use client";
import {useRef,useState} from "react";
import {LeadClientError} from "@/lib/p5-leads-client";
import {DEAL_STAGES,type Deal,type DealStage,type DealPage} from "@/lib/p5-conversion-client";
import type {DealClient,DealDraft,DealChange,DealHistory} from "@/lib/p5-deals-client";
import type {AccountClient,AccountPage} from "@/lib/p5-accounts-client";
import type {ContactClient,ContactPage} from "@/lib/p5-contacts-client";
import type {PipelineClient,PipelinePage} from "@/lib/p5-pipelines-client";
const money=(n:number)=>(n/100).toLocaleString("en-US",{style:"currency",currency:"USD"});
export function P5DealWorkspace({organizationId,client,accounts,contacts,pipelines}:{organizationId:string;client:DealClient;accounts:AccountClient;contacts:ContactClient;pipelines:PipelineClient}){
 const [pipelineOptions,setPipelineOptions]=useState<PipelinePage|null>(null),[pipelineId,setPipelineId]=useState("");
 const [page,setPage]=useState<DealPage|null>(null),[detail,setDetail]=useState<Deal|null>(null),[history,setHistory]=useState<DealHistory|null>(null);
 const [title,setTitle]=useState(""),[value,setValue]=useState("0"),[account,setAccount]=useState(""),[contact,setContact]=useState("");
 const [editTitle,setEditTitle]=useState(""),[editValue,setEditValue]=useState("0");
 const [accountSearch,setAccountSearch]=useState(""),[contactSearch,setContactSearch]=useState(""),[accountOptions,setAccountOptions]=useState<AccountPage|null>(null),[contactOptions,setContactOptions]=useState<ContactPage|null>(null);
 const [search,setSearch]=useState(""),[stage,setStage]=useState<DealStage|null>(null),[filter,setFilter]=useState({search:"",stage:null as DealStage|null});
 const [pending,setPending]=useState<{id:string|null;command:DealDraft|DealChange}|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const running=useRef(false),blocked=busy||!!pending;
 function show(row:Deal){setDetail(row);setEditTitle(row.title);setEditValue(String(row.valueCents));setHistory(null);}
 async function run(fn:()=>Promise<void>){if(running.current)return;running.current=true;setBusy(true);setMessage("");try{await fn();}catch(e){setPage(null);setDetail(null);setHistory(null);setAccountOptions(null);setContactOptions(null);setPipelineOptions(null);setPipelineId("");setAccount("");setContact("");if(e instanceof LeadClientError&&[400,401,403,404,409].includes(e.status)){setPending(null);setMessage(e.status===409?"Deal conflict. Reload current record.":"Deal request denied or invalid.");}else setMessage("Deal unavailable. Retry same pending request.");}finally{running.current=false;setBusy(false);}}
 function load(after:string|null,q=after?filter:{search,stage}){return run(async()=>{setPage(null);setDetail(null);setHistory(null);setFilter(q);setPage(await client.list(organizationId,after,q.search,q.stage));setMessage("Deals loaded.");});}
 function save(id:string|null,command:DealDraft|DealChange){return run(async()=>{setPage(null);setDetail(null);setHistory(null);setPending({id,command});const row=await client.write(organizationId,id,command);setPending(null);show(row);setMessage(id?"Deal updated.":"Deal saved.");});}
 function loadHistory(id:string,after=-1){return run(async()=>{setHistory(null);setHistory(await client.history(organizationId,id,after));setMessage("Deal history loaded.");});}
 const loadPipelines=(after:string|null)=>run(async()=>{setPipelineId("");setPipelineOptions(await pipelines.list(organizationId,after));setMessage("Deal pipelines loaded.");});
 return <main className="mx-auto max-w-5xl space-y-5 p-6">
 <nav><a href="/">Leads</a> · <a href="/accounts">Accounts</a> · <a href="/contacts">Contacts</a> · <a href="/conversion">Conversion</a> · <a href="/deals">Deals</a> · <a href="/pipelines">Pipelines</a> · <a href="/board">Sales board</a></nav>
 <h1>Sales CRM — Deals</h1><p>Fictional opportunities only. Values are integer USD cents; no payment or processing action.</p>
 <section aria-label="Deal relationships">
 <label htmlFor="deal-account-search">Find deal accounts</label><input id="deal-account-search" value={accountSearch} maxLength={80} disabled={blocked} onChange={e=>setAccountSearch(e.target.value)}/><button disabled={blocked} onClick={()=>void run(async()=>{setAccount("");setContact("");setAccountOptions(await accounts.list(organizationId,null,accountSearch));setContactOptions(null);setMessage("Deal accounts loaded.");})}>Load deal accounts</button>
 <label htmlFor="deal-account">Deal account</label><select id="deal-account" value={account} disabled={blocked} onChange={e=>{setAccount(e.target.value);setContact("");setContactOptions(null);}}><option value="">Choose account</option>{accountOptions?.items.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>
 <label htmlFor="deal-contact-search">Find deal contacts</label><input id="deal-contact-search" value={contactSearch} maxLength={80} disabled={blocked} onChange={e=>setContactSearch(e.target.value)}/><button disabled={blocked||!account} onClick={()=>void run(async()=>{setContact("");setContactOptions(await contacts.list(organizationId,null,contactSearch));setMessage("Deal contacts loaded.");})}>Load deal contacts</button>
 <label htmlFor="deal-contact">Deal contact</label><select id="deal-contact" value={contact} disabled={blocked} onChange={e=>setContact(e.target.value)}><option value="">Choose linked contact</option>{contactOptions?.items.filter(x=>x.accountId===account).map(x=><option key={x.id} value={x.id}>{x.displayName}</option>)}</select><p>Search to narrow account and contact options to the first 20 results.</p>
 </section>
 <form onSubmit={e=>{e.preventDefault();if(!blocked&&account&&contact)void save(null,{id:crypto.randomUUID(),requestId:crypto.randomUUID(),accountId:account,contactId:contact,title,valueCents:Number(value),...(pipelineId?{pipelineId}:{})});}}>
 <button type="button" disabled={blocked} onClick={()=>void loadPipelines(null)}>Load deal pipelines</button>
 {pipelineOptions?.nextCursor&&<button type="button" disabled={blocked} onClick={()=>void loadPipelines(pipelineOptions.nextCursor)}>Next deal pipelines</button>}
 <label htmlFor="deal-pipeline">Deal pipeline</label><select id="deal-pipeline" value={pipelineId} disabled={blocked} onChange={e=>setPipelineId(e.target.value)}><option value="">Default pipeline</option>{pipelineOptions?.items.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>
 <label htmlFor="deal-title">Deal title</label><input id="deal-title" required maxLength={80} value={title} disabled={blocked} onChange={e=>setTitle(e.target.value)}/>
 <label htmlFor="deal-value">Deal value in cents</label><input id="deal-value" type="number" min={0} max={1000000000} step={1} required value={value} disabled={blocked} onChange={e=>setValue(e.target.value)}/>
 <button disabled={blocked||!account||!contact}>Save deal</button></form>
 {pending&&<button disabled={busy} onClick={()=>void save(pending.id,pending.command)}>Retry same deal request</button>}
 <label htmlFor="deal-search">Search deals</label><input id="deal-search" value={search} maxLength={80} disabled={blocked} onChange={e=>setSearch(e.target.value)}/>
 <label htmlFor="deal-stage-filter">Filter deal stage</label><select id="deal-stage-filter" value={stage??""} disabled={blocked} onChange={e=>setStage((e.target.value||null) as DealStage|null)}><option value="">All stages</option>{Array.from(new Set([...DEAL_STAGES,...(pipelineOptions?.items.flatMap(p=>p.stages.map(s=>s.key))??[])])).map(x=><option key={x}>{x}</option>)}</select><button disabled={blocked} onClick={()=>void load(null)}>Load managed deals</button>
 {page&&<section aria-label="Deal results"><table><thead><tr><th>Title</th><th>Value</th><th>Stage</th><th>Action</th></tr></thead><tbody>{page.items.map(x=><tr key={x.id}><td>{x.title}</td><td>{money(x.valueCents)}</td><td>{x.stage}</td><td><button disabled={blocked} onClick={()=>void run(async()=>{setDetail(null);show(await client.detail(organizationId,x.id));setMessage("Deal details loaded.");})}>View {x.title}</button></td></tr>)}</tbody></table>{page.nextCursor&&<button disabled={blocked} onClick={()=>void load(page.nextCursor)}>Next deals</button>}</section>}
 {detail&&<section aria-label="Deal details"><h2>{detail.title}</h2><p>{detail.stage} · revision {detail.revision}</p><p>{money(detail.valueCents)}</p>
 <form onSubmit={e=>{e.preventDefault();if(!blocked)void save(detail.id,{operation:"edit",requestId:crypto.randomUUID(),expectedRevision:detail.revision,title:editTitle,valueCents:Number(editValue)});}}>
 <label htmlFor="deal-edit-title">Edit deal title</label><input id="deal-edit-title" required maxLength={80} value={editTitle} disabled={blocked||detail.nextStages.length===0} onChange={e=>setEditTitle(e.target.value)}/>
 <label htmlFor="deal-edit-value">Edit value in cents</label><input id="deal-edit-value" required type="number" min={0} max={1000000000} step={1} value={editValue} disabled={blocked||detail.nextStages.length===0} onChange={e=>setEditValue(e.target.value)}/>
 <button disabled={blocked||detail.nextStages.length===0||detail.revision>=1000000}>Save deal changes</button></form>
 {detail.nextStages.map(x=><button key={x} disabled={blocked||detail.revision>=1000000} onClick={()=>void save(detail.id,{operation:"transition",requestId:crypto.randomUUID(),expectedRevision:detail.revision,nextStage:x})}>Move deal to {x}</button>)}
 <button disabled={blocked} onClick={()=>void loadHistory(detail.id)}>Load deal history</button>{history&&<ul>{history.items.map(x=><li key={x.revision}>{x.action} · revision {x.revision}{x.previousStage&&" · "+x.previousStage+" to "+x.nextStage}</li>)}</ul>}{history?.nextCursor!==null&&history?.nextCursor!==undefined&&<button disabled={blocked} onClick={()=>void loadHistory(detail.id,history.nextCursor!)}>Next deal history</button>}</section>}
 <p role="status" aria-live="polite">{message}</p></main>;
}
