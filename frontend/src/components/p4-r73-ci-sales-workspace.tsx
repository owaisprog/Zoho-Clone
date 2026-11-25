"use client";
import React,{useEffect,useState} from "react";
import {P4R73WorkspaceController,SALES_TABS,type WorkspaceView} from "../lib/p4-r73-ci-sales-workspace-controller";
import type {P4R72CiSalesLeadsClient} from "../lib/p4-r72-ci-sales-leads-client";
import type {P4R69CiAccountsClient} from "../lib/p4-r69-ci-accounts-client";
import type {P4R70CiContactsClient} from "../lib/p4-r70-ci-contacts-client";
import type {P4R71CiDealsClient} from "../lib/p4-r71-ci-deals-client";
import {P4R72SalesLeadsPanel} from "./p4-r72-ci-sales-leads";
import {P4R69AccountsPanel} from "./p4-r69-ci-accounts";
import {P4R70ContactsPanel} from "./p4-r70-ci-contacts";
import {P4R71DealsPanel} from "./p4-r71-ci-deals";
export type Clients=Readonly<{leads:P4R72CiSalesLeadsClient;accounts:P4R69CiAccountsClient;contacts:P4R70CiContactsClient;deals:P4R71CiDealsClient}>;
export function P4R73WorkspacePanel({view,clients,onOrg,onTab,onReload,extra}:{view:WorkspaceView;clients:Clients;onOrg:(id:string)=>void;onTab:(tab:typeof SALES_TABS[number])=>void;onReload:()=>void;extra?:{tabs:readonly (typeof SALES_TABS[number])[];render:(tab:typeof SALES_TABS[number],org:string)=>React.ReactNode}}){
 const ready=view.phase==="ready"&&view.orgId!==null&&view.overview!==null;
 return <main aria-label="Sales CRM workspace" data-ci-sales-workspace="fictional-only" className="mx-auto max-w-7xl p-6">
  <header><h1 className="text-2xl font-bold">Sales CRM workspace</h1><p>Internal fictional data only</p><p role={view.phase==="denied"?"alert":"status"}>{view.message}</p><button type="button" onClick={onReload} disabled={view.phase==="loading"}>Refresh sales access</button></header>
  {ready&&view.orgId&&view.overview&&<><label>Organization<select value={view.orgId} onChange={e=>onOrg(e.target.value)}>{view.organizations.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
   <nav aria-label="CRM modules" className="my-4 flex flex-wrap gap-3">{SALES_TABS.filter(tab=>!["Tasks","Sharing","Search"].includes(tab)||extra?.tabs.includes(tab)).map(tab=><button type="button" key={tab} aria-current={view.tab===tab?"page":undefined} onClick={()=>onTab(tab)}>{tab}</button>)}</nav>
   <div key={view.orgId+":"+view.tab}>
    {view.tab==="Overview"&&<section aria-label="My sales overview" className="grid grid-cols-2 gap-4 md:grid-cols-4">{Object.entries(view.overview).map(([k,v])=><div className="rounded border p-4" key={k}><p>{k.replace(/([A-Z])/g," $1")}</p><strong>{v}</strong></div>)}</section>}
    {view.tab==="Leads"&&<P4R72SalesLeadsPanel client={clients.leads} orgId={view.orgId} onConverted={()=>onTab("Deals")}/>}
    {view.tab==="Accounts"&&<P4R69AccountsPanel client={clients.accounts} orgId={view.orgId}/>}
    {view.tab==="Contacts"&&<P4R70ContactsPanel client={clients.contacts} accounts={clients.accounts} orgId={view.orgId}/>}
    {view.tab==="Deals"&&<P4R71DealsPanel client={clients.deals} accounts={clients.accounts} contacts={clients.contacts} orgId={view.orgId}/>}
    {extra?.tabs.includes(view.tab)&&extra.render(view.tab,view.orgId)}
   </div></>}
 </main>;
}
export function P4R73SalesWorkspace({controller,clients}:{controller:P4R73WorkspaceController;clients:Clients}){
 const [view,setView]=useState(controller.snapshot());
 useEffect(()=>{let active=true;controller.reset();setView(controller.snapshot());void controller.select().then(v=>{if(active)setView(v);});return()=>{active=false;controller.reset();};},[controller]);
 const call=(p:Promise<WorkspaceView>)=>{setView(controller.snapshot());void p.then(setView);};
 return <P4R73WorkspacePanel view={view} clients={clients} onOrg={id=>call(controller.select(id))} onTab={tab=>call(controller.navigate(tab))} onReload={()=>call(controller.select(view.orgId))}/>;
}
