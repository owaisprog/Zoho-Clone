/**
 * P4.01-P4.03: public, non-sensitive status derived ONLY from a server-side
 * trusted Auth0 SDK session. This is NOT a tenant/permission check.
 */
export type PublicAccountState =
  "not_configured" | "signed_out" | "verification_required" | "identity_verified";

export function getPublicAccountState(
  auth0Configured: boolean,
  hasServerSession: boolean,
  providerEmailVerified: unknown,
): PublicAccountState {
  if (!auth0Configured) return "not_configured";
  if (!hasServerSession) return "signed_out";
  return providerEmailVerified === true ? "identity_verified" : "verification_required";
}

export interface PublicAccountResponse {
  state: PublicAccountState;
  identityOnly: true;
  organizationAccess: false;
}

export function publicAccountResponse(
  auth0Configured: boolean,
  hasServerSession: boolean,
  providerEmailVerified: unknown,
): PublicAccountResponse {
  return {
    state: getPublicAccountState(auth0Configured, hasServerSession, providerEmailVerified),
    identityOnly: true,
    organizationAccess: false,
  };
}
