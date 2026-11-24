/**
 * P4 R27 browser-memory functional workflow. Not authentication or tenancy.
 * Deliberately fictional, pure immutable state transitions; zero network,
 * localStorage, email delivery, token creation, or production persistence.
 */
import { fictionalOrganizationPreview } from "./p4-organization-preview";

export type SandboxInviteStatus="pending"|"accepted"|"revoked"|"expired";
export type SandboxRole="ORG_OWNER"|"SALES_REP"|"SALES_MANAGER";
export type SandboxAssignableRole="SALES_REP"|"SALES_MANAGER";
export type SandboxMemberFilter="all"|"active"|"revoked";
export interface SandboxRoleChange {
 readonly id:string; readonly email:string;
 readonly fromRole:SandboxAssignableRole;
 readonly toRole:SandboxAssignableRole; readonly occurredAt:string;
}
export interface SandboxMember {
 readonly email:string; readonly role:SandboxRole; readonly active:boolean;
}
export interface SandboxInvitation {
 readonly id:string; readonly email:string; readonly role:"SALES_REP";
 readonly status:SandboxInviteStatus; readonly createdAt:string;
 readonly expiresAt:string;
}
export interface SandboxOrganization {
 readonly id:string; readonly name:string; readonly slug:string;
 readonly members:readonly SandboxMember[];
 readonly invitations:readonly SandboxInvitation[];
 readonly roleChanges:readonly SandboxRoleChange[];
}
export interface SandboxState {
 readonly organizations:readonly SandboxOrganization[];
 readonly selectedId:string|null; readonly revision:number;
}
export type SandboxResult={readonly state:SandboxState;readonly detail:string};
const OWNER="demo.owner@example.com";
export const INITIAL_SANDBOX:SandboxState=Object.freeze({
 organizations:Object.freeze([]),selectedId:null,revision:0,
});
const EMAIL=/^[a-z0-9][a-z0-9._-]{0,45}@example\.com$/;
const TIME_MS=7*24*60*60*1000;
export class SandboxWorkflowError extends Error {
 constructor(public readonly code:
  "INVALID_INPUT"|"CONFLICT"|"NOT_FOUND"|"FORBIDDEN"|"INVALID_STATE"){
  super(code);
 }
}
function ensure(condition:unknown,code:SandboxWorkflowError["code"]):asserts condition{
 if(!condition)throw new SandboxWorkflowError(code);
}
function iso(value:number):string{
 ensure(Number.isSafeInteger(value)&&value>=0&&value<=8_640_000_000_000_000,"INVALID_INPUT");
 return new Date(value).toISOString();
}
function activeOrg(state:SandboxState):SandboxOrganization{
 const org=state.organizations.find(x=>x.id===state.selectedId);
 ensure(org,"NOT_FOUND");
 ensure(org.members.some(m=>m.email===OWNER&&m.role==="ORG_OWNER"&&m.active),"FORBIDDEN");
 return org;
}
function replace(state:SandboxState,updated:SandboxOrganization):SandboxState{
 return Object.freeze({...state,revision:state.revision+1,
  organizations:Object.freeze(state.organizations.map(x=>
   x.id===updated.id?Object.freeze(updated):x))});
}
export function addSandboxOrganization(state:SandboxState,name:string,slug:string):SandboxResult{
 const draft=fictionalOrganizationPreview(name,slug);
 ensure(draft.isValid,"INVALID_INPUT");
 ensure(state.organizations.length<5,"INVALID_STATE");
 ensure(!state.organizations.some(x=>x.slug===draft.slug),"CONFLICT");
 const org:SandboxOrganization=Object.freeze({
  id:"sandbox-org-"+(state.revision+1),name:draft.name,slug:draft.slug,
  members:Object.freeze([{email:OWNER,role:"ORG_OWNER" as const,active:true}]),
  invitations:Object.freeze([]),roleChanges:Object.freeze([]),
 });
 const next=Object.freeze({organizations:Object.freeze([...state.organizations,org]),
  selectedId:org.id,revision:state.revision+1});
 return {state:next,detail:"Created fictional workspace and owner membership in this browser tab."};
}
export function selectSandboxOrganization(state:SandboxState,id:string):SandboxResult{
 ensure(state.organizations.some(x=>x.id===id),"NOT_FOUND");
 return {state:Object.freeze({...state,selectedId:id,revision:state.revision+1}),
  detail:"Switched fictional workspace."};
}
export function addSandboxInvitation(state:SandboxState,email:string,now:number):SandboxResult{
 const org=activeOrg(state);
 const normalized=email.trim().toLowerCase();
 ensure(email===normalized&&EMAIL.test(normalized)&&normalized!==OWNER,"INVALID_INPUT");
 ensure(org.invitations.length<15,"INVALID_STATE");
 ensure(!org.members.some(m=>m.email===normalized&&m.active),"CONFLICT");
 ensure(!org.invitations.some(i=>i.email===normalized&&i.status==="pending"),"CONFLICT");
 const createdAt=iso(now),expiresAt=iso(now+TIME_MS);
 const invite:SandboxInvitation=Object.freeze({
  id:"sandbox-invite-"+(state.revision+1),email:normalized,role:"SALES_REP",
  status:"pending",createdAt,expiresAt,
 });
 return {state:replace(state,{...org,
  invitations:Object.freeze([...org.invitations,invite])}),
  detail:"Created a fictional pending invitation. No email or token was sent."};
}
export function resolveSandboxInvitation(
 state:SandboxState,id:string,action:"accept"|"revoke",now:number,
):SandboxResult{
 const org=activeOrg(state);
 const current=org.invitations.find(x=>x.id===id);
 ensure(current,"NOT_FOUND");
 ensure(current.status==="pending","INVALID_STATE");
 const timestamp=iso(now);
 ensure(current.createdAt<=timestamp,"INVALID_INPUT");
 const expired=timestamp>=current.expiresAt;
 if(action==="accept")ensure(!expired,"INVALID_STATE");
 const status:SandboxInviteStatus=action==="revoke"?"revoked":"accepted";
 const invites=Object.freeze(org.invitations.map(i=>i.id===id?
  Object.freeze({...i,status}):i));
 const prior=org.members.filter(m=>m.email===current.email);
 if(action==="accept")ensure(prior.length<=1&&!prior.some(m=>m.active),"CONFLICT");
 const members=action==="accept"?
  Object.freeze(prior.length>0?org.members.map(m=>m.email===current.email?
   Object.freeze({...m,role:current.role,active:true}):m):
   [...org.members,Object.freeze({email:current.email,role:"SALES_REP" as const,active:true})]):
  org.members;
 return {state:replace(state,{...org,invitations:invites,members}),
  detail:action==="accept"?"Simulated acceptance; fictional member added.":"Revoked fictional invitation."};
}
export function revokeSandboxMember(state:SandboxState,email:string):SandboxResult{
 const org=activeOrg(state);
 ensure(email!==OWNER,"FORBIDDEN");
 const member=org.members.find(m=>m.email===email&&m.active);
 ensure(member,"NOT_FOUND");
 const members=Object.freeze(org.members.map(m=>m.email===email?
  Object.freeze({...m,active:false}):m));
 return {state:replace(state,{...org,members}),
  detail:"Revoked fictional membership immediately."};
}

/**
 * P4 R38: simulated renewal, never an actual resend, link, or email.
 * Only the selected fictional tenant is visible. Old invitations stay
 * terminal, and a new expiry window is represented by a new ID.
 */
export function renewSandboxInvitation(
 state:SandboxState,id:string,now:number,
):SandboxResult{
 const org=activeOrg(state);
 const current=org.invitations.find(i=>i.id===id);
 ensure(current,"NOT_FOUND");
 const createdAt=iso(now),expiresAt=iso(now+TIME_MS);
 ensure(current.createdAt<=createdAt,"INVALID_INPUT");
 const status=displayedSandboxStatus(current,now);
 ensure(status==="expired"||status==="revoked","INVALID_STATE");
 ensure(!org.members.some(m=>m.email===current.email&&m.active),"CONFLICT");
 ensure(!org.invitations.some(i=>i.id!==id&&i.email===current.email&&
  displayedSandboxStatus(i,now)==="pending"),"CONFLICT");
 ensure(org.invitations.length<15,"INVALID_STATE");
 const renewed:SandboxInvitation=Object.freeze({
  id:"sandbox-invite-"+(state.revision+1),email:current.email,
  role:"SALES_REP",status:"pending",createdAt,expiresAt,
 });
 const invitations=Object.freeze([
  ...org.invitations.map(i=>i.id===id&&i.status==="pending"?
   Object.freeze({...i,status:"expired" as const}):i),
  renewed,
 ]);
 return {state:replace(state,{...org,invitations}),
  detail:"Renewed fictional invitation in this tab. No email or link was sent."};
}

export function displayedSandboxStatus(i:SandboxInvitation,now:number):SandboxInviteStatus{
 return i.status==="pending"&&now>=Date.parse(i.expiresAt)?"expired":i.status;
}

/**
 * P4 R37: recipient-perspective interface selectors for the fictional
 * browser-memory workflow. Typing an email is NOT authentication; these
 * functions only demonstrate which rows a verified server identity would see.
 */
export type SandboxInviteSummary=Readonly<{
 pending:number;accepted:number;revoked:number;expired:number;
 activeMembers:number;
}>;
export function summarizeSandboxInvitations(
 state:SandboxState,now:number,
):SandboxInviteSummary{
 ensure(Number.isSafeInteger(now)&&now>=0,"INVALID_INPUT");
 const org=activeOrg(state);
 const counts={pending:0,accepted:0,revoked:0,expired:0,
  activeMembers:org.members.filter(m=>m.active).length};
 for(const invite of org.invitations){
  const status=displayedSandboxStatus(invite,now);
  counts[status]++;
 }
 return Object.freeze(counts);
}
export function getRecipientSandboxInbox(
 state:SandboxState,recipientEmail:string,now:number,
):readonly Readonly<SandboxInvitation & {displayedStatus:SandboxInviteStatus}>[]{
 ensure(recipientEmail===recipientEmail.trim().toLowerCase()&&
  EMAIL.test(recipientEmail),"INVALID_INPUT");
 ensure(Number.isSafeInteger(now)&&now>=0,"INVALID_INPUT");
 const org=activeOrg(state);
 return Object.freeze(org.invitations
  .filter(i=>i.email===recipientEmail)
  .map(i=>Object.freeze({...i,displayedStatus:displayedSandboxStatus(i,now)})));
}
export function acceptSandboxInvitationAsRecipient(
 state:SandboxState,id:string,recipientEmail:string,now:number,
):SandboxResult{
 const matches=getRecipientSandboxInbox(state,recipientEmail,now);
 const invite=matches.find(i=>i.id===id);
 ensure(invite,"FORBIDDEN");
 ensure(invite.displayedStatus==="pending","INVALID_STATE");
 // The demo owner state permits a transition for the mock recipient.
 // THIS IS NOT A REAL IDENTITY OR AUTHORIZATION CHECK.
 const result=resolveSandboxInvitation(state,id,"accept",now);
 return {...result,
  detail:"Simulated recipient acceptance; fictional membership added. No login or token."};
}

/**
 * P4 R39: in-tab owner-managed directory and bounded role change history.
 * Neither editable roles nor demo event history authorize any server API.
 * A previously revoked manager is always re-invited as SALES_REP, not
 * silently restored to privileged access.
 */
export function getSandboxMemberDirectory(
 state:SandboxState,query:string,filter:SandboxMemberFilter="all",
):readonly SandboxMember[]{
 ensure(typeof query==="string"&&query.length<=64,"INVALID_INPUT");
 ensure(filter==="all"||filter==="active"||filter==="revoked","INVALID_INPUT");
 const org=activeOrg(state);
 const needle=query.trim().toLowerCase();
 return Object.freeze(org.members.filter(m=>
  (filter==="all"||(filter==="active"?m.active:!m.active))&&
  (m.email.includes(needle)||m.role.toLowerCase().includes(needle)))
  .map(m=>Object.freeze({...m}))
  .sort((a,b)=>a.email.localeCompare(b.email)));
}
export function listSandboxRoleChanges(state:SandboxState):readonly SandboxRoleChange[]{
 const org=activeOrg(state);
 return Object.freeze(org.roleChanges.slice().reverse()
  .map(entry=>Object.freeze({...entry})));
}
export function changeSandboxMemberRole(
 state:SandboxState,email:string,role:string,now:number,
):SandboxResult{
 const org=activeOrg(state);
 ensure(role==="SALES_REP"||role==="SALES_MANAGER","INVALID_INPUT");
 ensure(email!==OWNER&&EMAIL.test(email),"FORBIDDEN");
 const matching=org.members.filter(m=>m.email===email);
 ensure(matching.length<=1,"CONFLICT");
 const member=matching[0];
 ensure(member,"NOT_FOUND");
 ensure(member.active&&
  (member.role==="SALES_REP"||member.role==="SALES_MANAGER"),"FORBIDDEN");
 ensure(member.role!==role,"CONFLICT");
 ensure(org.roleChanges.length<30,"INVALID_STATE");
 const occurredAt=iso(now);
 const change:SandboxRoleChange=Object.freeze({
  id:"sandbox-role-change-"+(state.revision+1),email,
  fromRole:member.role,toRole:role,occurredAt,
 });
 const members=Object.freeze(org.members.map(m=>m.email===email?
  Object.freeze({...m,role}):m));
 return {state:replace(state,{...org,members,
  roleChanges:Object.freeze([...org.roleChanges,change])}),
  detail:"Changed fictional member role in this tab. No server permissions were granted."};
}
