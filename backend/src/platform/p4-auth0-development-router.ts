import { Router, type Request } from "express";
import { auth0IdentityCheckMiddleware } from "../auth/auth0-api.js";
import { readAuth0ApiConfiguration } from "../auth/auth0-config.js";
import {
  createP4IntegrationTestRouter, type P4TestIntegrationDependencies,
} from "./p4-integration-test-router.js";
import type { P4VerifiedProviderToken } from "./p4-auth0-subject-bridge.js";

/**
 * Development-only real Auth0 middleware composition. Not mounted by app.ts.
 * A token is considered verified ONLY after auth0IdentityCheckMiddleware
 * validates JWKS signature, issuer, expiry and audience. Never populate
 * req.auth from headers/body or expose this router to customer traffic.
 */
type P4DevAuthDependencies = Omit<
  P4TestIntegrationDependencies,
  "resolveVerifiedToken" | "expectedIssuer" | "expectedAudience"
>;
function signedPayloadFromSdk(req: Request): P4VerifiedProviderToken | null {
  // This helper is intentionally private to the SDK-backed pipeline.
  const sdk = req as Request & { auth?: { payload?: Record<string, unknown> } };
  const payload = sdk.auth?.payload;
  if (!payload || typeof payload.iss !== "string" ||
      typeof payload.sub !== "string" ||
      !(typeof payload.aud === "string" ||
        (Array.isArray(payload.aud) && payload.aud.every(a => typeof a === "string"))) ||
      typeof payload.exp !== "number") return null;
  return {
    issuer: payload.iss,
    subject: payload.sub,
    audience: payload.aud as string | string[],
    expiresAtEpochSeconds: payload.exp,
    cryptographicallyVerified: true,
  };
}
export function createP4Auth0DevelopmentReadRouter(
  deps: P4DevAuthDependencies,
  env: NodeJS.ProcessEnv = process.env,
) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("P4 Auth0 development integration cannot run in production");
  }
  const router = Router();
  const config = readAuth0ApiConfiguration(env);
  if (!config) {
    router.use((_req, res) => {
      res.setHeader("Cache-Control", "no-store");
      res.status(503).json({ error: { code: "AUTH_NOT_CONFIGURED" } });
    });
    return router;
  }
  // No route may run before the SDK JWT verification. The SDK reads the
  // actual process environment; do not create a synthetic customer token.
  router.use(auth0IdentityCheckMiddleware());
  router.use(createP4IntegrationTestRouter({
    ...deps,
    resolveVerifiedToken: async request => signedPayloadFromSdk(request),
    expectedIssuer: config.issuerBaseURL,
    expectedAudience: config.audience,
  }));
  return router;
}
