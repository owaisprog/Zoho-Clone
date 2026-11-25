"use client";
import React,{useEffect,useRef,useState} from "react";
import {P4R80ManagerController,MANAGER_TABS,type ManagerView,type ManagerTab} from "../lib/p4-r80-ci-manager-controller";
import type {P4R74CiTeamReportsClient} from "../lib/p4-r74-ci-team-reports-client";
import type {P4R78CiManagerWorkClient} from "../lib/p4-r78-ci-manager-work-client";
import type {P4R79CiActivityClient} from "../lib/p4-r79-ci-activity-client";
import {P4R78ManagerWorkPanel} from "./p4-r78-ci-manager-work";
import {P4R74TeamReportPanel} from "./p4-r74-ci-team-reports";
import {P4R79WorkloadPanel} from "./p4-r79-ci-activity";
export type ManagerClients=Readonly<{work:P4R78CiManagerWorkClient;reports:P4R74CiTeamReportsClient;activity:P4R79CiActivityClient}>;
export function P4R80ManagerWorkspacePanel({view,clients,initialDate,from,to,onOrg,onTab,onReload}:{view:ManagerView;clients:ManagerClients;initialDate:string;from:string;to:string;onOrg:(id:string)=>void;onTab:(tab:ManagerTab)=>void;onReload:()=>void}){
 return <main aria-label="Manager CRM workspace" className="mx-auto max-w-7xl p-6" data-ci-only="true"><h1>Manager CRM workspace</h1><p role="status">{view.message}</p><button type="button" disabled={view.phase==="loading"} onClick={onReload}>Refresh manager access</button>
 {view.phase==="ready"&&view.orgId&&<><label>Organization<select value={view.orgId} onChange={e=>onOrg(e.target.value)}>{view.organizations.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
 <nav aria-label="Manager modules">{MANAGER_TABS.map(tab=><button key={tab} type="button" aria-current={view.tab===tab?"page":undefined} onClick={()=>onTab(tab)}>{tab}</button>)}</nav>
 <div key={view.orgId+":"+view.tab}>{view.tab==="Work"&&<P4R78ManagerWorkPanel client={clients.work} reports={clients.reports} activity={clients.activity} orgId={view.orgId}/>}
 {view.tab==="Deal reports"&&<P4R74TeamReportPanel client={clients.reports} orgId={view.orgId} initialFrom={from} initialTo={to}/>}
 {view.tab==="Workload"&&<P4R79WorkloadPanel client={clients.activity} reports={clients.reports} orgId={view.orgId} initialDate={initialDate}/>}</div></>}
 </main>;
}
export function P4R80ManagerWorkspace({controller,clients,sessionKey,initialDate,from,to}:{controller:P4R80ManagerController;clients:ManagerClients;sessionKey:string;initialDate:string;from:string;to:string}){
 const epoch=useRef(0),[state,setState]=useState<{controller:P4R80ManagerController;clients:ManagerClients;sessionKey:string;view:ManagerView}|null>(null);
 function call(p:Promise<ManagerView>){const seq=++epoch.current;setState({controller,clients,sessionKey,view:controller.snapshot()});void p.then(view=>{if(seq===epoch.current)setState({controller,clients,sessionKey,view});});}
 useEffect(()=>{controller.reset();call(controller.select());return()=>{++epoch.current;controller.reset();};},[controller,clients,sessionKey]);
 if(state?.controller!==controller||state.clients!==clients||state.sessionKey!==sessionKey)return <p role="status">Checking manager workspace</p>;
 return <P4R80ManagerWorkspacePanel key={sessionKey} view={state.view} clients={clients} initialDate={initialDate} from={from} to={to} onOrg={id=>call(controller.select(id))} onTab={tab=>call(controller.navigate(tab))} onReload={()=>call(controller.select(state.view.orgId))}/>;
}
