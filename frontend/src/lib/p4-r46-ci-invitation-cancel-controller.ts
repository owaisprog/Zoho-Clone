/** P4 R46 CI interaction: cancel and clear stale invitation on failure. */
import type {SafeInvitationDraft} from "./p4-invitation-api-contract";
import type {P4R34CiHttpClient} from "./p4-r34-ci-http-client";
export type P4R46CancelView=Readonly<{
 phase:"idle"|"canceled"|"denied";
 invitation:SafeInvitationDraft|null;
 message:string;
}>;
const INITIAL:P4R46CancelView=Object.freeze({
 phase:"idle",invitation:null,message:"No fictional cancellation requested",
});
export class P4R46CiCancelController{
 private state:P4R46CancelView=INITIAL;
 constructor(private readonly api:Pick<P4R34CiHttpClient,"cancel">){}
 snapshot():P4R46CancelView{return this.state;}
 async cancel(orgId:string,id:string,version:number):Promise<P4R46CancelView>{
  try{
   const invitation=await this.api.cancel(orgId,id,version);
   this.state=Object.freeze({phase:"canceled",invitation,
    message:"Fictional invitation canceled and queued delivery invalidated"});
  }catch{
   this.state=Object.freeze({phase:"denied",invitation:null,
    message:"Cancellation denied; refresh invitation before retry"});
  }
  return this.state;
 }
 reset():void{this.state=INITIAL;}
}
