/**
 * R55 CI-only owner organization selection + signed live workspace orchestration.
 * No guessed tenant IDs, no tokens in state, no optimistic cross-org records.
 */
import type {P4R54CiOwnedOrganizationsClient,P4R54OwnedOrganization}
 from "./p4-r54-ci-owned-organizations-client";
import type {P4R53CiOwnerWorkspaceController,
 P4R53CiWorkspaceSnapshot} from "./p4-r53-ci-owner-workspace-controller";
import type {P4R41Role} from "./p4-r41-ci-member-role-contract";
import type {P4R44CiFilter} from "./p4-r44-ci-member-directory-contract";
import type {P4R47CiInviteFilter} from "./p4-r47-ci-invitation-directory-client";
import type {P4R51Filter} from "./p4-r51-ci-owner-activity-client";
type Filters={
 memberFilter?:P4R44CiFilter;memberSearch?:string;
 invitationFilter?:P4R47CiInviteFilter;invitationSearch?:string;
 activityFilter?:P4R51Filter;
};
export type P4R55CiSwitcherView=Readonly<{
 phase:"idle"|"loading"|"ready"|"denied";
 selectedId:string|null;organizations:readonly P4R54OwnedOrganization[];
 workspace:P4R53CiWorkspaceSnapshot;message:string;
}>;
export class P4R55CiOwnerOrgSwitcher{
 private epoch=0;
 private state:P4R55CiSwitcherView;
 constructor(
  private readonly owners:Pick<P4R54CiOwnedOrganizationsClient,"list">,
  private readonly workspace:P4R53CiOwnerWorkspaceController){
  this.state=Object.freeze({phase:"idle",selectedId:null,
   organizations:Object.freeze([]),workspace:workspace.snapshot(),
   message:"CI owner organizations inactive"});
 }
 snapshot():P4R55CiSwitcherView{return this.state;}
 private empty(message:string,phase:"loading"|"denied",
  organizations:readonly P4R54OwnedOrganization[]=[]):P4R55CiSwitcherView{
  this.workspace.reset();
  this.state=Object.freeze({phase,selectedId:null,
   organizations:phase==="denied"?Object.freeze([]):organizations,
   workspace:this.workspace.snapshot(),message});
  return this.state;
 }
 private fail():P4R55CiSwitcherView{
  ++this.epoch;
  return this.empty("Owner organization access denied; previous tenant data cleared",
   "denied");
 }
 private commit(org:string,organizations:readonly P4R54OwnedOrganization[],
  result:P4R53CiWorkspaceSnapshot):P4R55CiSwitcherView{
  if(result.phase!=="ready"||result.orgId!==org)return this.fail();
  this.state=Object.freeze({phase:"ready",selectedId:org,
   organizations,message:"Verified owner organization selected",
   workspace:result});
  return this.state;
 }
 async discover(preferredId?:string):Promise<P4R55CiSwitcherView>{
  const seq=++this.epoch;
  this.empty("Checking signed organization ownership","loading");
  try{
   const organizations=await this.owners.list();
   if(seq!==this.epoch)return this.state;
   if(organizations.length===0)return this.fail();
   const chosen=organizations.find(x=>x.id===preferredId)??organizations[0]!;
   const result=await this.workspace.refresh(chosen.id);
   if(seq!==this.epoch)return this.state;
   return this.commit(chosen.id,organizations,result);
  }catch{if(seq===this.epoch)return this.fail();}
  return this.state;
 }
 async select(org:string):Promise<P4R55CiSwitcherView>{
  if(this.state.phase!=="ready")return this.state;
  const organizations=this.state.organizations;
  if(!organizations.some(x=>x.id===org))return this.fail();
  if(this.state.selectedId===org)return this.state;
  const seq=++this.epoch;
  this.empty("Switching organization and clearing previous records","loading",
   organizations);
  try{
   const result=await this.workspace.refresh(org);
   if(seq!==this.epoch)return this.state;
   return this.commit(org,organizations,result);
  }catch{if(seq===this.epoch)return this.fail();}
  return this.state;
 }
 async refresh(filters:Filters={}):Promise<P4R55CiSwitcherView>{
  if(this.state.phase!=="ready"||!this.state.selectedId)
   return this.fail();
  const org=this.state.selectedId,seq=++this.epoch;
  this.state=Object.freeze({...this.state,phase:"loading",
   workspace:{...this.state.workspace,phase:"loading",
    counts:null,members:Object.freeze([]),invitations:Object.freeze([]),
    activity:Object.freeze([])}});
  try{
   const owners=await this.owners.list();
   if(seq!==this.epoch)return this.state;
   if(!owners.some(x=>x.id===org))return this.fail();
   const result=await this.workspace.refresh(org,filters);
   if(seq!==this.epoch)return this.state;
   return this.commit(org,owners,result);
  }catch{if(seq===this.epoch)return this.fail();}
  return this.state;
 }
 private async mutate(fn:(org:string)=>Promise<P4R53CiWorkspaceSnapshot>):
  Promise<P4R55CiSwitcherView>{
  if(this.state.phase!=="ready"||!this.state.selectedId)return this.fail();
  const org=this.state.selectedId,seq=++this.epoch;
  this.state=Object.freeze({...this.state,phase:"loading",
   workspace:{...this.state.workspace,phase:"loading",counts:null,
    members:Object.freeze([]),invitations:Object.freeze([]),
    activity:Object.freeze([])}});
  try{
   const result=await fn(org);
   if(seq!==this.epoch)return this.state;
   const owners=await this.owners.list();
   if(seq!==this.epoch)return this.state;
   if(!owners.some(x=>x.id===org))return this.fail();
   return this.commit(org,owners,result);
  }catch{if(seq===this.epoch)return this.fail();}
  return this.state;
 }
 issue(email:string):Promise<P4R55CiSwitcherView>{
  return this.mutate(org=>this.workspace.issue(org,email));
 }
 cancel(id:string):Promise<P4R55CiSwitcherView>{
  return this.mutate(org=>this.workspace.cancel(org,id));
 }
 renew(id:string):Promise<P4R55CiSwitcherView>{
  return this.mutate(org=>this.workspace.renew(org,id));
 }
 changeRole(userId:string,role:P4R41Role):Promise<P4R55CiSwitcherView>{
  return this.mutate(org=>this.workspace.changeRole(org,userId,role));
 }
 revokeMember(userId:string):Promise<P4R55CiSwitcherView>{
  return this.mutate(org=>this.workspace.revokeMember(org,userId));
 }
 more(category:"members"|"invitations"|"activity"):Promise<P4R55CiSwitcherView>{
  return this.mutate(org=>this.workspace.more(org,category));
 }
 reset():void{
  ++this.epoch;
  this.empty("CI owner organization selection cleared","denied");
 }
}
