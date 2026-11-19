/**
 * P4.01-P4.03: source-only identity policy, NOT an Express authorization
 * middleware. A trusted Auth0 SDK/JWKS adapter must verify claims before
 * calling this module. Browser-supplied flags must never be trusted.
 *
 * No real user or tenant writes are mounted while OPEN-001/002/003 are open.
 */
export interface ProviderIdentityEvidence {
  issuer: string;
  subject: string;
  email: string;
  emailVerified: boolean;
  expiresAtEpochSeconds: number;
  cryptographicallyVerified: boolean;
}
export interface VerifiedRegistrationIdentity {
  issuer: string;
  subject: string;
  canonicalEmail: string;
  verified: true;
}

const AUTH0_ISSUER = /^https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*\.auth0\.com\/$/i;

export function canonicalizeVerifiedEmail(input: unknown): string | null {
  if (typeof input !== "string" || input.length < 3 || input.length > 254 ||
      input !== input.trim() || /[\s<>()"'\\]/.test(input)) return null;
  const at = input.indexOf("@");
  if (at < 1 || at !== input.lastIndexOf("@") || at > 64) return null;
  const name = input.slice(0, at);
  const domain = input.slice(at + 1);
  if (!/^[a-z0-9][a-z0-9._+%-]*$/i.test(name) ||
      !/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(domain)) return null;
  // Canonicalization is for display/dedup warnings only. Provider-subject
  // mapping is the unique identity key; do NOT merge accounts by email.
  return input.toLowerCase();
}

export function verifyRegistrationIdentity(
  evidence: ProviderIdentityEvidence,
  expectedIssuer: string,
  nowEpochSeconds = Math.floor(Date.now() / 1000),
): VerifiedRegistrationIdentity | null {
  if (!AUTH0_ISSUER.test(expectedIssuer) ||
      evidence.cryptographicallyVerified !== true ||
      evidence.issuer !== expectedIssuer ||
      typeof evidence.subject !== "string" ||
      !/^[a-zA-Z0-9|:_-]{3,200}$/.test(evidence.subject) ||
      evidence.emailVerified !== true ||
      !Number.isSafeInteger(evidence.expiresAtEpochSeconds) ||
      evidence.expiresAtEpochSeconds <= nowEpochSeconds ||
      evidence.expiresAtEpochSeconds > nowEpochSeconds + 86_400 ||
      !canonicalizeVerifiedEmail(evidence.email)) return null;
  return {
    issuer: evidence.issuer,
    subject: evidence.subject,
    canonicalEmail: canonicalizeVerifiedEmail(evidence.email)!,
    verified: true,
  };
}

/** P4.02: login session != membership/tenant access. */
export type IdentitySessionClass = "not_configured" | "unauthenticated" |
  "verification_required" | "verified_identity";

export function classifyIdentitySession(
  configured: boolean,
  hasTrustedProviderSession: boolean,
  providerEmailVerified: unknown,
): IdentitySessionClass {
  if (!configured) return "not_configured";
  if (!hasTrustedProviderSession) return "unauthenticated";
  return providerEmailVerified === true ? "verified_identity" : "verification_required";
}

/** P4.03: no privileged route currently uses this provisional pure check.
 * A real server integration must source MFA state from a verified IdP event
 * and check account/session revocation and membership on every request.
 */
export interface TrustedAssuranceEvidence {
  providerVerified: true;
  emailVerified: true;
  mfaVerifiedAtEpochSeconds: number | null;
  authenticationRevoked: boolean;
}

export function hasFreshPrivilegedAssurance(
  evidence: TrustedAssuranceEvidence | null,
  nowEpochSeconds: number,
  maxAgeSeconds = 900,
): boolean {
  if (!evidence || evidence.providerVerified !== true ||
      evidence.emailVerified !== true || evidence.authenticationRevoked ||
      !Number.isSafeInteger(nowEpochSeconds) ||
      !Number.isSafeInteger(maxAgeSeconds) || maxAgeSeconds < 1 || maxAgeSeconds > 900 ||
      evidence.mfaVerifiedAtEpochSeconds === null ||
      !Number.isSafeInteger(evidence.mfaVerifiedAtEpochSeconds)) return false;
  const age = nowEpochSeconds - evidence.mfaVerifiedAtEpochSeconds;
  return age >= 0 && age <= maxAgeSeconds;
}
