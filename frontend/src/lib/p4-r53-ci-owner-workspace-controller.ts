/**
 * P4 R53: CI-only unified owner workspace over actual signed localhost APIs.
 * Never imported by production routes. Strict typed clients own token checks.
 * This model stores no token, identity-provider subject, ciphertext or audit PII.
 */
import type {P4R50OwnerCounts,P4R50CiOwnerSummaryClient}
 from "./p4-r50-ci-owner-summary-client";
import type {P4R48CiInvitationPageClient}
 from "./p4-r48-ci-invitation-page-client";
import type {P4R49CiMemberPageClient}
 from "./p4-r49-ci-member-page-client";
import type {P4R52CiActivityPageClient}
 from "./p4-r52-ci-activity-page-client";
import type {P4R34CiHttpClient}
 from "./p4-r34-ci-http-client";
import type {P4R41CiMemberRoleClient}
 from "./p4-r41-ci-member-role-client";
import type {SafeInvitationDraft} from "./p4-invitation-api-contract";
import type {P4R44CiDirectoryMember,P4R44CiFilter}
 from "./p4-r44-ci-member-directory-contract";
import type {P4R47CiInviteFilter}
 from "./p4-r47-ci-invitation-directory-client";
import type {P4R51Event,P4R51Filter}
 from "./p4-r51-ci-owner-activity-client";
import type {P4R41Role} from "./p4-r41-ci-member-role-contract";

export type P4R53CiWorkspaceSnapshot=Readonly<{
 phase:"idle"|"loading"|"ready"|"denied";
 orgId:string|null;
 counts:P4R50OwnerCounts|null;
 members:readonly P4R44CiDirectoryMember[];
 memberCursor:string|null;memberFilter:P4R44CiFilter;memberSearch:string;
 invitations:readonly SafeInvitationDraft[];
 invitationCursor:string|null;invitationFilter:P4R47CiInviteFilter;
 invitationSearch:string;
 activity:readonly P4R51Event[];
 activityCursor:string|null;activityFilter:P4R51Filter;
 message:string;
}>;
type Filters=Pick<P4R53CiWorkspaceSnapshot,
 "memberFilter"|"memberSearch"|"invitationFilter"|
 "invitationSearch"|"activityFilter">;
const EMPTY:P4R53CiWorkspaceSnapshot=Object.freeze({
 phase:"idle",orgId:null,counts:null,
 members:Object.freeze([]),memberCursor:null,memberFilter:"all",memberSearch:"",
 invitations:Object.freeze([]),invitationCursor:null,
 invitationFilter:"all",invitationSearch:"",
 activity:Object.freeze([]),activityCursor:null,activityFilter:"all",
 message:"Fictional CI owner workspace inactive",
});
export type P4R53CiWorkspaceDependencies=Readonly<{
 summary:Pick<P4R50CiOwnerSummaryClient,"summary">;
 members:Pick<P4R49CiMemberPageClient,"page">;
 invitations:Pick<P4R48CiInvitationPageClient,"page">;
 activity:Pick<P4R52CiActivityPageClient,"page">;
 actions:Pick<P4R34CiHttpClient,"issue"|"cancel"|"renew">;
 roles:Pick<P4R41CiMemberRoleClient,"change"|"revoke">;
}>;
export class P4R53CiOwnerWorkspaceController{
 private epoch=0;
 private state:P4R53CiWorkspaceSnapshot=EMPTY;
 constructor(private readonly api:P4R53CiWorkspaceDependencies){}
 snapshot():P4R53CiWorkspaceSnapshot{return this.state;}
 private filters():Filters{
  const v=this.state;
  return {memberFilter:v.memberFilter,memberSearch:v.memberSearch,
   invitationFilter:v.invitationFilter,invitationSearch:v.invitationSearch,
   activityFilter:v.activityFilter};
 }
 private deny(org:string,filters:Filters):P4R53CiWorkspaceSnapshot{
  this.state=Object.freeze({...EMPTY,...filters,orgId:org,phase:"denied",
   message:"Owner operation denied; all previously visible records cleared"});
  return this.state;
 }
 async refresh(org:string,options:Partial<Filters>={}):
  Promise<P4R53CiWorkspaceSnapshot>{
  const prev=this.state.orgId===org?this.filters():{
   memberFilter:"all" as const,memberSearch:"",
   invitationFilter:"all" as const,invitationSearch:"",
   activityFilter:"all" as const,
  };
  const filters:Filters={...prev,...options};
  const request=++this.epoch;
  this.state=Object.freeze({...EMPTY,...filters,orgId:org,phase:"loading",
   message:"Reading signed CI owner APIs"});
  try{
   const [counts,members,invitations,activity]=await Promise.all([
    this.api.summary.summary(org),
    this.api.members.page(org,filters.memberFilter,filters.memberSearch,null),
    this.api.invitations.page(org,filters.invitationFilter,
     filters.invitationSearch,null),
    this.api.activity.page(org,filters.activityFilter,null),
   ]);
   if(request!==this.epoch)return this.state;
   if(new Set(members.items.map(x=>x.userId)).size!==members.items.length||
    new Set(invitations.items.map(x=>x.id)).size!==invitations.items.length||
    new Set(activity.items.map(x=>x.eventId)).size!==activity.items.length||
    invitations.items.some(i=>i.organizationId!==org))
    return this.deny(org,filters);
   this.state=Object.freeze({
    ...EMPTY,...filters,orgId:org,phase:"ready",counts,
    members:members.items,memberCursor:members.nextCursor,
    invitations:invitations.items,invitationCursor:invitations.nextCursor,
    activity:activity.items,activityCursor:activity.nextCursor,
    message:"Verified fictional owner workspace from disposable PostgreSQL",
   });
  }catch{
   if(request===this.epoch)return this.deny(org,filters);
  }
  return this.state;
 }
 private async write(org:string,action:()=>Promise<unknown>):
  Promise<P4R53CiWorkspaceSnapshot>{
  if(this.state.phase!=="ready"||this.state.orgId!==org)
   return this.deny(org,this.filters());
  const filters=this.filters(),request=++this.epoch;
  this.state=Object.freeze({...EMPTY,...filters,orgId:org,phase:"loading",
   message:"Applying verified fictional owner operation"});
  try{
   await action();
   if(request!==this.epoch)return this.state;
   return this.refresh(org,filters);
  }catch{
   if(request===this.epoch)return this.deny(org,filters);
   return this.state;
  }
 }
 issue(org:string,email:string):Promise<P4R53CiWorkspaceSnapshot>{
  return this.write(org,()=>this.api.actions.issue(org,email));
 }
 cancel(org:string,id:string):Promise<P4R53CiWorkspaceSnapshot>{
  const invitation=this.state.invitations.find(x=>x.id===id);
  if(!invitation||invitation.status!=="pending"||
   invitation.organizationId!==org)return Promise.resolve(
    this.deny(org,this.filters()));
  return this.write(org,()=>this.api.actions.cancel(org,id,invitation.version));
 }
 renew(org:string,id:string):Promise<P4R53CiWorkspaceSnapshot>{
  const invitation=this.state.invitations.find(x=>x.id===id);
  if(!invitation||!["revoked","expired"].includes(invitation.status)||
   invitation.organizationId!==org)return Promise.resolve(
    this.deny(org,this.filters()));
  return this.write(org,()=>this.api.actions.renew(org,id,invitation.version));
 }
 changeRole(org:string,userId:string,role:P4R41Role):
  Promise<P4R53CiWorkspaceSnapshot>{
  const member=this.state.members.find(x=>x.userId===userId);
  if(!member||!member.active||member.role===role)
   return Promise.resolve(this.deny(org,this.filters()));
  return this.write(org,()=>this.api.roles.change(org,userId,role,member.revision));
 }
 revokeMember(org:string,userId:string):Promise<P4R53CiWorkspaceSnapshot>{
  const member=this.state.members.find(x=>x.userId===userId);
  if(!member||!member.active)
   return Promise.resolve(this.deny(org,this.filters()));
  return this.write(org,()=>this.api.roles.revoke(org,userId));
 }
 async more(org:string,category:"members"|"invitations"|"activity"):
  Promise<P4R53CiWorkspaceSnapshot>{
  const prev=this.state;
  const filters=this.filters();
  const cursor=category==="members"?prev.memberCursor:
   category==="invitations"?prev.invitationCursor:prev.activityCursor;
  if(prev.phase!=="ready"||prev.orgId!==org||!cursor)
   return this.deny(org,filters);
  const request=++this.epoch;
  try{
   if(category==="members"){
    const page=await this.api.members.page(org,prev.memberFilter,
     prev.memberSearch,cursor);
    if(request!==this.epoch)return this.state;
    const members=[...prev.members,...page.items];
    if(new Set(members.map(x=>x.userId)).size!==members.length)
     return this.deny(org,filters);
    this.state=Object.freeze({...prev,members:Object.freeze(members),
     memberCursor:page.nextCursor});
   }else if(category==="invitations"){
    const page=await this.api.invitations.page(org,prev.invitationFilter,
     prev.invitationSearch,cursor);
    if(request!==this.epoch)return this.state;
    const invitations=[...prev.invitations,...page.items];
    if(new Set(invitations.map(x=>x.id)).size!==invitations.length||
     invitations.some(x=>x.organizationId!==org))
     return this.deny(org,filters);
    this.state=Object.freeze({...prev,invitations:Object.freeze(invitations),
     invitationCursor:page.nextCursor});
   }else{
    const page=await this.api.activity.page(org,prev.activityFilter,cursor);
    if(request!==this.epoch)return this.state;
    const activity=[...prev.activity,...page.items];
    if(new Set(activity.map(x=>x.eventId)).size!==activity.length||
     activity.some((x,i)=>i>0&&x.occurredAt>activity[i-1]!.occurredAt))
     return this.deny(org,filters);
    this.state=Object.freeze({...prev,activity:Object.freeze(activity),
     activityCursor:page.nextCursor});
   }
  }catch{
   if(request===this.epoch)return this.deny(org,filters);
  }
  return this.state;
 }
 reset():void{this.epoch++;this.state=EMPTY;}
}
