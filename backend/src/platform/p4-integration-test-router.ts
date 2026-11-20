import { Router, type Request } from "express";
import {
  resolveP4SyntheticProviderActor, P4IdentityBridgeDeniedError,
  type P4VerifiedProviderToken, type P4SubjectMappingLookup,
} from "./p4-auth0-subject-bridge.js";
import { resolveSyntheticTenantContext, type MembershipLookup } from "./p4-membership.js";
import { readP4VerifiedWorkspaceSettings } from "./p4-pg-workspace-reader.js";
import type { ScopedPgPool } from "./p4-rls-transaction.js";

/**
 * Only mount on a disposable test Express app: never in backend/src/app.ts.
 * Integration tests inject a fake verifier; a real route must use the
 * verified Auth0 middleware and approved provider-to-user database adapter.
 */
export interface P4TestIntegrationDependencies {
  resolveVerifiedToken(req: Request): Promise<P4VerifiedProviderToken | null>;
  mappingLookup: P4SubjectMappingLookup;
  memberships: MembershipLookup;
  tenantPool: ScopedPgPool;
  expectedIssuer: string;
  expectedAudience: string;
  nowEpochSeconds(): number;
}
export function createP4IntegrationTestRouter(deps: P4TestIntegrationDependencies) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("P4 test-only integration routes cannot be mounted in production");
  }
  const router = Router();
  router.get("/:orgId/settings", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    let actor;
    try {
      const claims = await deps.resolveVerifiedToken(req);
      actor = await resolveP4SyntheticProviderActor(claims, {
        issuer: deps.expectedIssuer, audience: deps.expectedAudience,
      }, deps.mappingLookup, deps.nowEpochSeconds());
    } catch {
      res.status(401).json({ error: { code: "P4_IDENTITY_REQUIRED" } });
      return;
    }
    let tenant;
    try {
      tenant = await resolveSyntheticTenantContext(actor, req.params.orgId, deps.memberships);
    } catch {
      res.status(403).json({ error: { code: "P4_TENANT_ACCESS_DENIED" } });
      return;
    }
    try {
      const settings = await readP4VerifiedWorkspaceSettings(deps.tenantPool, tenant, "p4_synthetic_ci_runtime");
      res.status(200).json({ scope: "synthetic-ci-only", settings });
    } catch {
      res.status(403).json({ error: { code: "P4_TENANT_ACCESS_DENIED" } });
    }
  });
  return router;
}
