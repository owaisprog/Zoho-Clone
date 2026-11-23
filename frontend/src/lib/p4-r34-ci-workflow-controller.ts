/** R34 CI-only UI interaction model around the actual signed HTTP adapter.
 * Never caches recipient tokens or auth headers and has no browser storage.
 */
import type {SafeInvitationDraft} from "./p4-invitation-api-contract";
import type {P4RecipientAcceptance}
 from "./p4-invitation-acceptance-contract";
import type {P4R34CiHttpClient} from "./p4-r34-ci-http-client";
export type P4R34CiView=Readonly<{
 phase:"idle"|"issued"|"accepted"|"error";
 invitation:SafeInvitationDraft|null;
 acceptance:P4RecipientAcceptance|null;
 message:string;
}>;
const INITIAL:P4R34CiView=Object.freeze({
 phase:"idle",invitation:null,acceptance:null,message:"CI-only workflow not started",
});
export class P4R34CiWorkflowController{
 private view:P4R34CiView=INITIAL;
 constructor(private readonly api:Pick<P4R34CiHttpClient,"issue"|"accept">){}
 snapshot():P4R34CiView{return this.view;}
 async issue(orgId:string,email:string):Promise<P4R34CiView>{
  try{
   const invitation=await this.api.issue(orgId,email);
   this.view=Object.freeze({phase:"issued",invitation,acceptance:null,
    message:"Fictional invitation queued in disposable PostgreSQL"});
  }catch{
   this.view=Object.freeze({...this.view,phase:"error",
    message:"Demo invitation request denied"});
  }
  return this.view;
 }
 async accept(token:string):Promise<P4R34CiView>{
  try{
   const acceptance=await this.api.accept(token);
   this.view=Object.freeze({...this.view,phase:"accepted",acceptance,
    message:"Fictional organization membership activated"});
  }catch{
   this.view=Object.freeze({...this.view,phase:"error",
    message:"Demo recipient acceptance denied"});
  }
  return this.view;
 }
 reset():void{this.view=INITIAL;}
}
