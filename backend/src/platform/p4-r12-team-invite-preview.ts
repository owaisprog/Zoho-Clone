/**
 * P4 Batch 12 — decision-only team/invitation lifecycle preview.
 * Fictional fixture input only; no persistence, providers, privileged writes or routes.
 * Production authentication, RBAC/ABAC and RLS must be independently accepted.
 */
import { isCanonicalUuidV4 } from "./p4-approved-uuid.js";

export class P4R12PreviewDenied extends Error {
  constructor() { super("P4_R12_PREVIEW_DENIED"); }
}
export type P4R12Role = "ORG_OWNER"|"ORG_ADMIN"|"SECURITY_REVIEWER"|"SALES_MANAGER"|"SALES_REP";
export type P4R12Actor = Readonly<{
  organizationId:string; actorId:string; active:boolean; platformEnabled:boolean;
  roles:readonly P4R12Role[]; revision:number;
}>;
export type P4R12Team = Readonly<{
  id:string; organizationId:string; name:string; managerIds:readonly string[];
  memberIds:readonly string[]; active:boolean;
}>;
export type P4R12Invite = Readonly<{
  id:string; organizationId:string; roleCode:"SALES_REP"; status:"pending"|"accepted"|"revoked"|"expired";
  createdAt:string; expiresAt:string; acceptedAt?:string; revokedAt?:string;
  revision:number;
}>;
export type P4R12SafeTeam = Readonly<{id:string;name:string;memberCount:number;isManager:boolean}>;
export type P4R12SafeInvite = Readonly<{
  id:string;roleCode:"SALES_REP";status:P4R12Invite["status"];expiresAt:string;revision:number;
}>;
function validId(value:unknown):value is string {
  return typeof value==="string" && isCanonicalUuidV4(value);
}
function validRevision(value:unknown):value is number {
  return typeof value==="number" && Number.isSafeInteger(value) && value>=0;
}
function dateMs(value:unknown):number {
  if(typeof value!=="string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)) {
    throw new P4R12PreviewDenied();
  }
  const time=Date.parse(value);
  if(!Number.isFinite(time)||new Date(time).toISOString()!==value) throw new P4R12PreviewDenied();
  return time;
}
function assertActor(actor:P4R12Actor):void {
  if(!actor||!validId(actor.organizationId)||!validId(actor.actorId)||
    actor.active!==true||actor.platformEnabled!==true||!validRevision(actor.revision)||
    !Array.isArray(actor.roles)||actor.roles.length===0||
    actor.roles.some(role=>!["ORG_OWNER","ORG_ADMIN","SECURITY_REVIEWER","SALES_MANAGER","SALES_REP"].includes(role))||
    new Set(actor.roles).size!==actor.roles.length) throw new P4R12PreviewDenied();
}
function assertLimit(limit:number):void {
  if(!Number.isSafeInteger(limit)||limit<1||limit>20) throw new P4R12PreviewDenied();
}
function assertTeam(team:P4R12Team,orgId:string):void {
  if(!team||team.organizationId!==orgId||!validId(team.id)||
    typeof team.name!=="string"||team.name.length<1||team.name.length>80||
    !Array.isArray(team.memberIds)||!Array.isArray(team.managerIds)||
    team.memberIds.length>1000||team.managerIds.length>100||
    [...team.memberIds,...team.managerIds].some(id=>!validId(id))||
    new Set(team.memberIds).size!==team.memberIds.length||
    new Set(team.managerIds).size!==team.managerIds.length||
    team.managerIds.some(id=>!team.memberIds.includes(id))||
    typeof team.active!=="boolean") throw new P4R12PreviewDenied();
}
function assertInvite(invite:P4R12Invite,orgId:string):void {
  if(!invite||invite.organizationId!==orgId||!validId(invite.id)||
    invite.roleCode!=="SALES_REP"||!["pending","accepted","revoked","expired"].includes(invite.status)||
    !validRevision(invite.revision))throw new P4R12PreviewDenied();
  const created=dateMs(invite.createdAt),expires=dateMs(invite.expiresAt);
  if(expires<=created)throw new P4R12PreviewDenied();
  const hasAccepted=invite.acceptedAt!==undefined,hasRevoked=invite.revokedAt!==undefined;
  if(hasAccepted && (dateMs(invite.acceptedAt)<created||dateMs(invite.acceptedAt)>expires)) throw new P4R12PreviewDenied();
  if(hasRevoked && dateMs(invite.revokedAt)<created)throw new P4R12PreviewDenied();
  if((invite.status==="accepted")!==hasAccepted||(invite.status==="revoked")!==hasRevoked||
     (hasAccepted&&hasRevoked))throw new P4R12PreviewDenied();
}
/** Step 1–2: tenant and current-role scoped team directory; never exposes private member IDs. */
export function previewP4R12Teams(actor:P4R12Actor,teams:readonly P4R12Team[],limit=20):
  readonly P4R12SafeTeam[] {
  assertActor(actor);assertLimit(limit);
  if(!Array.isArray(teams)||teams.length>1000)throw new P4R12PreviewDenied();
  const allowed=actor.roles.some(role=>["ORG_OWNER","ORG_ADMIN","SECURITY_REVIEWER","SALES_MANAGER"].includes(role));
  if(!allowed)throw new P4R12PreviewDenied();
  const seen=new Set<string>();
  const result:P4R12SafeTeam[]=[];
  for(const team of teams){
    assertTeam(team,actor.organizationId);
    if(seen.has(team.id))throw new P4R12PreviewDenied();
    seen.add(team.id);
    if(!team.active)continue;
    const isManager=team.managerIds.includes(actor.actorId);
    if(!actor.roles.some(r=>["ORG_OWNER","ORG_ADMIN","SECURITY_REVIEWER"].includes(r))&&!isManager)continue;
    result.push(Object.freeze({id:team.id,name:team.name,memberCount:team.memberIds.length,isManager}));
  }
  if(result.length>limit)throw new P4R12PreviewDenied();
  return Object.freeze(result.sort((a,b)=>a.id.localeCompare(b.id)));
}
/** Step 3: invitation listing is owner/admin only; no recipient email or token disclosure. */
export function previewP4R12Invites(actor:P4R12Actor,invites:readonly P4R12Invite[],asOf:string,limit=20):
  readonly P4R12SafeInvite[] {
  assertActor(actor);assertLimit(limit);const now=dateMs(asOf);
  if(!actor.roles.some(r=>r==="ORG_OWNER"||r==="ORG_ADMIN")||
     !Array.isArray(invites)||invites.length>1000)throw new P4R12PreviewDenied();
  const seen=new Set<string>();
  const result:P4R12SafeInvite[]=[];
  for(const invite of invites){
    assertInvite(invite,actor.organizationId);
    if(seen.has(invite.id))throw new P4R12PreviewDenied();
    seen.add(invite.id);
    const status=invite.status==="pending"&&dateMs(invite.expiresAt)<=now?"expired":invite.status;
    result.push(Object.freeze({id:invite.id,roleCode:"SALES_REP" as const,status,
      expiresAt:invite.expiresAt,revision:invite.revision}));
  }
  if(result.length>limit)throw new P4R12PreviewDenied();
  return Object.freeze(result.sort((a,b)=>a.id.localeCompare(b.id)));
}
/** Step 4–5: preflight ONLY. No mutation, send, acceptance, or token generation. */
export function reviewP4R12InviteAction(
  actor:P4R12Actor,invite:P4R12Invite,action:"resend"|"revoke"|"accept",
  expectedRevision:number,asOf:string,
):Readonly<{allowed:false;reason:"execution-not-approved"|"expired"|"not-pending"|"stale" }> {
  assertActor(actor);assertInvite(invite,actor.organizationId);
  if(!["resend","revoke","accept"].includes(action)||!validRevision(expectedRevision))throw new P4R12PreviewDenied();
  const now=dateMs(asOf);
  if(!actor.roles.some(r=>r==="ORG_OWNER"||r==="ORG_ADMIN"))throw new P4R12PreviewDenied();
  if(invite.revision!==expectedRevision)return Object.freeze({allowed:false,reason:"stale"});
  if(invite.status!=="pending")return Object.freeze({allowed:false,reason:"not-pending"});
  if(dateMs(invite.expiresAt)<=now)return Object.freeze({allowed:false,reason:"expired"});
  return Object.freeze({allowed:false,reason:"execution-not-approved"});
}
