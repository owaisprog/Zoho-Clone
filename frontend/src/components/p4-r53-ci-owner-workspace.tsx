"use client";
/**
 * R53: A real React owner management panel, isolated from public Next.js routes.
 * CI-only fictional tenant. Source-graph guard forbids normal app mounting.
 */
import {useEffect,useState,type FormEvent} from "react";
import type {P4R53CiOwnerWorkspaceController,
 P4R53CiWorkspaceSnapshot} from "../lib/p4-r53-ci-owner-workspace-controller";
import type {P4R41Role} from "../lib/p4-r41-ci-member-role-contract";
import type {P4R44CiFilter} from "../lib/p4-r44-ci-member-directory-contract";
import type {P4R47CiInviteFilter} from "../lib/p4-r47-ci-invitation-directory-client";
import type {P4R51Filter} from "../lib/p4-r51-ci-owner-activity-client";

export type P4R53CiOwnerPanelProps=Readonly<{
 snapshot:P4R53CiWorkspaceSnapshot;
 onRefresh:()=>void;
 onInvite:(email:string)=>void;
 onRenew:(invitationId:string)=>void;
 onCancel:(invitationId:string)=>void;
 onRole:(userId:string,role:P4R41Role)=>void;
 onRevoke:(userId:string)=>void;
 onMore:(category:"members"|"invitations"|"activity")=>void;
 onMemberFilter:(status:P4R44CiFilter,search:string)=>void;
 onInvitationFilter:(status:P4R47CiInviteFilter,search:string)=>void;
 onActivityFilter:(kind:P4R51Filter)=>void;
}>;
const COUNTS=[
 ["activeMembers","Active members"],
 ["revokedMembers","Revoked members"],
 ["salesManagers","Sales managers"],
 ["pendingInvites","Pending invitations"],
 ["acceptedInvites","Accepted invitations"],
 ["revokedInvites","Canceled invitations"],
 ["expiredInvites","Expired invitations"],
 ["roleChanges","Role changes"],
 ["membershipEvents","Membership events"],
 ["renewals","Renewals"],
 ["cancellations","Cancellations"],
] as const;
const MEMBER_FILTERS=["all","active","revoked"] as const;
const INVITATION_FILTERS=["all","pending","accepted","revoked","expired"] as const;
const AUDIT_FILTERS=["all","role.changed","member.revoked",
 "member.reactivated","invitation.renewed","invitation.canceled"] as const;
const section="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";
const secondary="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";
const primary="rounded-lg bg-indigo-700 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-50";
const field="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900";

export function P4R53CiOwnerWorkspacePanel(p:P4R53CiOwnerPanelProps){
 const v=p.snapshot,ready=v.phase==="ready";
 const [email,setEmail]=useState("");
 const [memberSearch,setMemberSearch]=useState(v.memberSearch);
 const [invitationSearch,setInvitationSearch]=useState(v.invitationSearch);
 const [confirmation,setConfirmation]=useState<string|null>(null);
 const runSensitive=(key:string,fn:()=>void)=>{
  if(confirmation===key){setConfirmation(null);fn();}
  else setConfirmation(key);
 };
 const submit=(event:FormEvent<HTMLFormElement>)=>{
  event.preventDefault();
  if(!ready||!email.toLowerCase().endsWith("@example.com"))return;
  p.onInvite(email.toLowerCase());setEmail("");
 };
 return (
  <main data-ci-owner-workspace="fictional-only"
   className="mx-auto max-w-7xl space-y-6 bg-slate-50 p-4 text-slate-900 md:p-8">
   <header className="space-y-3">
    <p className="text-xs font-bold uppercase tracking-widest text-indigo-700">
     CI only · fictional data · not deployed
    </p>
    <div className="flex flex-wrap items-start justify-between gap-3">
     <div>
      <h1 className="text-3xl font-bold tracking-tight">Owner operations</h1>
      <p className="mt-1 text-sm text-slate-600">
       Members, invitations and recent audit activity in one workspace
      </p>
     </div>
     <button type="button" className={secondary}
      onClick={p.onRefresh}>Refresh workspace</button>
    </div>
    <p role={v.phase==="denied"?"alert":"status"}
     className={v.phase==="denied"?
      "rounded-lg border border-rose-300 p-3 text-sm text-rose-800":
      "text-sm text-slate-600"}>{v.message}</p>
   </header>
   <section aria-label="Organization scorecard" className={section}>
    <h2 className="mb-4 text-lg font-bold">Organization overview</h2>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
     {COUNTS.map(([key,label])=>(
      <div key={key} className="rounded-xl bg-slate-50 p-3">
       <p className="text-xs font-medium text-slate-600">{label}</p>
       <p className="mt-1 text-2xl font-bold" data-metric={key}>
        {v.counts?.[key]??"—"}</p>
      </div>
     ))}
    </div>
   </section>
   <div className="grid gap-6 lg:grid-cols-2">
    <section aria-label="Invitation management" className={section}>
     <h2 className="mb-4 text-lg font-bold">Invitations</h2>
     <form onSubmit={submit} className="mb-4 flex flex-wrap gap-2">
      <label htmlFor="ci-owner-email" className="sr-only">Fictional recipient email</label>
      <input id="ci-owner-email" type="email" autoComplete="off"
       className={field+" min-w-0 flex-1"}
       placeholder="teammate@example.com" value={email}
       onChange={e=>setEmail(e.target.value)}
       required disabled={!ready}/>
      <button type="submit" className={primary} disabled={!ready}>
       Issue invitation</button>
     </form>
     <div className="mb-4 grid gap-2 sm:grid-cols-2">
      <label className="text-sm">Status
       <select className={field} value={v.invitationFilter}
        onChange={e=>p.onInvitationFilter(
         e.target.value as P4R47CiInviteFilter,invitationSearch)}
        disabled={!ready}>
        {INVITATION_FILTERS.map(f=><option key={f} value={f}>{f}</option>)}
       </select>
      </label>
      <label className="text-sm">Search fictional email
       <div className="flex gap-1">
        <input className={field} aria-label="Search invitations"
         value={invitationSearch}
         onChange={e=>setInvitationSearch(e.target.value)}
         disabled={!ready}/>
        <button type="button" className={secondary} disabled={!ready}
         onClick={()=>p.onInvitationFilter(v.invitationFilter,invitationSearch)}>
         Find</button>
       </div>
      </label>
     </div>
     <ul className="divide-y divide-slate-200" aria-label="Invitation records">
      {v.invitations.map(i=>(
       <li key={i.id} className="space-y-2 py-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
         <p className="text-sm font-medium">{i.recipientEmail}</p>
         <span className="text-xs font-semibold uppercase text-slate-600">
          {i.status}</span>
        </div>
        <p className="text-xs text-slate-500">Revision {i.version}</p>
        <div className="flex flex-wrap gap-2">
         {i.status==="pending"&&(
          <button type="button" className={secondary} disabled={!ready}
           onClick={()=>runSensitive("cancel:"+i.id,()=>p.onCancel(i.id))}>
           {confirmation==="cancel:"+i.id?"Confirm cancellation":"Cancel invitation"}
          </button>
         )}
         {(i.status==="revoked"||i.status==="expired")&&(
          <button type="button" className={secondary} disabled={!ready}
           onClick={()=>p.onRenew(i.id)}>Renew invitation</button>
         )}
        </div>
       </li>
      ))}
     </ul>
     {ready&&v.invitations.length===0&&
      <p className="py-3 text-sm text-slate-500">No matching invitations.</p>}
     {v.invitationCursor&&ready&&
      <button type="button" className={secondary}
       onClick={()=>p.onMore("invitations")}>Load more invitations</button>}
    </section>
    <section aria-label="Member management" className={section}>
     <h2 className="mb-4 text-lg font-bold">Team members</h2>
     <div className="mb-4 grid gap-2 sm:grid-cols-2">
      <label className="text-sm">Status
       <select className={field} value={v.memberFilter}
        onChange={e=>p.onMemberFilter(
         e.target.value as P4R44CiFilter,memberSearch)}
        disabled={!ready}>
        {MEMBER_FILTERS.map(f=><option key={f} value={f}>{f}</option>)}
       </select>
      </label>
      <label className="text-sm">Search members
       <div className="flex gap-1">
        <input className={field} value={memberSearch}
         aria-label="Search members"
         onChange={e=>setMemberSearch(e.target.value)}
         disabled={!ready}/>
        <button type="button" className={secondary} disabled={!ready}
         onClick={()=>p.onMemberFilter(v.memberFilter,memberSearch)}>Find</button>
       </div>
      </label>
     </div>
     <ul className="divide-y divide-slate-200" aria-label="Member records">
      {v.members.map(m=>(
       <li key={m.userId} className="space-y-2 py-3">
        <p className="text-sm font-semibold">{m.email??m.userId}</p>
        <p className="text-xs text-slate-600">
         {m.userId} · {m.role} · {m.active?"Active":"Revoked"} · Revision {m.revision}
        </p>
        {m.active&&<div className="flex flex-wrap gap-2">
         <button type="button" className={secondary} disabled={!ready}
          onClick={()=>runSensitive("role:"+m.userId,()=>p.onRole(m.userId,
           m.role==="SALES_REP"?"SALES_MANAGER":"SALES_REP"))}>
          {confirmation==="role:"+m.userId?"Confirm role change":
           (m.role==="SALES_REP"?"Make sales manager":"Set sales rep")}
         </button>
         <button type="button" className={secondary} disabled={!ready}
          onClick={()=>runSensitive("revoke:"+m.userId,()=>p.onRevoke(m.userId))}>
          {confirmation==="revoke:"+m.userId?"Confirm member revocation":
           "Revoke access"}
         </button>
        </div>}
       </li>
      ))}
     </ul>
     {ready&&v.members.length===0&&
      <p className="py-3 text-sm text-slate-500">No matching members.</p>}
     {v.memberCursor&&ready&&
      <button type="button" className={secondary}
       onClick={()=>p.onMore("members")}>Load more members</button>}
    </section>
   </div>
   <section aria-label="Audit history" className={section}>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
     <h2 className="text-lg font-bold">Recent activity</h2>
     <label className="text-sm">Event type
      <select className={field} value={v.activityFilter}
       onChange={e=>p.onActivityFilter(e.target.value as P4R51Filter)}
       disabled={!ready}>
       {AUDIT_FILTERS.map(k=><option key={k} value={k}>{k}</option>)}
      </select>
     </label>
    </div>
    <ol className="divide-y divide-slate-200" aria-label="Audit events">
     {v.activity.map(e=>(
      <li key={e.eventId} className="flex flex-wrap justify-between gap-2 py-3">
       <div>
        <p className="text-sm font-semibold">{e.kind}</p>
        <p className="text-xs text-slate-600">{e.subjectId}</p>
       </div>
       <time dateTime={e.occurredAt} className="text-xs text-slate-500">
        {e.occurredAt}</time>
      </li>
     ))}
    </ol>
    {ready&&v.activity.length===0&&
     <p className="py-3 text-sm text-slate-500">No matching activity.</p>}
    {v.activityCursor&&ready&&
     <button type="button" className={secondary}
      onClick={()=>p.onMore("activity")}>Load more activity</button>}
   </section>
  </main>
 );
}

/** All interactions above are wired to a real CI-only injected controller. */
export function P4R53CiOwnerWorkspaceBound({
 controller,orgId,
}:Readonly<{controller:P4R53CiOwnerWorkspaceController;orgId:string}>){
 const [state,setState]=useState<P4R53CiWorkspaceSnapshot>(
  controller.snapshot());
 useEffect(()=>{
  let current=true;
  controller.reset();
  setState(controller.snapshot());
  void controller.refresh(orgId).then(s=>{if(current)setState(s);});
  return ()=>{current=false;controller.reset();};
 },[controller,orgId]);
 const call=(promise:Promise<P4R53CiWorkspaceSnapshot>)=>{
  setState(controller.snapshot());
  void promise.then(setState);
 };
 return <P4R53CiOwnerWorkspacePanel snapshot={state}
  onRefresh={()=>call(controller.refresh(orgId))}
  onInvite={email=>call(controller.issue(orgId,email))}
  onCancel={id=>call(controller.cancel(orgId,id))}
  onRenew={id=>call(controller.renew(orgId,id))}
  onRole={(userId,role)=>call(controller.changeRole(orgId,userId,role))}
  onRevoke={id=>call(controller.revokeMember(orgId,id))}
  onMore={category=>call(controller.more(orgId,category))}
  onMemberFilter={(memberFilter,memberSearch)=>
   call(controller.refresh(orgId,{memberFilter,memberSearch}))}
  onInvitationFilter={(invitationFilter,invitationSearch)=>
   call(controller.refresh(orgId,{invitationFilter,invitationSearch}))}
  onActivityFilter={activityFilter=>
   call(controller.refresh(orgId,{activityFilter}))}
 />;
}
