import { auth } from "express-oauth2-jwt-bearer";
import type { RequestHandler } from "express";
import { readAuth0ApiConfiguration } from "./auth0-config.js";

/**
 * OAuth access tokens are verified by Auth0's stable generic middleware:
 * signature/JWKS, RS256, issuer, audience, expiry. Never use ID tokens for API
 * authorization. Provider subject != a tenant membership or record grant.
 */
export function auth0IdentityCheckMiddleware(env: NodeJS.ProcessEnv = process.env): RequestHandler {
  const config = readAuth0ApiConfiguration(env);
  if (!config) {
    return (_req, res) => {
      res.status(503).json({
        error: { code: "AUTH_NOT_CONFIGURED", message: "Identity provider is not configured" },
      });
    };
  }
  return auth({
    issuerBaseURL: config.issuerBaseURL,
    audience: config.audience,
    tokenSigningAlg: "RS256",
  });
}
