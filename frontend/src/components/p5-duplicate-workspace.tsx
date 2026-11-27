"use client";
import {useRef,useState} from "react";
import type {DuplicateClient,MergeCommand,Preview} from "@/lib/p5-duplicate-client";
import type {Contact} from "@/lib/p5-contacts-client";
import {LeadClientError} from "@/lib/p5-leads-client";
export function P5DuplicateWorkspace({organizationId,client}:{organizationId:string;client:DuplicateClient}){
 const [email,setEmail]=useState(""),[rows,setRows]=useState<Contact[]>([]),[source,setSource]=useState(""),[target,setTarget]=useState(""),[preview,setPreview]=useState<Preview|null>(null),[pending,setPending]=useState<MergeCommand|null>(null),[truncated,setTruncated]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const running=useRef(false);
 function reset(){setRows([]);setSource("");setTarget("");setPreview(null);setTruncated(false);}
 async function run(fn:()=>Promise<void>){if(running.current)return;running.current=true;setBusy(true);setMessage("");try{await fn();}catch(e){reset();if(e instanceof LeadClientError&&[400,401,403,404,409].includes(e.status))setPending(null);setMessage("Duplicate request denied, changed or unavailable.");}finally{running.current=false;setBusy(false);}}
 async function load(){const r=await client.list(organizationId,email);reset();setRows(r.items);setTruncated(r.truncated);setMessage("Matches loaded.");}
 function apply(cmd:MergeCommand){return run(async()=>{setPending(cmd);const r=await client.merge(organizationId,cmd);setPending(null);await load();setMessage("Merge complete. Deals relinked: "+r.dealCount+".");});}
 const blocked=busy||pending!==null;
 return <main className="mx-auto max-w-5xl space-y-5 p-6"><nav><a href="/">Leads</a> · <a href="/search">CRM search</a> · <a href="/duplicates">Duplicates</a></nav><h1>Sales CRM — Contact duplicate review</h1><p>Manager-only synthetic merge. Exact email, same account and matching ownership/team are required. Source history is retained; merged contacts cannot be edited in this candidate.</p>
 <label htmlFor="dedupe-email">Exact contact email</label><input id="dedupe-email" type="email" value={email} disabled={blocked} onChange={e=>{setEmail(e.target.value);reset();}}/><button disabled={blocked||!email} onClick={()=>void run(load)}>Find duplicates</button>
 {truncated&&<p>More than 20 matches; only the first 20 are displayed.</p>}
 <section aria-label="Duplicate candidates"><h2>Potential duplicates</h2><ul>{rows.map(r=><li key={r.id}>{r.displayName} — {r.email}</li>)}</ul>
 <label htmlFor="dedupe-source">Source contact to archive</label><select id="dedupe-source" value={source} disabled={blocked} onChange={e=>{setSource(e.target.value);setPreview(null);}}><option value="">Choose source</option>{rows.map(r=><option key={r.id} value={r.id}>{r.displayName}</option>)}</select>
 <label htmlFor="dedupe-target">Target contact to keep</label><select id="dedupe-target" value={target} disabled={blocked} onChange={e=>{setTarget(e.target.value);setPreview(null);}}><option value="">Choose target</option>{rows.map(r=><option key={r.id} value={r.id}>{r.displayName}</option>)}</select>
 <button disabled={blocked||!source||!target||source===target} onClick={()=>void run(async()=>{setPreview(await client.preview(organizationId,source,target));setMessage("Preview loaded.");})}>Preview merge</button></section>
 {preview&&<section aria-label="Merge preview"><h2>Merge preview</h2><p>Archive: {preview.source.displayName}</p><p>Keep: {preview.target.displayName}</p><p>Deals to relink: {preview.dealCount}</p><p>{preview.eligible?"Eligible for merge":"Merge blocked by relationship or permission rules"}</p><button disabled={blocked||!preview.eligible} onClick={()=>void apply({sourceId:preview.source.id,targetId:preview.target.id,requestId:crypto.randomUUID(),sourceRevision:preview.source.revision,targetRevision:preview.target.revision})}>Confirm merge</button></section>}
 {pending&&<button disabled={busy} onClick={()=>void apply(pending)}>Retry merge</button>}<p role="status" aria-live="polite">{message}</p></main>;
}
