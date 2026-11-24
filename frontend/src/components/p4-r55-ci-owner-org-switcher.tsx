"use client";
/** R55 real React organization selector above functional R53 owner panel.
 * Fictional CI only; no normal Next.js route imports.
 */
import React,{useEffect,useState} from "react";
import {P4R53CiOwnerWorkspacePanel}
 from "./p4-r53-ci-owner-workspace";
import type {P4R55CiOwnerOrgSwitcher,P4R55CiSwitcherView}
 from "../lib/p4-r55-ci-owner-org-switcher";
import type {P4R41Role} from "../lib/p4-r41-ci-member-role-contract";
import type {P4R44CiFilter} from "../lib/p4-r44-ci-member-directory-contract";
import type {P4R47CiInviteFilter}
 from "../lib/p4-r47-ci-invitation-directory-client";
import type {P4R51Filter} from "../lib/p4-r51-ci-owner-activity-client";
type Props=Readonly<{
 view:P4R55CiSwitcherView;
 onSelect:(id:string)=>void;
 onReload:()=>void;
 onInvite:(email:string)=>void;
 onCancel:(id:string)=>void;
 onRenew:(id:string)=>void;
 onRole:(id:string,role:P4R41Role)=>void;
 onRevoke:(id:string)=>void;
 onMore:(kind:"members"|"invitations"|"activity")=>void;
 onMemberFilter:(kind:P4R44CiFilter,q:string)=>void;
 onInvitationFilter:(kind:P4R47CiInviteFilter,q:string)=>void;
 onActivityFilter:(kind:P4R51Filter)=>void;
}>;
export function P4R55CiOwnerSwitcherPanel(p:Props){
 const v=p.view;
 return (
  <div data-ci-owner-switcher="fictional-only"
   className="min-h-screen bg-slate-50 text-slate-900">
   <section aria-label="Select owner organization"
    className="border-b border-slate-200 bg-white px-4 py-4 md:px-8">
    <div className="mx-auto flex max-w-7xl flex-wrap items-end gap-4">
     <div className="min-w-0 flex-1">
      <label htmlFor="ci-owner-organization" className="mb-2 block text-sm font-semibold">
       Active owner organization
      </label>
      <select id="ci-owner-organization"
       className="w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 text-sm"
       disabled={v.phase!=="ready"} value={v.selectedId??""}
       onChange={e=>p.onSelect(e.target.value)}>
       <option value="">Choose a verified organization</option>
       {v.organizations.map(o=><option key={o.id} value={o.id}>
        {o.name}</option>)}
      </select>
     </div>
     <button type="button" onClick={p.onReload}
      className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold"
      disabled={v.phase!=="ready"}>Recheck access</button>
    </div>
    <p role={v.phase==="denied"?"alert":"status"}
     className="mx-auto mt-2 max-w-7xl text-sm text-slate-600">
     {v.message}
    </p>
   </section>
   <P4R53CiOwnerWorkspacePanel key={v.selectedId??"none"}
    snapshot={v.workspace}
    onRefresh={p.onReload}
    onInvite={p.onInvite}
    onCancel={p.onCancel}
    onRenew={p.onRenew}
    onRole={p.onRole}
    onRevoke={p.onRevoke}
    onMore={p.onMore}
    onMemberFilter={p.onMemberFilter}
    onInvitationFilter={p.onInvitationFilter}
    onActivityFilter={p.onActivityFilter}
   />
  </div>
 );
}
/** All controls are functional against an injected, signed, CI-only model. */
export function P4R55CiOwnerSwitcherBound({
 model,
}:Readonly<{model:P4R55CiOwnerOrgSwitcher}>){
 const [view,setView]=useState<P4R55CiSwitcherView>(model.snapshot());
 useEffect(()=>{
  let alive=true;
  void model.discover().then(v=>{if(alive)setView(v);});
  return ()=>{alive=false;model.reset();};
 },[model]);
 const call=(action:Promise<P4R55CiSwitcherView>)=>{
  setView(model.snapshot());
  void action.then(setView);
 };
 return <P4R55CiOwnerSwitcherPanel view={view}
  onSelect={id=>call(model.select(id))}
  onReload={()=>call(model.refresh())}
  onInvite={email=>call(model.issue(email))}
  onCancel={id=>call(model.cancel(id))}
  onRenew={id=>call(model.renew(id))}
  onRole={(id,role)=>call(model.changeRole(id,role))}
  onRevoke={id=>call(model.revokeMember(id))}
  onMore={kind=>call(model.more(kind))}
  onMemberFilter={(memberFilter,memberSearch)=>
   call(model.refresh({memberFilter,memberSearch}))}
  onInvitationFilter={(invitationFilter,invitationSearch)=>
   call(model.refresh({invitationFilter,invitationSearch}))}
  onActivityFilter={activityFilter=>
   call(model.refresh({activityFilter}))}
 />;
}
