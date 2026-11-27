"use client";
import {useRef,useState} from "react";
import type {IntakeClient,ImportResult,CaptureCommand} from "@/lib/p5-intake-client";
import {parseIntakeCsv,validIntakeRow} from "@/lib/p5-intake-csv";
import {LeadClientError} from "@/lib/p5-leads-client";
const sample="companyName,contactEmail,source\nDemo Import Lead,import@example.com,EVENT";
export function P5IntakeWorkspace({organizationId,client,publicForm=false}:{organizationId:string;client:IntakeClient;publicForm?:boolean}){
 const [csv,setCsv]=useState(sample),[job,setJob]=useState(""),[result,setResult]=useState<ImportResult|null>(null),[preview,setPreview]=useState<(string[]|null)[]|null>(null),[token,setToken]=useState(""),[company,setCompany]=useState(""),[email,setEmail]=useState(""),[consent,setConsent]=useState(false),[website,setWebsite]=useState(""),[pending,setPending]=useState<{id:string;csv:string}|null>(null),[capturePending,setCapturePending]=useState<{token:string;cmd:CaptureCommand}|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const running=useRef(false);
 async function run(fn:()=>Promise<void>){if(running.current)return;running.current=true;setBusy(true);setMessage("");try{await fn();}catch(e){setResult(null);if(e instanceof LeadClientError&&[400,401,403,404,409].includes(e.status)){setPending(null);setCapturePending(null);}setMessage("Intake request invalid, denied or unavailable.");}finally{running.current=false;setBusy(false);}}
 function submit(p:{id:string;csv:string}){return run(async()=>{setPending(p);const r=await client.submit(organizationId,p.id,p.csv);setPending(null);setJob(r.id);setResult(r);setMessage("Import recorded.");});}
 function capture(p:{token:string;cmd:CaptureCommand}){return run(async()=>{setCapturePending(p);await client.capture(p.token,p.cmd);setCapturePending(null);setToken("");setCompany("");setEmail("");setConsent(false);setWebsite("");setMessage("Lead accepted.");});}
 const blocked=busy||pending!==null||capturePending!==null;
 return <main className="mx-auto max-w-5xl space-y-5 p-6"><nav><a href="/">Leads</a> · <a href="/imports">CSV import</a> · <a href="/lead-rules">Lead rules</a> · <a href="/lead-capture">Synthetic form</a></nav><h1>{publicForm?"Synthetic lead capture":"Sales CRM — Lead import"}</h1><p>Fictional Demo companies and example.com emails only. No real customer information.</p>
 {!publicForm?<><section aria-label="Import controls"><label htmlFor="csv-file">Upload CSV</label><input id="csv-file" type="file" accept=".csv,text/csv" disabled={blocked} onChange={e=>{const f=e.target.files?.[0];if(!f)return;void run(async()=>{if(f.size>8000)throw Error("CSV_LIMIT");setCsv(await f.text());setPreview(null);setResult(null);});}}/>
 <label htmlFor="intake-csv">CSV content</label><textarea id="intake-csv" maxLength={8000} rows={8} value={csv} disabled={blocked} onChange={e=>{setCsv(e.target.value);setPreview(null);setResult(null);}}/><p>Required headers: companyName, contactEmail, source (any order). Max 20 data rows. No multiline cells.</p>
 <button disabled={blocked} onClick={()=>void run(async()=>{setPreview(parseIntakeCsv(csv));setResult(null);setMessage("Preview ready.");})}>Preview import</button>
 {preview&&<><table><caption>Mapped CSV preview</caption><thead><tr><th>Row</th><th>Validation</th></tr></thead><tbody>{preview.map((r,i)=><tr key={i}><td>{i+1}</td><td>{validIntakeRow(r)?"Valid format":"Invalid row"}</td></tr>)}</tbody></table><button disabled={blocked} onClick={()=>void submit({id:crypto.randomUUID(),csv})}>Commit import</button></>}
 {pending&&<button disabled={busy} onClick={()=>void submit(pending)}>Retry import</button>}</section>
 <section aria-label="Import status"><label htmlFor="job-id">Import job ID</label><input id="job-id" value={job} disabled={blocked} onChange={e=>{setJob(e.target.value);setResult(null);}}/><button disabled={blocked||!job} onClick={()=>void run(async()=>{setResult(await client.status(organizationId,job));setMessage("Import status loaded.");})}>Load import status</button>
 {result&&<table><caption>Import row outcomes</caption><thead><tr><th>Row</th><th>Outcome</th><th>Lead ID</th></tr></thead><tbody>{result.rows.map(r=><tr key={r.row}><td>{r.row}</td><td>{r.outcome}</td><td>{r.leadId??"—"}</td></tr>)}</tbody></table>}</section></>:<form aria-label="Restricted synthetic capture" onSubmit={e=>{e.preventDefault();if(!blocked)void capture({token,cmd:{requestId:crypto.randomUUID(),companyName:company,contactEmail:email,consent,website}});}}>
 <label htmlFor="capture-token">Fixture form token</label><input id="capture-token" type="password" maxLength={64} autoComplete="off" value={token} disabled={blocked} onChange={e=>setToken(e.target.value)}/>
 <label htmlFor="capture-company">Company name</label><input id="capture-company" required maxLength={53} value={company} disabled={blocked} onChange={e=>setCompany(e.target.value)}/>
 <label htmlFor="capture-email">Contact email</label><input id="capture-email" required type="email" value={email} disabled={blocked} onChange={e=>setEmail(e.target.value)}/>
 <div hidden><label htmlFor="capture-website">Leave blank</label><input id="capture-website" autoComplete="off" tabIndex={-1} value={website} onChange={e=>setWebsite(e.target.value)}/></div>
 <label><input type="checkbox" checked={consent} disabled={blocked} onChange={e=>setConsent(e.target.checked)}/> I consent to this fictional lead submission</label>
 <button disabled={blocked||!consent||!token}>Submit lead</button>{capturePending&&<button type="button" disabled={busy} onClick={()=>void capture(capturePending)}>Retry submission</button>}</form>}
 <p role="status" aria-live="polite">{message}</p></main>;
}
