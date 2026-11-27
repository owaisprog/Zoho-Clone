"use client";
import {useRef,useState} from "react";
import type {Followup,FollowupClient} from "@/lib/p5-followups-client";
import type {Activity,ActivityClient} from "@/lib/p5-activities-client";
import {LeadClientError} from "@/lib/p5-leads-client";
export function P5FollowupWorkspace({organizationId,client,activities}:{organizationId:string;client:FollowupClient;activities:ActivityClient}){
 const [deal,setDeal]=useState(""),[tasks,setTasks]=useState<Activity[]>([]),[task,setTask]=useState(""),[date,setDate]=useState(""),[selected,setSelected]=useState<Followup|null>(null),[items,setItems]=useState<Followup[]>([]),[due,setDue]=useState(false),[cursor,setCursor]=useState<string|null>(null),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
 const [pending,setPending]=useState<{id:string;date:string;revision:number}|null>(null),running=useRef(false);
 async function run(fn:()=>Promise<void>){if(running.current)return;running.current=true;setBusy(true);setMessage("");try{await fn();}catch(e){setItems([]);setCursor(null);setTasks([]);setTask("");setSelected(null);if(e instanceof LeadClientError&&[400,401,403,404,409].includes(e.status))setPending(null);setMessage("Follow-up request denied or unavailable.");}finally{running.current=false;setBusy(false);}}
 async function load(only:boolean,after:string|null=null){const result=await client.list(organizationId,only,after);setItems(result.items);setCursor(result.nextCursor);setDue(only);setMessage("Follow-ups loaded.");}
 function save(p:NonNullable<typeof pending>){return run(async()=>{setPending(p);await client.schedule(organizationId,p.id,p.date,p.revision);setPending(null);setSelected(null);setTask("");setDate("");await load(false);setMessage("Follow-up saved.");});}
 const blocked=busy||pending!==null;
 return <main className="mx-auto max-w-5xl space-y-5 p-6"><nav><a href="/">Leads</a> · <a href="/activities">Activities</a> · <a href="/followups">Follow-ups</a></nav><h1>Sales CRM — Follow-ups</h1><p>UTC due dates. In-app reminders only; no emails or external delivery.</p>
 <label htmlFor="followup-deal">Deal ID</label><input id="followup-deal" disabled={blocked} value={deal} onChange={e=>{setDeal(e.target.value);setTasks([]);setTask("");setSelected(null);}}/>
 <button disabled={blocked||!deal} onClick={()=>void run(async()=>{const r=await activities.list(organizationId,deal);setTasks(r.items.filter(a=>a.kind==="TASK"&&!a.completed));setTask("");setSelected(null);setMessage("Tasks loaded.");})}>Load tasks</button>
 <form onSubmit={e=>{e.preventDefault();if(!blocked)void save({id:selected?.activityId??task,date,revision:selected?.revision??-1});}}>
 {selected?<p>Reschedule {selected.title}</p>:<><label htmlFor="followup-task">Task</label><select id="followup-task" value={task} disabled={blocked} onChange={e=>setTask(e.target.value)}><option value="">Choose task</option>{tasks.map(a=><option key={a.id} value={a.id}>{a.title}</option>)}</select></>}
 <label htmlFor="followup-date">Due date</label><input id="followup-date" type="date" min="2000-01-01" max="2099-12-31" required value={date} disabled={blocked} onChange={e=>setDate(e.target.value)}/>
 <button disabled={blocked||(!selected&&!task)||!date}>Save follow-up</button></form>
 {pending&&<button disabled={busy} onClick={()=>void save(pending)}>Retry follow-up</button>}
 <button disabled={blocked} onClick={()=>void run(()=>load(false))}>All follow-ups</button> <button disabled={blocked} onClick={()=>void run(()=>load(true))}>Due reminders</button>
 <section aria-label="Follow-up queue"><h2>{due?"Due reminders":"Follow-up queue"}</h2>{items.map(row=><article key={row.activityId}><h3>{row.title}</h3><p>{row.dueDate} · {row.completed?"Completed":"Pending"}</p>{!row.completed&&<button disabled={blocked} onClick={()=>{setSelected(row);setDate(row.dueDate);}}>Reschedule {row.title}</button>}</article>)}</section>
 {cursor&&<button disabled={blocked} onClick={()=>void run(()=>load(due,cursor))}>Next follow-ups</button>}<p role="status" aria-live="polite">{message}</p></main>;
}
