/** R42 isolated owner-side history read model: no token or caching. */
import type {P4R42RoleHistory} from "./p4-r42-ci-role-history-contract";
import type {P4R41CiMemberRoleClient}
 from "./p4-r41-ci-member-role-client";
export type P4R42HistoryView=Readonly<{
 phase:"idle"|"ready"|"denied";
 entries:readonly P4R42RoleHistory[];
 message:string;
}>;
const INITIAL:P4R42HistoryView=Object.freeze({
 phase:"idle",entries:Object.freeze([]),
 message:"Role history unavailable outside disposable CI",
});
export class P4R42CiHistoryController{
 private view:P4R42HistoryView=INITIAL;
 constructor(private readonly api:Pick<P4R41CiMemberRoleClient,"history">){}
 snapshot():P4R42HistoryView{return this.view;}
 async refresh(orgId:string):Promise<P4R42HistoryView>{
  try{
   const entries=await this.api.history(orgId);
   this.view=Object.freeze({phase:"ready",entries,
    message:"Fictional role history read from disposable CI PostgreSQL"});
  }catch{
   this.view=Object.freeze({phase:"denied",
    entries:Object.freeze([]),message:"Role history denied and cleared"});
  }
  return this.view;
 }
 reset():void{this.view=INITIAL;}
}
