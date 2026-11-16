import type { VerifiedPreviewActor } from "./contracts.js";

/**
 * P3.21: managed-auth integration seam only. No custom passwords, no JWT
 * signature parsing, and no real identity provider is selected or connected.
 * A future trusted adapter must verify signature, issuer, audience, expiry,
 * revocation and signing-key rotation independently.
 */
export interface VerifiedProviderClaims {
  subject: string;
  issuer: string;
  audience: string;
  expiresAtEpochSeconds: number;
  cryptographicallyVerified: true;
}
export interface ManagedIdentityAdapter {
  verifyBearerToken(token: string): Promise<VerifiedProviderClaims | null>;
}
export interface ExpectedIdentityConfig {
  issuer: string;
  audience: string;
}
export async function resolveSyntheticManagedIdentity(
  authorization: unknown,
  adapter: ManagedIdentityAdapter,
  config: ExpectedIdentityConfig,
  nowEpochSeconds = Math.floor(Date.now() / 1000),
): Promise<VerifiedPreviewActor | null> {
  // The token never reaches a logger, URL, response or error message.
  if (typeof authorization !== "string" ||
      !/^Bearer [A-Za-z0-9._~-]{10,4096}$/.test(authorization)) return null;
  const token = authorization.slice("Bearer ".length);
  try {
    const claims = await adapter.verifyBearerToken(token);
    if (!claims || claims.cryptographicallyVerified !== true ||
        !/^user_demo_[a-z]{2,16}$/.test(claims.subject) ||
        claims.issuer !== config.issuer || claims.audience !== config.audience ||
        typeof claims.expiresAtEpochSeconds !== "number" ||
        !Number.isSafeInteger(claims.expiresAtEpochSeconds) ||
        claims.expiresAtEpochSeconds <= nowEpochSeconds) return null;
    // Roles and tenant membership are NEVER accepted from token claims.
    return { userId: claims.subject, verified: true };
  } catch {
    return null;
  }
}
