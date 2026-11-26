"use client";
import {useState} from "react";
import {isStageOrgId} from "@/lib/staging-membership";
import {buildRoleChange,type SalesGrant,type RoleEditorTransport,type RoleChange} from "@/lib/stage-role-editor";
/** Unmounted until verified identity, MFA and restricted writer activation are approved.
 * Transport is injected by a future server-bound composition, never a browser token. */
export function StagingRoleEditor({organizationId,transport}:{organizationId:string;transport:RoleEditorTransport}){
 const [target,setTarget]=useState(""),[rows,setRows]=useState<SalesGrant[]>([]);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const [pending,setPending]=useState<RoleChange|null>(null);
 const [loadedOrg,setLoadedOrg]=useState("");
 async function load(){
  if(!isStageOrgId(organizationId)||!isStageOrgId(target))return;
  setBusy(true);setRows([]);setPending(null);setMessage("");setLoadedOrg(organizationId);
  try{setRows(await transport.list(organizationId,target));setMessage("Existing sales grants loaded.");}
  catch{setMessage("Grants unavailable or access denied.");}finally{setBusy(false);}
 }
 async function change(command:RoleChange){
  if(loadedOrg!==organizationId)return;
  setBusy(true);setPending(command);setMessage("");
  try{
   const result=await transport.toggle(organizationId,target,command);
   if(result==="applied"||result==="replay"){
    setPending(null);setRows([]);setMessage("Change recorded. Reload grants to see current state.");
   }else if(result==="conflict"||result==="denied"){
    setPending(null);setRows([]);setMessage("Change not applied. Reload grants.");
   }else setMessage("Outcome unavailable. Retry the same request or reload.");
  }catch{setMessage("Outcome unavailable. Retry the same request or reload.");}
  finally{setBusy(false);}
 }
 return <section className="rounded-lg border p-4 space-y-3">
  <h2 className="text-lg font-semibold">Sales role permissions</h2>
  <p>Existing grants only. Owner changes and new grants are not supported.</p>
  <label htmlFor="stage-grant-target">Member UUID</label>
  <input id="stage-grant-target" className="block w-full rounded border p-2" value={target} disabled={busy||pending!==null}
   onChange={e=>{setTarget(e.target.value);setRows([]);setMessage("");}} maxLength={36} autoComplete="off"/>
  <button type="button" disabled={busy||!isStageOrgId(target)} onClick={()=>void load()}>Load grants</button>
  <ul>{rows.map(row=><li key={row.role} className="flex items-center justify-between gap-3 py-2">
   <span>{row.role==="SALES_REP"?"Sales representative":"Sales manager"} · {row.active?"Active":"Inactive"} · revision {row.revision}</span>
   <button type="button" disabled={busy||loadedOrg!==organizationId||pending!==null||row.revision>=1000000000} onClick={()=>void change(buildRoleChange(row,crypto.randomUUID()))}>{row.active?"Deactivate":"Activate"}</button>
  </li>)}</ul>
  {pending&&<button type="button" disabled={busy||loadedOrg!==organizationId} onClick={()=>void change(pending)}>Retry same request</button>}
  <p role="status" aria-live="polite">{message}</p>
 </section>;
}
