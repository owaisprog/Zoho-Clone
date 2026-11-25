"use client";
import React,{useEffect,useRef,useState,type FormEvent} from "react";
import {P4R73WorkspaceController,type WorkspaceView,type SalesTab} from "../lib/p4-r73-ci-sales-workspace-controller";
import {P4R73WorkspacePanel,type Clients} from "./p4-r73-ci-sales-workspace";
import {P4R77CiSearchClient,SEARCH_KINDS,SEARCH_STATUSES,type SearchKind,type SearchPage,type SearchQuery} from "../lib/p4-r77-ci-search-client";
import type {P4R75CiSalesTasksClient} from "../lib/p4-r75-ci-sales-tasks-client";
import type {P4R76CiSharingClient} from "../lib/p4-r76-ci-sharing-client";
import {P4R75SalesTasksPanel} from "./p4-r75-ci-sales-tasks";
import {P4R79Timeline} from "./p4-r79-ci-activity";
import type {P4R79CiActivityClient} from "../lib/p4-r79-ci-activity-client";
import {P4R76SharingPanel} from "./p4-r76-ci-sharing";
export type ExtendedClients=Clients&Readonly<{search:P4R77CiSearchClient;tasks:P4R75CiSalesTasksClient;sharing:P4R76CiSharingClient;activity?:P4R79CiActivityClient}>;
const EXTRA=["Tasks","Sharing","Search"] as const;
type Mode=typeof EXTRA[number];
const initial:SearchQuery={kind:"LEAD",q:"",status:"",after:null};
export function P4R77RecordModule({clients,orgId,mode}:{clients:ExtendedClients;orgId:string;mode:Mode}){
 const epoch=useRef(0),[query,setQuery]=useState<SearchQuery>(initial),[page,setPage]=useState<SearchPage|null>(null),
 [scope,setScope]=useState(""),[busy,setBusy]=useState(true),[message,setMessage]=useState("Checking record access"),[history,setHistory]=useState<string|null>(null);
 const bound=scope===orgId+":"+mode;
 async function load(input:SearchQuery,append=false){const seq=++epoch.current;setBusy(true);if(!append){setPage(null);setScope("");setHistory(null); }
  try{const p=await clients.search.search(orgId,input);if(seq!==epoch.current)return;setPage(old=>append&&old&&old.actorId===p.actorId?{actorId:p.actorId,items:[...old.items,...p.items],nextCursor:p.nextCursor}:p);setScope(orgId+":"+mode);setMessage("Authorized records");}
  catch{if(seq===epoch.current){setPage(null);setScope("");setMessage("Search denied or unavailable");}}finally{if(seq===epoch.current)setBusy(false);}}
 useEffect(()=>{setQuery(initial);void load(initial);return()=>{++epoch.current;};},[clients.search,orgId,mode]);
 function edit(next:SearchQuery){++epoch.current;setQuery(next);setHistory(null);setPage(null);setScope("");setMessage("Run search to load matching records");setBusy(false);}
 const submit=(e:FormEvent)=>{e.preventDefault();void load(query);};
 const kinds=SEARCH_KINDS.filter(k=>mode==="Search"||(k!=="TASK"&&(mode!=="Tasks"||k!=="CONTACT")));
 const records=bound&&page&&!busy?page.items.map(r=>({kind:query.kind,id:r.id,label:r.label})):[];
 const parents=records.filter((r):r is {kind:"LEAD"|"ACCOUNT"|"DEAL";id:string;label:string}=>r.kind==="LEAD"||r.kind==="ACCOUNT"||r.kind==="DEAL");
 const owned=records.filter((r):r is {kind:"LEAD"|"ACCOUNT"|"CONTACT"|"DEAL";id:string;label:string}=>r.kind!=="TASK");
 return <section aria-label={mode==="Search"?"CRM record search":mode==="Tasks"?"Task record picker":"Sharing record picker"} className="space-y-4">
 <h2>{mode==="Search"?"Search my CRM records":"Choose my CRM records"}</h2><p role="status">{message}</p><form onSubmit={submit} className="grid gap-3 md:grid-cols-3">
 <label>Record type<select disabled={busy} value={query.kind} onChange={e=>edit({kind:e.target.value as SearchKind,q:query.q,status:"",after:null})}>{kinds.map(k=><option key={k}>{k}</option>)}</select></label>
 <label>Search by name<input disabled={busy} value={query.q} maxLength={64} onChange={e=>edit({...query,q:e.target.value,after:null})}/></label>
 <label>Status<select disabled={busy} value={query.status} onChange={e=>edit({...query,status:e.target.value,after:null})}><option value="">All statuses</option>{SEARCH_STATUSES[query.kind].map(s=><option key={s}>{s}</option>)}</select></label>
 <button type="submit" disabled={busy}>Search records</button></form>
 {bound&&page&&!busy&&<><p>{page.items.length} loaded records</p>{mode==="Search"&&<ul>{page.items.map(r=><li key={r.id}>{r.label} · {r.status??query.kind}{clients.activity&&<button type="button" onClick={()=>setHistory(r.id)}>View activity</button>}</li>)}</ul>}
 {mode==="Search"&&clients.activity&&history&&page.items.some(r=>r.id===history)&&<P4R79Timeline key={query.kind+":"+history} client={clients.activity} orgId={orgId} kind={query.kind} recordId={history}/>}
 {page.nextCursor&&<button type="button" onClick={()=>void load({...query,after:page.nextCursor},true)}>Load more records</button>}
 {mode==="Tasks"&&<P4R75SalesTasksPanel client={clients.tasks} orgId={orgId} assignee={page.actorId} parents={parents}/>}
 {mode==="Sharing"&&<P4R76SharingPanel client={clients.sharing} orgId={orgId} owned={owned}/>}</>}
 </section>;
}
export function P4R77WorkspacePanel({view,clients,onOrg,onTab,onReload}:{view:WorkspaceView;clients:ExtendedClients;onOrg:(id:string)=>void;onTab:(tab:SalesTab)=>void;onReload:()=>void}){
 return <P4R73WorkspacePanel view={view} clients={clients} onOrg={onOrg} onTab={onTab} onReload={onReload} extra={{tabs:EXTRA,render:(tab,org)=><P4R77RecordModule clients={clients} orgId={org} mode={tab as Mode}/>}}/>;
}
export function P4R77SalesWorkspace({controller,clients}:{controller:P4R73WorkspaceController;clients:ExtendedClients}){
 const epoch=useRef(0),[state,setState]=useState<{controller:P4R73WorkspaceController;view:WorkspaceView}|null>(null);
 function call(p:Promise<WorkspaceView>){const seq=++epoch.current;setState({controller,view:controller.snapshot()});void p.then(v=>{if(seq===epoch.current)setState({controller,view:v});});}
 useEffect(()=>{controller.reset();call(controller.select());return()=>{++epoch.current;controller.reset();};},[controller,clients.search,clients.tasks,clients.sharing]);
 if(state?.controller!==controller)return <p role="status">Checking sales workspace</p>;
 return <P4R77WorkspacePanel view={state.view} clients={clients} onOrg={id=>call(controller.select(id))} onTab={tab=>call(controller.navigate(tab))} onReload={()=>call(controller.select(state.view.orgId))}/>;
}
