"use client";
import {useState,type FormEvent} from "react";
type Result={status:string;membershipRole?:string;applicationAccess:false};
export function StagingMembershipCheck(){
 const [org,setOrg]=useState(""),[result,setResult]=useState<Result|null>(null),[busy,setBusy]=useState(false);
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setBusy(true);setResult(null);
  try{
   const r=await fetch("/api/platform/staging-membership?organizationId="+encodeURIComponent(org),{
    headers:{"X-P4-Membership-Check":"1"},cache:"no-store",redirect:"error",signal:AbortSignal.timeout(8000)});
   const x=await r.json() as Result;
   setResult(x.applicationAccess===false&&["verified","disabled","denied","unavailable","unauthenticated"].includes(x.status)?x:{status:"unavailable",applicationAccess:false});
  }catch{setResult({status:"unavailable",applicationAccess:false});}finally{setBusy(false);}
 }
 return <section style={{marginTop:24,padding:20,border:"1px solid currentColor",borderRadius:8}}>
  <h2>Staging organization membership</h2>
  <p>Enter a fictional organization UUID to check active membership. CRM access remains disabled.</p>
  <form onSubmit={submit}>
   <label htmlFor="stage-org-id">Organization UUID</label>
   <input id="stage-org-id" value={org} onChange={e=>{setOrg(e.target.value);setResult(null);}} disabled={busy}
    required maxLength={36} pattern="[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}" autoComplete="off" style={{display:"block",width:"100%",padding:8,margin:"8px 0"}}/>
   <button type="submit" disabled={busy}>{busy?"Checking…":"Check membership"}</button>
  </form>
  <p role="status" aria-live="polite">{result?.status==="verified"?
   "Membership verified: "+(result.membershipRole==="OWNER"?"Owner":"Member")+". No application access.":
   result?.status==="denied"?"Membership denied.":result?.status==="unauthenticated"?"Sign in again to verify membership.":
   result?"Staging membership verification is unavailable.":""}</p>
 </section>;
}
