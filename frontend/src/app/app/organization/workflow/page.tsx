import Link from "next/link";
import {ArrowLeft,ShieldCheck} from "lucide-react";
import {P4FunctionalWorkspace} from "@/components/p4-functional-workspace";

export default function FunctionalSandboxPage(){
 return <>
  <div className="page-header">
   <div><span className="eyebrow">P4 R27 · functional feature sandbox</span>
    <h1>Organization & membership workflow</h1>
    <p>Create a demo workspace, switch tenants, invite a fictional member, simulate acceptance and revoke access.</p>
   </div>
   <Link href="/app/organization/memberships" className="btn">
    <ArrowLeft size={16} aria-hidden="true"/> Back to memberships
   </Link>
  </div>
  <div className="demo-banner" role="note">
   <ShieldCheck size={18} aria-hidden="true"/>
   <div><strong>Working browser-memory prototype, not a live account.</strong>
    <span>Changes are real within this tab and disappear on refresh. No authentication, database, email, invite redemption, or production permissions are connected.</span>
   </div>
  </div>
  <P4FunctionalWorkspace/>
 </>;
}
