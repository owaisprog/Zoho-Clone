/** CI-only owner invitation renewal model; no stored JWT or invite token. */
import type {SafeInvitationDraft} from "./p4-invitation-api-contract";
import type {P4R34CiHttpClient} from "./p4-r34-ci-http-client";
export type P4R45RenewalView=Readonly<{
 phase:"idle"|"renewed"|"denied";
 invitation:SafeInvitationDraft|null;
 message:string;
}>;
const INITIAL:P4R45RenewalView=Object.freeze({
 phase:"idle",invitation:null,message:"No fictional invitation renewal attempted",
});
export class P4R45CiRenewalController{
 private state:P4R45RenewalView=INITIAL;
 constructor(private readonly api:Pick<P4R34CiHttpClient,"renew">){}
 snapshot():P4R45RenewalView{return this.state;}
 async renew(orgId:string,invitationId:string,expectedVersion:number):
  Promise<P4R45RenewalView>{
  try{
   const invitation=await this.api.renew(orgId,invitationId,expectedVersion);
   this.state=Object.freeze({phase:"renewed",invitation,
    message:"New fictional invitation queued in disposable CI PostgreSQL"});
  }catch{
   this.state=Object.freeze({phase:"denied",invitation:null,
    message:"Renewal denied; refresh latest invitation before retry"});
  }
  return this.state;
 }
 reset():void{this.state=INITIAL;}
}
