"use client";
import {useRef,useState} from "react";
import type {ActivityClient,ActivityKind,Activity} from "@/lib/p5-activities-client";
import type {createP5DealClient} from "@/lib/p5-deals-client";
import {LeadClientError} from "@/lib/p5-leads-client";
type Deals=ReturnType<typeof createP5DealClient>;
export function P5ActivityWorkspace({organizationId,client,deals}:{organizationId:string;client:ActivityClient;deals:Deals}){
 const [deal,setDeal]=useState(""),[kind,setKind]=useState<ActivityKind>("NOTE"),[title,setTitle]=useState(""),[items,setItems]=useState<Activity[]>([]),[cursor,setCursor]=useState<string|null>(null),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
 const [pending,setPending]=useState<{deal:string;id:string;command:{kind:ActivityKind;title:string}|{expectedRevision:0}}|null>(null);
 const running=useRef(false);
 async function run(fn:()=>Promise<void>){if(running.current)return;running.current=true;setBusy(true);setMessage("");try{await fn();}catch(e){setItems([]);setCursor(null);if(e instanceof LeadClientError&&[400,401,403,404,409].includes(e.status))setPending(null);setMessage("Activity request denied or unavailable.");}finally{running.current=false;setBusy(false);}}
 async function load(id:string,after:string|null=null){await deals.detail(organizationId,id);const result=await client.list(organizationId,id,after);setItems(result.items);setCursor(result.nextCursor);setMessage("Activities loaded.");}
 function save(p:NonNullable<typeof pending>){return run(async()=>{setPending(p);await client.write(organizationId,p.deal,p.id,p.command);setPending(null);setTitle("");await load(p.deal);setMessage("Activity saved.");});}
 const blocked=busy||pending!==null;
 return <main className="mx-auto max-w-5xl space-y-5 p-6"><nav><a href="/">Leads</a> · <a href="/deals">Deals</a> · <a href="/board">Sales board</a> · <a href="/activities">Activities</a></nav><h1>Sales CRM — Activities</h1><p>Synthetic deal notes, tasks and activity log only.</p>
 <label htmlFor="activity-deal">Deal ID</label><input id="activity-deal" value={deal} disabled={blocked} onChange={e=>{setDeal(e.target.value);setItems([]);setCursor(null);}}/>
 <button disabled={blocked||!deal} onClick={()=>void run(()=>load(deal))}>Load activities</button>
 <form onSubmit={e=>{e.preventDefault();if(!blocked)void save({deal,id:crypto.randomUUID(),command:{kind,title}});}}>
 <label htmlFor="activity-kind">Activity type</label><select id="activity-kind" value={kind} disabled={blocked} onChange={e=>setKind(e.target.value as ActivityKind)}>{["NOTE","TASK","CALL","MEETING"].map(k=><option key={k}>{k}</option>)}</select>
 <label htmlFor="activity-title">Activity title</label><input id="activity-title" required maxLength={80} value={title} disabled={blocked} onChange={e=>setTitle(e.target.value)}/>
 <button disabled={blocked||!deal||!title}>Save activity</button></form>
 {pending&&<button disabled={busy} onClick={()=>void save(pending)}>Retry activity request</button>}
 <section aria-label="Activity history">{items.map(row=><article key={row.id}><h2>{row.title}</h2><p>{row.kind} · {row.completed?"Completed":"Recorded"}</p>{row.kind==="TASK"&&!row.completed&&<button disabled={blocked} onClick={()=>void save({deal,id:row.id,command:{expectedRevision:0}})}>Complete {row.title}</button>}</article>)}</section>
 {cursor&&<button disabled={blocked} onClick={()=>void run(()=>load(deal,cursor))}>Next activities</button>}
 <p role="status" aria-live="polite">{message}</p></main>;
}
