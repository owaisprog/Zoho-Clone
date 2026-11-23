"use client";

import {useState,type FormEvent} from "react";
import {
 INITIAL_SANDBOX,addSandboxOrganization,selectSandboxOrganization,
 addSandboxInvitation,resolveSandboxInvitation,revokeSandboxMember,
 displayedSandboxStatus,SandboxWorkflowError,type SandboxState,
 type SandboxResult,
} from "@/lib/p4-functional-workflow";
import {suggestFictionalSlug} from "@/lib/p4-organization-preview";

const initialNow=()=>Date.now();
export function P4FunctionalWorkspace(){
 const [state,setState]=useState<SandboxState>(INITIAL_SANDBOX);
 const [name,setName]=useState("Demo Maple Payments");
 const [slug,setSlug]=useState("demo-maple-payments");
 const [email,setEmail]=useState("new.member@example.com");
 const [message,setMessage]=useState("Create a fictional organization to begin.");
 const [error,setError]=useState(false);
 const selected=state.organizations.find(o=>o.id===state.selectedId);
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
     <div className="p4-invite-info">
      <strong>Members</strong>
      <div className="p4-functional-records">
       {selected.members.map(m=><div className="p4-functional-record" key={m.email}>
        <span><strong>{m.email}</strong><small>{m.role} · {m.active?"Active":"Revoked"}</small></span>
        {m.role!=="ORG_OWNER"&&m.active&&<button type="button"
          className="p4-button" onClick={()=>run(s=>revokeSandboxMember(s,m.email))}>
          Revoke member
         </button>}
       </div>)}
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
      <strong>Invitations</strong>
      <div className="p4-functional-records">
       {selected.invitations.length===0&&<p>No invitations in this workspace.</p>}
       {selected.invitations.map(inv=>{
        const status=displayedSandboxStatus(inv,initialNow());
        return <div className="p4-functional-record" key={inv.id}>
         <span><strong>{inv.email}</strong>
          <small>{status} · expires {new Date(inv.expiresAt).toLocaleDateString()}</small></span>
         {status==="pending"&&<div className="p4-actions">
          <button type="button" className="p4-button p4-button-primary"
           onClick={()=>run(s=>resolveSandboxInvitation(s,inv.id,"accept",initialNow()))}>
           Simulate accept
          </button>
          <button type="button" className="p4-button"
           onClick={()=>run(s=>resolveSandboxInvitation(s,inv.id,"revoke",initialNow()))}>
           Revoke
          </button>
         </div>}
        </div>;
       })}
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
