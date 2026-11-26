"use client";
import {useRef,useState} from "react";
import {StagingRoleEditor} from "./staging-role-editor";
import {StagingTeamEditor} from "./staging-team-editor";
import type {PermissionWorkspaceTransport} from "@/lib/stage-permission-workspace";
import type {OrganizationItem} from "@/lib/staging-organization-directory";
/** Used by the isolated browser harness only until real staging write approval. */
export function StagingPermissionWorkspace({transport}:{transport:PermissionWorkspaceTransport}){
 const [items,setItems]=useState<OrganizationItem[]>([]),[cursor,setCursor]=useState<string|null>(null);
 const [selected,setSelected]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const running=useRef(false);
 const organization=items.find(item=>item.organizationId===selected);
 async function load(after:string|null){
  if(running.current)return;
  running.current=true;setBusy(true);setItems([]);setSelected("");setCursor(null);setMessage("");
  try{const page=await transport.directory(after);setItems(page.items);setCursor(page.nextCursor);setMessage(page.items.length?"Active organizations loaded.":"No active organizations.");}
  catch{setMessage("Organization access unavailable.");}
  finally{running.current=false;setBusy(false);}
 }
 return <main className="mx-auto max-w-4xl space-y-4 p-6">
  <h1>Organization permission workspace</h1>
  <p>Fictional data only. CRM access is disabled.</p>
  <button type="button" disabled={busy} onClick={()=>void load(null)}>Refresh organizations</button>
  <label htmlFor="permission-org">Organization</label>
  <select id="permission-org" disabled={busy} value={selected} onChange={e=>setSelected(e.target.value)}>
   <option value="">Choose organization</option>
   {items.map(item=><option key={item.organizationId} value={item.organizationId}>{item.organizationId} — {item.membershipRole}</option>)}
  </select>
  {cursor&&<button type="button" disabled={busy} onClick={()=>void load(cursor)}>Next organizations</button>}
  <p role="status">{message}</p>
  {organization?.membershipRole==="OWNER"&&<div key={selected}>
   <StagingRoleEditor organizationId={selected} transport={transport.roles}/>
   <StagingTeamEditor organizationId={selected} transport={transport.teams}/>
  </div>}
  {organization?.membershipRole==="MEMBER"&&<p>Permission management unavailable for members.</p>}
 </main>;
}
