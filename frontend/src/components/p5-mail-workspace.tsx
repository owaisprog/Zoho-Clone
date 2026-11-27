"use client";
import {useRef,useState} from "react";
import type {MailClient,Template,EmailLog} from "@/lib/p5-mail-client";
import {LeadClientError} from "@/lib/p5-leads-client";
type Command={id:string;subject:string;body:string;deal:string|null;direction:"INBOUND"|"OUTBOUND"};
export function P5MailWorkspace({organizationId,client}:{organizationId:string;client:MailClient}){
 const [deal,setDeal]=useState(""),[subject,setSubject]=useState(""),[body,setBody]=useState(""),[direction,setDirection]=useState<"INBOUND"|"OUTBOUND">("OUTBOUND"),[templates,setTemplates]=useState<Template[]>([]),[logs,setLogs]=useState<EmailLog[]>([]),[tc,setTc]=useState<string|null>(null),[lc,setLc]=useState<string|null>(null),[pending,setPending]=useState<Command|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const running=useRef(false);
 async function run(fn:()=>Promise<void>){if(running.current)return;running.current=true;setBusy(true);setMessage("");try{await fn();}catch(e){setTemplates([]);setLogs([]);setTc(null);setLc(null);if(e instanceof LeadClientError&&[400,401,403,404,409].includes(e.status))setPending(null);setMessage("Mail request denied or unavailable.");}finally{running.current=false;setBusy(false);}}
 async function loadTemplates(after:string|null=null){const r=await client.templates(organizationId,after);setTemplates(r.items);setTc(r.nextCursor);setMessage("Templates loaded.");}
 async function loadLogs(id:string,after:string|null=null){const r=await client.emails(organizationId,id,after);setLogs(r.items);setLc(r.nextCursor);setMessage("Message history loaded.");}
 function save(cmd:Command){return run(async()=>{setPending(cmd);const data={subject:cmd.subject,body:cmd.body};if(cmd.deal===null){await client.saveTemplate(organizationId,cmd.id,data);setPending(null);await loadTemplates();setMessage("Template saved.");}else{await client.log(organizationId,cmd.deal,cmd.id,{...data,direction:cmd.direction});setPending(null);await loadLogs(cmd.deal);setMessage("Message recorded.");}});}
 const blocked=busy||pending!==null;
 const command=(target:string|null):Command=>({id:crypto.randomUUID(),subject,body,deal:target,direction});
 return <main className="mx-auto max-w-5xl space-y-5 p-6"><nav><a href="/">Leads</a> · <a href="/activities">Activities</a> · <a href="/emails">Email history</a></nav><h1>Sales CRM — Email history and templates</h1><p>Fictional manual records only. Nothing is sent; no connected mailbox. Use Demo-prefixed synthetic text.</p>
 <section aria-label="Personal templates"><h2>Personal templates</h2><button disabled={blocked} onClick={()=>void run(()=>loadTemplates())}>Load templates</button>
 {templates.map(t=><article key={t.id}><h3>{t.subject}</h3><p>{t.body}</p><button disabled={blocked} onClick={()=>{setSubject(t.subject);setBody(t.body);}}>Use {t.subject}</button></article>)}
 {tc&&<button disabled={blocked} onClick={()=>void run(()=>loadTemplates(tc))}>Next templates</button>}</section>
 <section aria-label="Message editor"><h2>Message editor</h2><label htmlFor="mail-subject">Subject</label><input id="mail-subject" maxLength={80} disabled={blocked} value={subject} onChange={e=>setSubject(e.target.value)}/>
 <label htmlFor="mail-body">Message body</label><textarea id="mail-body" maxLength={240} disabled={blocked} value={body} onChange={e=>setBody(e.target.value)}/>
 <button disabled={blocked||!subject||!body} onClick={()=>void save(command(null))}>Save template</button>
 <label htmlFor="mail-deal">Deal ID</label><input id="mail-deal" value={deal} disabled={blocked} onChange={e=>{setDeal(e.target.value);setLogs([]);setLc(null);}}/>
 <label htmlFor="mail-direction">Direction</label><select id="mail-direction" value={direction} disabled={blocked} onChange={e=>setDirection(e.target.value as "INBOUND"|"OUTBOUND")}><option>OUTBOUND</option><option>INBOUND</option></select>
 <button disabled={blocked||!subject||!body||!deal} onClick={()=>void save(command(deal))}>Record fictional message</button>
 {pending&&<button disabled={busy} onClick={()=>void save(pending)}>Retry mail request</button>}</section>
 <section aria-label="Message history"><h2>Message history</h2><button disabled={blocked||!deal} onClick={()=>void run(()=>loadLogs(deal))}>Load message history</button>
 {logs.map(l=><article key={l.id}><h3>{l.subject}</h3><p>{l.direction} · <time dateTime={l.recordedAt}>{l.recordedAt}</time></p><p>{l.body}</p></article>)}
 {lc&&<button disabled={blocked} onClick={()=>void run(()=>loadLogs(deal,lc))}>Next messages</button>}</section>
 <p role="status" aria-live="polite">{message}</p></main>;
}
