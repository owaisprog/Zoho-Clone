"use client";
import {useRef,useState} from "react";
import type {Handoff,HandoffClient,Step} from "@/lib/p5-handoff-client";
import {LeadClientError} from "@/lib/p5-leads-client";
const steps:{key:Step;label:string;field:"reviewDone"|"contactDone"|"planDone"}[]=[{key:"REVIEW",label:"Review deal",field:"reviewDone"},{key:"CONTACT",label:"Confirm contact",field:"contactDone"},{key:"PLAN",label:"Prepare onboarding plan",field:"planDone"}];
type Command={deal:string;step:Step;revision:number};
export function P5HandoffWorkspace({organizationId,client}:{organizationId:string;client:HandoffClient}){
 const [items,setItems]=useState<Handoff[]>([]),[cursor,setCursor]=useState<string|null>(null),[loaded,setLoaded]=useState(false),[pending,setPending]=useState<Command|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const running=useRef(false);
 async function run(fn:()=>Promise<void>){if(running.current)return;running.current=true;setBusy(true);setMessage("");try{await fn();}catch(e){setItems([]);setCursor(null);setLoaded(false);if(e instanceof LeadClientError&&[400,401,403,404,409].includes(e.status))setPending(null);setMessage(e instanceof LeadClientError&&e.status===409?"Handoff changed. Reload before editing.":"Handoff request denied or unavailable.");}finally{running.current=false;setBusy(false);}}
 async function load(after:string|null=null){const r=await client.list(organizationId,after);setItems(r.items);setCursor(r.nextCursor);setLoaded(true);setMessage("Handoffs loaded.");}
 function save(cmd:Command){return run(async()=>{setPending(cmd);await client.complete(organizationId,cmd.deal,cmd.step,cmd.revision);setPending(null);await load();setMessage("Checklist saved.");});}
 const blocked=busy||pending!==null;
 return <main className="mx-auto max-w-5xl space-y-5 p-6"><nav><a href="/">Leads</a> · <a href="/deals">Deals</a> · <a href="/handoffs">Onboarding</a> · <a href="/search">CRM search</a></nav><h1>Sales CRM — Customer onboarding</h1><p>Fictional onboarding handoffs are created automatically when an authorized deal is won. No external communication or customer activation.</p>
 <button disabled={blocked} onClick={()=>void run(()=>load())}>Load handoffs</button>
 {pending&&<button disabled={busy} onClick={()=>void save(pending)}>Retry checklist request</button>}
 <section aria-label="Customer handoffs">{loaded&&!items.length&&<p>No visible won-deal handoffs.</p>}
 {items.map(row=><article key={row.dealId} aria-label={row.title}><h2>{row.title}</h2><p>Account: {row.accountId}</p><p>{row.status} · {row.revision}/3 completed</p><progress max={3} value={row.revision} aria-label={row.title+" checklist progress"}/>
 <ul>{steps.map(s=><li key={s.key}><span>{s.label}: {row[s.field]?"Done":"Pending"}</span>{!row[s.field]&&<button disabled={blocked} onClick={()=>void save({deal:row.dealId,step:s.key,revision:row.revision})}>Complete {s.label}</button>}</li>)}</ul></article>)}</section>
 {cursor&&<button disabled={blocked} onClick={()=>void run(()=>load(cursor))}>Next handoffs</button>}<p role="status" aria-live="polite">{message}</p></main>;
}
