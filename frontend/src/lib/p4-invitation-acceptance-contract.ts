/**
 * Future authenticated invitation-redemption response contract.
 * No network calls, raw token handling, or Auth0 login in this module.
 * The existing browser-memory preview remains intentionally disconnected.
 */
export type P4RecipientAcceptance=Readonly<{
 accepted:true;membershipActivated:true;
}>;
export const P4_RECIPIENT_ACCEPT_API="DISABLED_PENDING_APPROVED_AUTH0_AND_RLS" as const;
export function parseP4RecipientAcceptance(response:unknown):P4RecipientAcceptance|null{
 if(!response||typeof response!=="object"||Array.isArray(response))return null;
 const envelope=response as Record<string,unknown>;
 if(Object.keys(envelope).sort().join(",")!=="data,scope"||
  envelope.scope!=="disposable-ci-only")return null;
 const data=envelope.data;
 if(!data||typeof data!=="object"||Array.isArray(data))return null;
 const d=data as Record<string,unknown>;
 if(Object.keys(d).sort().join(",")!=="accepted,membershipActivated"||
  d.accepted!==true||d.membershipActivated!==true)return null;
 return Object.freeze({accepted:true,membershipActivated:true});
}
