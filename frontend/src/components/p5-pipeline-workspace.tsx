"use client";
import {useRef,useState} from "react";
import {LeadClientError} from "@/lib/p5-leads-client";
import {parseStages,type Pipeline,type PipelineClient,type PipelinePage,type PipelineWrite,type StageDefinition} from "@/lib/p5-pipelines-client";
const initial=[{key:"OPEN",label:"Open"},{key:"DISCOVERY",label:"Discovery"},{key:"PROPOSAL",label:"Proposal"},{key:"NEGOTIATION",label:"Negotiation"},{key:"WON",label:"Won"},{key:"LOST",label:"Lost"}];
export function P5PipelineWorkspace({organizationId,client}:{organizationId:string;client:PipelineClient}){
 const [page,setPage]=useState<PipelinePage|null>(null),[selected,setSelected]=useState<Pipeline|null>(null),[name,setName]=useState(""),[stages,setStages]=useState<StageDefinition[]>(initial);
 const [pending,setPending]=useState<{id:string|null;command:PipelineWrite}|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const running=useRef(false),blocked=busy||!!pending;
 function choose(row:Pipeline|null){setSelected(row);setName(row?.name??"");setStages(row?.stages??initial);}
 async function run(fn:()=>Promise<void>){if(running.current)return;running.current=true;setBusy(true);setMessage("");try{await fn();}catch(e){setPage(null);choose(null);if(e instanceof LeadClientError&&[400,401,403,404,409].includes(e.status)){setPending(null);setMessage(e.status===409?"Pipeline conflict. In-use stages are locked; reload before editing.":"Pipeline request denied or invalid.");}else setMessage("Pipeline unavailable. Retry same pending request.");}finally{running.current=false;setBusy(false);}}
 function load(after:string|null){return run(async()=>{setPage(null);choose(null);setPage(await client.list(organizationId,after));setMessage("Pipelines loaded.");});}
 function save(id:string|null,command:PipelineWrite){return run(async()=>{setPage(null);setPending({id,command});const row=await client.write(organizationId,id,command);setPending(null);choose(row);setMessage(id?"Pipeline updated.":"Pipeline saved.");});}
 function patch(i:number,key:"key"|"label",value:string){setStages(old=>old.map((s,n)=>n===i?{...s,[key]:value}:s));}
 function move(i:number,d:number){setStages(old=>{const rows=[...old];const j=i+d;if(j<1||j>=rows.length-2)return old;[rows[i],rows[j]]=[rows[j]!,rows[i]!];return rows;});}
 return <main className="mx-auto max-w-5xl space-y-5 p-6">
 <nav><a href="/">Leads</a> · <a href="/accounts">Accounts</a> · <a href="/contacts">Contacts</a> · <a href="/conversion">Conversion</a> · <a href="/deals">Deals</a> · <a href="/pipelines">Pipelines</a></nav>
 <h1>Sales CRM — Pipelines</h1><p>Fictional tenant-specific settings. Only explicitly authorized sales managers can save. Open, Won and Lost are fixed keys; intermediate stages are ordered. Stages lock after first deal.</p>
 <button disabled={blocked} onClick={()=>void load(null)}>Load pipelines</button><button disabled={blocked} onClick={()=>choose(null)}>New pipeline</button>
 {page&&<section aria-label="Pipeline results">{page.items.map(row=><div key={row.id}><button disabled={blocked} onClick={()=>choose(row)}>Edit {row.name}</button><span>{row.isDefault?" Default":""} · revision {row.revision}</span><p>{row.stages.map(x=>x.label).join(" → ")}</p></div>)}{page.nextCursor&&<button disabled={blocked} onClick={()=>void load(page.nextCursor)}>Next pipelines</button>}</section>}
 <form onSubmit={e=>{e.preventDefault();if(blocked)return;let valid:StageDefinition[];try{valid=parseStages(stages);}catch{setMessage("Invalid stage definition.");return;}void save(selected?.id??null,{requestId:crypto.randomUUID(),name,stages:valid,...(selected?{expectedRevision:selected.revision}:{id:crypto.randomUUID()})});}}>
 <h2>{selected?"Edit pipeline":"Create pipeline"}</h2><label htmlFor="pipeline-name">Pipeline name</label><input id="pipeline-name" required maxLength={80} value={name} disabled={blocked} onChange={e=>setName(e.target.value)}/>
 {stages.map((row,i)=>{const fixed=i===0||i>=stages.length-2;return <fieldset key={i} disabled={blocked}><legend>Stage {i+1}</legend><label htmlFor={"stage-key-"+i}>Stage key {i+1}</label><input id={"stage-key-"+i} required maxLength={24} value={row.key} disabled={fixed} onChange={e=>patch(i,"key",e.target.value.toUpperCase())}/><label htmlFor={"stage-label-"+i}>Stage label {i+1}</label><input id={"stage-label-"+i} required maxLength={40} value={row.label} onChange={e=>patch(i,"label",e.target.value)}/>{!fixed&&<><button type="button" disabled={i===1} onClick={()=>move(i,-1)}>Move stage {i+1} earlier</button><button type="button" disabled={i===stages.length-3} onClick={()=>move(i,1)}>Move stage {i+1} later</button><button type="button" onClick={()=>setStages(old=>old.filter((_,n)=>n!==i))}>Remove stage {i+1}</button></>}</fieldset>;})}
 <button type="button" disabled={blocked||stages.length>=10} onClick={()=>setStages(old=>[...old.slice(0,-2),{key:"REVIEW_"+old.length,label:"Review"},...old.slice(-2)])}>Add stage</button>
 <button type="submit" disabled={blocked||(selected?.revision??0)>=1000000}>{selected?"Save pipeline changes":"Save pipeline"}</button></form>
 {pending&&<button disabled={busy} onClick={()=>void save(pending.id,pending.command)}>Retry same pipeline request</button>}
 <p role="status" aria-live="polite">{message}</p></main>;
}
