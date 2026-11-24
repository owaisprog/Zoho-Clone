/** R41 CI controller mirrors real HTTP outcome without credentials or caching. */
import type {P4R41CiMemberRoleClient} from "./p4-r41-ci-member-role-client";
import type {P4R41Member,P4R41Role} from "./p4-r41-ci-member-role-contract";
export type P4R41RoleView=Readonly<{
 phase:"idle"|"ready"|"changed"|"denied";
 members:readonly P4R41Member[];
 message:string;
}>;
const INITIAL:P4R41RoleView=Object.freeze({
 phase:"idle",members:Object.freeze([]),message:"CI-only role client inactive",
});
export class P4R41CiRoleController{
 private view:P4R41RoleView=INITIAL;
 constructor(private readonly api:Pick<P4R41CiMemberRoleClient,"members"|"change">){}
 snapshot():P4R41RoleView{return this.view;}
 async refresh(orgId:string):Promise<P4R41RoleView>{
  try{
   const members=await this.api.members(orgId);
   this.view=Object.freeze({phase:"ready",members,
    message:"Fictional members read from disposable PostgreSQL"});
  }catch{
   this.view=Object.freeze({phase:"denied" as const,members:Object.freeze([]),
    message:"Member list denied. No cached records retained."});
  }
  return this.view;
 }
 async change(orgId:string,userId:string,role:P4R41Role,revision:number):
 Promise<P4R41RoleView>{
  try{
   const updated=await this.api.change(orgId,userId,role,revision);
   this.view=Object.freeze({phase:"changed",
    members:Object.freeze(this.view.members.map(m=>
     m.userId===updated.userId?updated:m)),
    message:"Fictional role updated in disposable PostgreSQL"});
  }catch{
   this.view=Object.freeze({phase:"denied" as const,members:Object.freeze([]),
    message:"Role change denied. Refresh current membership before retrying."});
  }
  return this.view;
 }
 reset():void{this.view=INITIAL;}
}
