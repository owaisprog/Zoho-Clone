import type { TrustedSyntheticMemberActor } from "./p4-membership.js";

/**
 * P4 exit integration seam. The "cryptographicallyVerified" proof may ONLY
 * be supplied by the server's Auth0 JWT middleware after JWKS, signature,
 * issuer, audience and expiry checks. A browser flag is NEVER evidence.
 * Synthetic user IDs remain in place pending real identity-schema approval.
 */
export interface P4VerifiedProviderToken {
  issuer: string;
  subject: string;
  audience: string | readonly string[];
  expiresAtEpochSeconds: number;
  cryptographicallyVerified: true;
}
export interface P4SubjectMapping {
  userId: string;
  emailVerified: boolean;
}
export interface P4SubjectMappingLookup {
  findByIssuerAndSubject(issuer: string, subject: string): Promise<P4SubjectMapping | null>;
}
export class P4IdentityBridgeDeniedError extends Error {
  constructor() { super("P4_IDENTITY_MAPPING_DENIED"); }
}
const VALID_ISSUER = /^https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*\.auth0\.com\/$/i;
const VALID_SUBJECT = /^[A-Za-z0-9|:_-]{3,200}$/;
export async function resolveP4SyntheticProviderActor(
  evidence: P4VerifiedProviderToken | null,
  expected: { issuer: string; audience: string },
  lookup: P4SubjectMappingLookup,
  nowEpochSeconds: number,
): Promise<Readonly<TrustedSyntheticMemberActor>> {
  if (!evidence || evidence.cryptographicallyVerified !== true ||
      typeof expected?.issuer !== "string" || !VALID_ISSUER.test(expected.issuer) ||
      typeof expected.audience !== "string" || !/^(https:\/\/|urn:)/.test(expected.audience) ||
      evidence.issuer !== expected.issuer ||
      !VALID_SUBJECT.test(evidence.subject) ||
      !Array.isArray(evidence.audience) && typeof evidence.audience !== "string" ||
      !(typeof evidence.audience === "string"
        ? evidence.audience === expected.audience
        : evidence.audience.includes(expected.audience)) ||
      !Number.isSafeInteger(nowEpochSeconds) ||
      !Number.isSafeInteger(evidence.expiresAtEpochSeconds) ||
      evidence.expiresAtEpochSeconds <= nowEpochSeconds ||
      evidence.expiresAtEpochSeconds > nowEpochSeconds + 86_400) {
    throw new P4IdentityBridgeDeniedError();
  }
  try {
    // Exact (issuer, subject). Never match by email or trust a JWT role/org.
    const mapping = await lookup.findByIssuerAndSubject(evidence.issuer, evidence.subject);
    if (!mapping || !/^user_demo_[a-z]{2,16}$/.test(mapping.userId) ||
        mapping.emailVerified !== true) throw new P4IdentityBridgeDeniedError();
    return Object.freeze({
      userId: mapping.userId, providerVerified: true as const, emailVerified: true as const,
    });
  } catch {
    throw new P4IdentityBridgeDeniedError();
  }
}
