/**
 * R56 one-time fictional recipient invitation acceptance.
 * Never persists or returns the token. Existing R30/R32 signed backend enforces
 * verified email binding, single-use, expiry, owner/member and tenant rules.
 */
import type {P4R34CiHttpClient} from "./p4-r34-ci-http-client";
export type P4R56RecipientView=Readonly<{
 phase:"idle"|"submitting"|"accepted"|"denied";
 accepted:boolean;membershipActivated:boolean;message:string;
}>;
const INITIAL:P4R56RecipientView=Object.freeze({
 phase:"idle",accepted:false,membershipActivated:false,
 message:"Fictional invitation awaiting recipient confirmation",
});
const TOKEN=/^[0-9a-f]{64}$/;
export class P4R56CiRecipientAcceptanceController{
 private epoch=0;
 private state:P4R56RecipientView=INITIAL;
 constructor(private readonly api:Pick<P4R34CiHttpClient,"accept">){}
 snapshot():P4R56RecipientView{return this.state;}
 private deny():P4R56RecipientView{
  this.state=Object.freeze({phase:"denied",accepted:false,
   membershipActivated:false,
   message:"This invitation cannot be accepted. Verify your invitation and signed-in account."});
  return this.state;
 }
 async submit(token:string):Promise<P4R56RecipientView>{
  if(this.state.phase==="submitting"||this.state.phase==="accepted")
   return this.state;
  if(typeof token!=="string"||!TOKEN.test(token))
   return this.deny();
  const request=++this.epoch;
  this.state=Object.freeze({phase:"submitting",accepted:false,
   membershipActivated:false,message:"Validating recipient-bound invitation"});
  try{
   const result=await this.api.accept(token);
   if(request!==this.epoch)return this.state;
   if(!result||result.accepted!==true||
    result.membershipActivated!==true)return this.deny();
   this.state=Object.freeze({phase:"accepted",accepted:true,
    membershipActivated:true,
    message:"Invitation accepted. Your fictional membership is active."});
  }catch{
   if(request===this.epoch)return this.deny();
  }
  return this.state;
 }
 reset():void{++this.epoch;this.state=INITIAL;}
}
