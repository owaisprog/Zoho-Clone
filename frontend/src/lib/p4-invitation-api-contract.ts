/**
 * P4 R29: response-contract boundary for a FUTURE authorized backend client.
 * Deliberately performs no network request and never binds bearer headers.
 * The existing browser-memory UI is unchanged until approved live identity,
 * CSRF protections and production database permissions are available.
 */
export type SafeInvitationDraft=Readonly<{
 id:string;organizationId:string;recipientEmail:string;role:"MEMBER";
 status:"pending"|"expired"|"revoked"|"accepted";
 issuedAt:string;expiresAt:string;version:number;
}>;
const UUID4=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const EMAIL=/^[a-z0-9][a-z0-9._-]{0,60}@example\.com$/;
const statuses=new Set(["pending","expired","revoked","accepted"]);
/** Strictly shape-check a safe fictional API projection, never an authorization decision. */
export function parseSafeInvitationDraft(value:unknown):SafeInvitationDraft|null{
 if(!value||typeof value!=="object"||Array.isArray(value))return null;
 const v=value as Record<string,unknown>;
 if(Object.keys(v).sort().join(",")!==
  "expiresAt,id,issuedAt,organizationId,recipientEmail,role,status,version"||
  typeof v.id!=="string"||!UUID4.test(v.id)||
  typeof v.organizationId!=="string"||!UUID4.test(v.organizationId)||
  typeof v.recipientEmail!=="string"||!EMAIL.test(v.recipientEmail)||
  v.role!=="MEMBER"||!statuses.has(String(v.status))||
  typeof v.issuedAt!=="string"||typeof v.expiresAt!=="string"||
  !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v.issuedAt)||
  !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v.expiresAt)||
  !Number.isSafeInteger(v.version)||Number(v.version)<1)return null;
 const a=Date.parse(v.issuedAt),b=Date.parse(v.expiresAt);
 if(!Number.isFinite(a)||!Number.isFinite(b)||a>=b||
  new Date(a).toISOString()!==v.issuedAt||
  new Date(b).toISOString()!==v.expiresAt)return null;
 return Object.freeze(v as SafeInvitationDraft);
}
export const P4_INVITATION_API_INTEGRATION="DISABLED_PENDING_LIVE_IDENTITY_APPROVAL" as const;
