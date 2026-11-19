import type { Request, RequestHandler } from "express";
import {
  requireTrustedSyntheticMember, resolveSyntheticTenantContext,
  type MembershipLookup, type TrustedSyntheticMemberActor, type VerifiedSyntheticTenant,
} from "./p4-membership.js";

/**
 * P4.10: test-only Express tenant resolution boundary.
 * A real protected route MUST use cryptographically verified Auth0 identity
 * mapped to internal user ID; never caller-controlled headers or JWT roles.
 * This middleware is NOT mounted in backend/src/app.ts.
 */
export interface SyntheticTrustedIdentityResolver {
  resolve(req: Request): Promise<TrustedSyntheticMemberActor | null>;
}
export function createSyntheticTenantContextMiddleware(
  identity: SyntheticTrustedIdentityResolver,
  memberships: MembershipLookup,
): RequestHandler {
  return async (req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    let actor: TrustedSyntheticMemberActor | null;
    try {
      actor = await identity.resolve(req);
      if (!actor) {
        res.status(401).json({ error: { code: "P4_IDENTITY_REQUIRED" } });
        return;
      }
      requireTrustedSyntheticMember(actor);
    } catch {
      res.status(401).json({ error: { code: "P4_IDENTITY_REQUIRED" } });
      return;
    }

    try {
      // A requested org ID is a lookup key, NEVER proof of permission.
      // The repository must check fresh active membership for actor+org.
      const verified: VerifiedSyntheticTenant =
        await resolveSyntheticTenantContext(actor, req.params.orgId, memberships);
      res.locals.p4SyntheticTenant = verified;
      next();
    } catch {
      res.status(403).json({ error: { code: "P4_TENANT_ACCESS_DENIED" } });
    }
  };
}
