/**
 * OWNER-APPROVED ADR 0008 P4 implementation; TEST-ONLY Express adapter.
 * This deliberately is NEVER imported from backend/src/app.ts.
 * Synthetic token evidence injected by CI tests is not a real Auth0 login.
 * No write, export, storage/download, admin or customer-facing routes.
 */
import { Router, type Request } from "express";
import type { PrismaClient } from "../generated/p4-r7-ci/client.js";
import type { P4VerifiedProviderToken } from "./p4-auth0-subject-bridge.js";
import {
  resolveP4V1CiActor,
  type P4V1CiIdentityLookup,
} from "./p4-v1-ci-identity.js";
import {
  readP4R7CiLead, readP4R7CiLeads,
} from "./p4-r7-ci-prisma-reader.js";
import { assertP4V1CiPrismaEnvironment } from "./p4-v1-ci-prisma.js";

export type P4R8CiRouterDeps = Readonly<{
  prisma: PrismaClient;
  mappingLookup: P4V1CiIdentityLookup;
  resolveVerifiedSdkEvidence(req: Request): Promise<P4VerifiedProviderToken | null>;
  expectedIssuer: string;
  expectedAudience: string;
  nowEpochSeconds(): number;
}>;

/** Refuse to mount outside the actual disposable GitHub Actions environment. */
export function createP4R8CiTestRouter(deps: P4R8CiRouterDeps): Router {
  assertP4V1CiPrismaEnvironment(process.env);
  if (process.env.NODE_ENV === "production" ||
      typeof deps?.resolveVerifiedSdkEvidence !== "function" ||
      typeof deps.nowEpochSeconds !== "function") {
    throw new Error("P4_R8_CI_ROUTER_DISABLED");
  }
  const router = Router();
  async function handle(req: Request, res: import("express").Response, single: boolean) {
    res.setHeader("Cache-Control", "no-store");
    let actorId: string;
    try {
      // SDK evidence is injected by GitHub CI; not cryptographically verified
      // here. A live Auth0 middleware still requires owner approval and review.
      actorId = await resolveP4V1CiActor(
        await deps.resolveVerifiedSdkEvidence(req),
        { issuer: deps.expectedIssuer, audience: deps.expectedAudience },
        deps.mappingLookup,
        deps.nowEpochSeconds(),
      );
    } catch {
      res.status(401).json({ error: { code: "P4_IDENTITY_REQUIRED" } });
      return;
    }
    const orgId = req.params.orgId;
    if (typeof orgId !== "string") {
      res.status(403).json({ error: { code: "P4_ACCESS_DENIED" } });
      return;
    }
    try {
      const scope = { organizationId: orgId, actorId };
      if (single) {
        const result = await readP4R7CiLead(
          deps.prisma, scope, req.params.leadId, process.env,
        );
        res.status(200).json({ scope: "disposable-ci-only", data: result });
      } else {
        const result = await readP4R7CiLeads(deps.prisma, scope, process.env);
        res.status(200).json({ scope: "disposable-ci-only", data: result });
      }
    } catch {
      // No existence disclosure: same response for missing/forbidden records.
      res.status(403).json({ error: { code: "P4_ACCESS_DENIED" } });
    }
  }
  router.get("/:orgId/crm/leads", async (req,res) => handle(req,res,false));
  router.get("/:orgId/crm/leads/:leadId", async (req,res) => handle(req,res,true));
  return router;
}
