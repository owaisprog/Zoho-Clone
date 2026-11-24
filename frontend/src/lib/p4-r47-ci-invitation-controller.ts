/**
 * R47 CI-only owner invitation workspace, using real signed HTTP persistence.
 * No browser app mount or tokens retained. All post-write states refresh from
 * actual disposable PostgreSQL, never optimistic fake member transitions.
 */
import type {SafeInvitationDraft} from "./p4-invitation-api-contract";
import type {P4R34CiHttpClient} from "./p4-r34-ci-http-client";
import type {P4R47CiInvitationDirectoryClient,P4R47CiInviteFilter}
 from "./p4-r47-ci-invitation-directory-client";
export type P4R47CiInvitationView=Readonly<{
 phase:"idle"|"ready"|"updated"|"denied";
 filter:P4R47CiInviteFilter;
 search:string;
 invitations:readonly SafeInvitationDraft[];
 message:string;
}>;
const INITIAL:P4R47CiInvitationView=Object.freeze({
 phase:"idle",filter:"all",search:"",
 invitations:Object.freeze([]),message:"CI-only owner invitation directory inactive",
});
export class P4R47CiInvitationController{
 private state:P4R47CiInvitationView=INITIAL;
 constructor(
  private readonly directory:Pick<P4R47CiInvitationDirectoryClient,"list">,
  private readonly actions:Pick<P4R34CiHttpClient,"issue"|"renew"|"cancel">,
 ){}
 snapshot():P4R47CiInvitationView{return this.state;}
 private deny():P4R47CiInvitationView{
  this.state=Object.freeze({...this.state,phase:"denied",
   invitations:Object.freeze([]),
   message:"Invitation action or refresh denied; old data cleared"});
  return this.state;
 }
 private async reload(orgId:string,updated:boolean):Promise<P4R47CiInvitationView>{
  const {filter,search}=this.state;
  try{
   const invitations=await this.directory.list(orgId,filter,search);
   this.state=Object.freeze({phase:updated?"updated":"ready",
    filter,search,invitations,
    message:"Fictional invitations read from disposable PostgreSQL"});
   return this.state;
  }catch{return this.deny();}
 }
 async refresh(orgId:string,filter:P4R47CiInviteFilter,search:string):
  Promise<P4R47CiInvitationView>{
  this.state=Object.freeze({phase:"idle",filter,search,
   invitations:Object.freeze([]),message:"Refreshing CI invitation records"});
  return this.reload(orgId,false);
 }
 async issue(orgId:string,email:string):Promise<P4R47CiInvitationView>{
  try{await this.actions.issue(orgId,email);}
  catch{return this.deny();}
  return this.reload(orgId,true);
 }
 async renew(orgId:string,id:string,version:number):
  Promise<P4R47CiInvitationView>{
  try{await this.actions.renew(orgId,id,version);}
  catch{return this.deny();}
  return this.reload(orgId,true);
 }
 async cancel(orgId:string,id:string,version:number):
  Promise<P4R47CiInvitationView>{
  try{await this.actions.cancel(orgId,id,version);}
  catch{return this.deny();}
  return this.reload(orgId,true);
 }
 reset():void{this.state=INITIAL;}
}
