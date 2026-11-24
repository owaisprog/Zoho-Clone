"use client";

import {useState,type FormEvent} from "react";
import {
 INITIAL_SANDBOX,addSandboxOrganization,selectSandboxOrganization,
 addSandboxInvitation,resolveSandboxInvitation,renewSandboxInvitation,revokeSandboxMember,
 displayedSandboxStatus,summarizeSandboxInvitations,
 getRecipientSandboxInbox,acceptSandboxInvitationAsRecipient,
 getSandboxMemberDirectory,listSandboxRoleChanges,changeSandboxMemberRole,
 SandboxWorkflowError,type SandboxState,type SandboxResult,
} from "@/lib/p4-functional-workflow";
import {suggestFictionalSlug} from "@/lib/p4-organization-preview";

const initialNow=()=>Date.now();
export function P4FunctionalWorkspace(){
 const [state,setState]=useState<SandboxState>(INITIAL_SANDBOX);
 const [name,setName]=useState("Demo Maple Payments");
 const [slug,setSlug]=useState("demo-maple-payments");
 const [email,setEmail]=useState("new.member@example.com");
 const [recipientEmail,setRecipientEmail]=useState("new.member@example.com");
 const [filter,setFilter]=useState<"all"|"pending"|"accepted"|"revoked"|"expired">("all");
 const [memberQuery,setMemberQuery]=useState("");
 const [memberStatus,setMemberStatus]=useState<"all"|"active"|"revoked">("all");
 const [message,setMessage]=useState("Create a fictional organization to begin.");
 const [error,setError]=useState(false);
 const selected=state.organizations.find(o=>o.id===state.selectedId);
 const summary=selected?summarizeSandboxInvitations(state,Date.now()):null;
 const roleHistory=selected?listSandboxRoleChanges(state):[];
 const visibleMembers=selected?getSandboxMemberDirectory(state,memberQuery,memberStatus):[];
 let inbox:ReturnType<typeof getRecipientSandboxInbox>=[];
 if(selected){
  try{inbox=getRecipientSandboxInbox(state,recipientEmail,Date.now());}
  catch{/* invalid typed address simply shows no inbox items */}
 }
 function run(fn:(value:SandboxState)=>SandboxResult){
  try{
   // All events originate in this tab. No backend calls and no persistence.
   const result=fn(state);
   setState(result.state);setMessage(result.detail);setError(false);
  }catch(e){
   const code=e instanceof SandboxWorkflowError?e.code:"INVALID_STATE";
   const messages={
    INVALID_INPUT:"Check the demo-only name, slug, recipient or date.",
    CONFLICT:"That fictional workspace or pending invitation already exists.",
    NOT_FOUND:"This fictional item is no longer available.",
    FORBIDDEN:"The demonstration owner cannot be removed.",
    INVALID_STATE:"That operation is not allowed in the current state.",
   };
   setMessage(messages[code]);setError(true);
  }
 }
 function create(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  run(s=>addSandboxOrganization(s,name,slug));
 }
 function invite(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  run(s=>addSandboxInvitation(s,email,initialNow()));
 }
 return (
  <div className="p4-functional-layout">
   <section className="p4-panel">
    <span className="p4-eyebrow">Step 1 · create and switch</span>
    <h2>Demo organizations</h2>
    <p>Create up to five fictional workspaces with an owner membership. Choose one to manage its own members and invitations.</p>
    <form className="p4-form" onSubmit={create}>
     <div className="p4-form-row">
      <label htmlFor="p4-functional-name">Demo company name</label>
      <input id="p4-functional-name" maxLength={64} value={name} onChange={e=>{
       const value=e.target.value;setName(value);setSlug(suggestFictionalSlug(value));
      }}/>
     </div>
     <div className="p4-form-row">
      <label htmlFor="p4-functional-slug">Workspace slug</label>
      <input id="p4-functional-slug" maxLength={48} value={slug}
       onChange={e=>setSlug(e.target.value)}/>
     </div>
     <button className="p4-button p4-button-primary" type="submit">Create demo workspace</button>
    </form>
    <div className="p4-workspace-list" role="group" aria-label="Browser-memory workspaces">
     {state.organizations.map(org=><button type="button" key={org.id}
      className={"p4-workspace-choice"+(selected?.id===org.id?" selected":"")}
      aria-pressed={selected?.id===org.id}
      onClick={()=>run(s=>selectSandboxOrganization(s,org.id))}>
      <span><strong>{org.name}</strong><small>{org.slug}</small></span>
      <span className="p4-role">{selected?.id===org.id?"Selected":"Select"}</span>
     </button>)}
    </div>
   </section>
   <section className="p4-panel">
    <span className="p4-eyebrow">Step 2 · membership and invitation lifecycle</span>
    <h2>{selected?.name??"Select a workspace"}</h2>
    <p>Actions below modify actual in-tab demo state. All identities use example.com; there are no authentication tokens or emails.</p>
    {selected?<>
     <div className="p4-invite-info" aria-label="Fictional invitation status summary">
      <strong>Invitation status overview</strong>
      <div className="p4-r37-stats">
       <span>Pending <b>{summary?.pending??0}</b></span>
       <span>Accepted <b>{summary?.accepted??0}</b></span>
       <span>Revoked <b>{summary?.revoked??0}</b></span>
       <span>Expired <b>{summary?.expired??0}</b></span>
       <span>Active members <b>{summary?.activeMembers??0}</b></span>
      </div>
     </div>
     <div className="p4-invite-info">
      <strong>Members</strong>
      <p>Accepting a fresh invitation after revocation restores the same fictional membership row rather than duplicating it.</p>
      <div className="p4-r39-member-tools" role="group" aria-label="Fictional member filters">
       <div className="p4-form-row">
        <label htmlFor="p4-r39-member-search">Search members by email or role</label>
        <input id="p4-r39-member-search" type="search" maxLength={64}
         value={memberQuery} onChange={e=>setMemberQuery(e.target.value)}/>
       </div>
       <div className="p4-form-row">
        <label htmlFor="p4-r39-member-filter">Membership status</label>
        <select id="p4-r39-member-filter" value={memberStatus}
         onChange={e=>setMemberStatus(e.target.value as typeof memberStatus)}>
         <option value="all">All members</option>
         <option value="active">Active</option>
         <option value="revoked">Revoked</option>
        </select>
       </div>
      </div>
      <div className="p4-functional-records" aria-label="Fictional member directory">
       {visibleMembers.length===0&&<p>No matching fictional members.</p>}
       {visibleMembers.map(m=><div className="p4-functional-record" key={m.email}>
        <span><strong>{m.email}</strong><small>{m.role} · {m.active?"Active":"Revoked"}</small></span>
        {m.role!=="ORG_OWNER"&&m.active&&<div className="p4-actions p4-r39-member-actions">
         <label>
          Demo role
          <select aria-label={"Fictional role for "+m.email} value={m.role}
           onChange={e=>run(s=>changeSandboxMemberRole(s,m.email,e.target.value,initialNow()))}>
           <option value="SALES_REP">Sales rep</option>
           <option value="SALES_MANAGER">Sales manager</option>
          </select>
         </label>
         <button type="button" className="p4-button"
          onClick={()=>run(s=>revokeSandboxMember(s,m.email))}>Revoke member</button>
        </div>}
       </div>)}
      </div>
      <div className="p4-r39-history" aria-label="Fictional role change history">
       <strong>Role change history · in this tab only</strong>
       <p>These events are a demo timeline, not a trusted audit log. Changing a role here grants no real app or tenant permissions.</p>
       {roleHistory.length===0?<p>No fictional role changes yet.</p>:
        <ol>{roleHistory.map(change=><li key={change.id}>
         <span>{change.email}: {change.fromRole} → {change.toRole}</span>
         <small>{new Date(change.occurredAt).toLocaleString()}</small>
        </li>)}</ol>}
      </div>
     </div>
     <form className="p4-form" onSubmit={invite}>
      <div className="p4-form-row">
       <label htmlFor="p4-functional-invite">Invite demo sales rep</label>
       <input id="p4-functional-invite" value={email} type="email" autoComplete="off"
        onChange={e=>setEmail(e.target.value)} placeholder="new.member@example.com"/>
       <small>Restricted to @example.com. No invitation will be delivered.</small>
      </div>
      <button className="p4-button p4-button-primary" type="submit">Create pending demo invitation</button>
     </form>
     <div className="p4-invite-info">
      <strong>Owner invitation management</strong>
      <p>Expired or revoked demo invitations can be renewed for seven days. This creates a new fictional invitation in the tab and never sends an email.</p>
      <div className="p4-r37-filter">
       <label htmlFor="p4-r37-status-filter">Filter by status</label>
       <select id="p4-r37-status-filter" value={filter}
        onChange={e=>setFilter(e.target.value as typeof filter)}>
        <option value="all">All invitations</option>
        <option value="pending">Pending</option>
        <option value="accepted">Accepted</option>
        <option value="revoked">Revoked</option>
        <option value="expired">Expired</option>
       </select>
      </div>
      <div className="p4-functional-records">
       {selected.invitations.length===0&&<p>No invitations in this workspace.</p>}
       {selected.invitations.filter(i=>filter==="all"||
        displayedSandboxStatus(i,Date.now())===filter).map(inv=>{
        const status=displayedSandboxStatus(inv,initialNow());
        return <div className="p4-functional-record" key={inv.id}>
         <span><strong>{inv.email}</strong>
          <small>{status} · expires {new Date(inv.expiresAt).toLocaleDateString()}</small></span>
         {status==="pending"&&<div className="p4-actions">
          <button type="button" className="p4-button"
           onClick={()=>run(s=>resolveSandboxInvitation(s,inv.id,"revoke",initialNow()))}>
           Revoke
          </button>
         </div>}
         {(status==="revoked"||status==="expired")&&
          <button type="button" className="p4-button p4-r38-renew"
           onClick={()=>run(s=>renewSandboxInvitation(s,inv.id,initialNow()))}>
           Renew demo invitation
          </button>}
        </div>;
       })}
      </div>
     </div>
     <div className="p4-invite-info">
      <strong>Recipient perspective · fictional inbox</strong>
      <p>Type the exact example.com email of a fictional invited recipient to preview their inbox. This is not a login or identity check.</p>
      <div className="p4-form-row">
       <label htmlFor="p4-r37-recipient">Fictional recipient email</label>
       <input id="p4-r37-recipient" type="email" autoComplete="off"
        value={recipientEmail} onChange={e=>setRecipientEmail(e.target.value)}
        placeholder="new.member@example.com"/>
      </div>
      <div className="p4-functional-records" aria-label="Selected fictional recipient inbox">
       {inbox.length===0&&<p>No fictional invitations for this address in the selected workspace.</p>}
       {inbox.map(inv=><div className="p4-functional-record" key={inv.id}>
        <span><strong>{inv.email}</strong>
         <small>{inv.displayedStatus} · {inv.role} (demo)</small></span>
        {inv.displayedStatus==="pending"&&<button type="button"
         className="p4-button p4-button-primary"
         onClick={()=>run(s=>acceptSandboxInvitationAsRecipient(
          s,inv.id,recipientEmail,initialNow()))}>
         Simulate recipient acceptance
        </button>}
       </div>)}
      </div>
     </div>
    </>:<div className="p4-alert"><strong>No demo workspace yet</strong>
     <span>Create one using the form to begin the complete in-tab flow.</span></div>}
   </section>
   <div className="p4-alert p4-functional-notice" role="status" aria-live="polite">
    <strong>{error?"Action denied":"Workflow status"}</strong>
    <span>{message} Revision {state.revision}. Refreshing resets all fictional workspaces.</span>
   </div>
  </div>
 );
}
