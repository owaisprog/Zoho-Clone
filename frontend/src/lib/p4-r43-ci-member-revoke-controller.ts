/** P4 R43 no-cache CI-only revocation interaction, not a live UI. */
import type {P4R41CiMemberRoleClient}
 from "./p4-r41-ci-member-role-client";
export type P4R43RevokeView=Readonly<{
 phase:"idle"|"revoked"|"denied";message:string;
}>;
const INITIAL:P4R43RevokeView=Object.freeze({
 phase:"idle",message:"No member revocation attempted in disposable CI",
});
export class P4R43CiRevokeController{
 private state:P4R43RevokeView=INITIAL;
 constructor(private readonly client:Pick<P4R41CiMemberRoleClient,"revoke">){}
 snapshot():P4R43RevokeView{return this.state;}
 async revoke(orgId:string,userId:string):Promise<P4R43RevokeView>{
  try{
   const result=await this.client.revoke(orgId,userId);
   if(result.revoked!==true)throw Error("INVALID_RESPONSE");
   this.state=Object.freeze({phase:"revoked",
    message:"Fictional membership revoked in disposable CI PostgreSQL"});
  }catch{
   this.state=Object.freeze({phase:"denied",
    message:"Member revocation denied. Refresh membership before retrying."});
  }
  return this.state;
 }
 reset():void{this.state=INITIAL;}
}
