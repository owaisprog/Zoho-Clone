"use client";
import React,{useEffect,useRef,useState,type FormEvent} from "react";
import type {P4R74CiTeamReportsClient,ManagedTeam,TeamReport,TeamQuery} from "../lib/p4-r74-ci-team-reports-client";
export function P4R74TeamReportPanel({client,orgId,initialFrom,initialTo}:{client:P4R74CiTeamReportsClient;orgId:string;initialFrom:string;initialTo:string}){
 const epoch=useRef(0),[scope,setScope]=useState(""),[teams,setTeams]=useState<readonly ManagedTeam[]>([]),[report,setReport]=useState<TeamReport|null>(null),
 [query,setQuery]=useState<TeamQuery>({team:"",owner:"",stage:"",from:initialFrom,to:initialTo}),[busy,setBusy]=useState(true),[message,setMessage]=useState("Checking manager access");
 function clear(){setScope("");setTeams([]);setReport(null);setQuery({team:"",owner:"",stage:"",from:initialFrom,to:initialTo});}
 async function load(){const seq=++epoch.current;clear();setBusy(true);try{const data=await client.teams(orgId);if(seq!==epoch.current)return;setTeams(data);setScope(orgId);setMessage(data.length?"Select a managed team":"No currently managed teams");}catch{if(seq===epoch.current){clear();setMessage("Manager report access denied or unavailable");}}finally{if(seq===epoch.current)setBusy(false);}}
 useEffect(()=>{void load();return()=>{++epoch.current;};},[client,orgId,initialFrom,initialTo]);
 async function submit(e:FormEvent){e.preventDefault();if(busy||scope!==orgId)return;const seq=++epoch.current;setBusy(true);setReport(null);try{const data=await client.report(orgId,query);if(seq!==epoch.current)return;setReport(data);setMessage("Authorized deal counts");}catch{if(seq===epoch.current){clear();setMessage("Report denied or unavailable. Reload access.");}}finally{if(seq===epoch.current)setBusy(false);}}
 function set(k:keyof TeamQuery,v:string){setReport(null);setQuery(old=>({...old,[k]:v}));}
 return <section aria-label="Managed team deal report" className="mx-auto max-w-5xl p-6"><h2 className="text-xl font-bold">Managed team deal report</h2><p role="status">{message}</p><button type="button" disabled={busy} onClick={()=>void load()}>Reload access</button>
 {scope===orgId&&!busy&&teams.length>0&&<form className="grid gap-3 py-4" onSubmit={submit}><label>Managed team<select required value={query.team} onChange={e=>set("team",e.target.value)}><option value="">Choose team</option>{teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
 <label>Sales representative ID (optional)<input value={query.owner} onChange={e=>set("owner",e.target.value)} placeholder="user_demo_bob"/></label>
 <label>Deal stage<select value={query.stage} onChange={e=>set("stage",e.target.value)}>{["","OPEN","DISCOVERY","PROPOSAL","NEGOTIATION","WON","LOST"].map(s=><option key={s} value={s}>{s||"All stages"}</option>)}</select></label>
 <label>From UTC date<input type="date" required value={query.from} onChange={e=>set("from",e.target.value)}/></label><label>Through (exclusive UTC date)<input type="date" required value={query.to} onChange={e=>set("to",e.target.value)}/></label><button type="submit">Run report</button></form>}
 {scope===orgId&&!busy&&report&&<><p>Total authorized deals: {report.total}</p><table><caption>Deal counts by representative and stage</caption><thead><tr><th>Representative</th><th>Stage</th><th>Count</th></tr></thead><tbody>{report.rows.map(r=><tr key={r.owner+":"+r.stage}><td>{r.owner}</td><td>{r.stage}</td><td>{r.total}</td></tr>)}</tbody></table></>}
 </section>;
}
