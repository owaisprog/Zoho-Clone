"use client";
import {useRef,useState} from "react";
import {isStageOrgId} from "@/lib/staging-membership";
import {buildTeamChange,parseTeamPage,type TeamGrant,type TeamChange,type TeamEditorTransport} from "@/lib/stage-team-editor";
type Scope={org:string;target:string};
type Pending={scope:Scope;command:TeamChange};
/** Unmounted until verified writer/MFA and server-side transport are approved. */
export function StagingTeamEditor({organizationId,transport}:{organizationId:string;transport:TeamEditorTransport}){
 const [target,setTarget]=useState(""),[rows,setRows]=useState<TeamGrant[]>([]);
 const [cursor,setCursor]=useState<string|null>(null),[loaded,setLoaded]=useState<Scope|null>(null);
 const [pending,setPending]=useState<Pending|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const running=useRef(false);
 const current=loaded?.org===organizationId&&loaded?.target===target;
 async function load(after:string|null){
  if(running.current||!isStageOrgId(organizationId)||!isStageOrgId(target)||pending)return;
  running.current=true;setBusy(true);setRows([]);setCursor(null);setLoaded(null);setMessage("");
  const scope={org:organizationId,target};
  try{const page=parseTeamPage(await transport.list(scope.org,scope.target,after),after);
   setRows(page.items);setCursor(page.nextCursor);setLoaded(scope);setMessage(page.items.length?"Existing unmanaged team grants loaded.":"No editable team grants.");
  }catch{setMessage("Team grants unavailable or access denied.");}
  finally{running.current=false;setBusy(false);}
 }
 async function change(next:Pending){
  if(running.current||next.scope.org!==organizationId||next.scope.target!==target)return;
  running.current=true;setBusy(true);setPending(next);setMessage("");
  try{
   const result=await transport.toggle(next.scope.org,next.scope.target,next.command);
   if(result==="applied"||result==="replay"||result==="denied"||result==="conflict"){
    setPending(null);setRows([]);setCursor(null);setLoaded(null);
    setMessage(result==="applied"||result==="replay"?"Change recorded. Reload grants.":"Change denied or conflicted. Reload grants.");
   }else setMessage("Outcome unavailable. Retry the exact same request.");
  }catch{setMessage("Outcome unavailable. Retry the exact same request.");}
  finally{running.current=false;setBusy(false);}
 }
 return <section className="rounded-lg border p-4 space-y-3">
  <h2 className="text-lg font-semibold">Team permissions</h2>
  <p>Only existing unmanaged team grants can be changed. No team creation, transfer or owner change.</p>
  <label htmlFor="stage-team-target">Member UUID</label>
  <input id="stage-team-target" className="block w-full rounded border p-2" value={target} maxLength={36} autoComplete="off"
   disabled={busy||pending!==null} onChange={e=>{setTarget(e.target.value);setRows([]);setLoaded(null);setCursor(null);setMessage("");}}/>
  <button type="button" disabled={busy||pending!==null||!isStageOrgId(target)} onClick={()=>void load(null)}>Load team grants</button>
  <ul>{current&&rows.map(row=><li key={row.teamId} className="flex flex-wrap items-center justify-between gap-3 py-2">
   <span>{row.teamId} · {row.active?"Active":"Inactive"} · revision {row.revision}</span>
   <button type="button" disabled={busy||pending!==null||row.revision>=1000000000} onClick={()=>void change({scope:{org:organizationId,target},command:buildTeamChange(row,crypto.randomUUID())})}>{row.active?"Deactivate":"Activate"}</button>
  </li>)}</ul>
  {current&&cursor&&<button type="button" disabled={busy||pending!==null} onClick={()=>void load(cursor)}>Next page</button>}
  {pending&&<button type="button" disabled={busy||pending.scope.org!==organizationId||pending.scope.target!==target} onClick={()=>void change(pending)}>Retry same request</button>}
  {pending&&pending.scope.org!==organizationId&&<p>Return to the original organization before retrying the pending request.</p>}
  <p role="status" aria-live="polite">{message}</p>
 </section>;
}
