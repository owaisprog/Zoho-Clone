/**
 * P4 test-only API composition: injected verified Auth0 SDK evidence
 * -> segregated subject lookup -> UUIDv4 -> fresh Prisma membership/RLS
 * -> app entitlement AND role permission -> data projection.
 *
 * NEVER mount into backend/src/app.ts or run with customer traffic.
 * No email-only lookup, JWT role, arbitrary headers, mutable APIs,
 * uploads, downloads, workers, or public production endpoints.
 */
import { Router, type Request } from "express";
import type { PrismaClient } from "../generated/p4-v1-ci/client.js";
import type { P4VerifiedProviderToken } from "./p4-auth0-subject-bridge.js";
import {
  resolveP4V1CiActor, type P4V1CiIdentityLookup,
} from "./p4-v1-ci-identity.js";
import {
  readP4V1CiAppManifest, readP4V1CiAuthorizedApp,
} from "./p4-v1-ci-authorized-app.js";
import { assertP4V1CiPrismaEnvironment } from "./p4-v1-ci-prisma.js";

export type P4V1CiRouterDependencies = Readonly<{
  prisma: PrismaClient;
  mappingLookup: P4V1CiIdentityLookup;
  resolveVerifiedSdkEvidence(req: Request): Promise<P4VerifiedProviderToken | null>;
  expectedIssuer: string;
  expectedAudience: string;
  nowEpochSeconds(): number;
  env: NodeJS.ProcessEnv;
}>;
export function createP4V1CiTestOnlyRouter(deps: P4V1CiRouterDependencies) {
  // Tests inject a token that stands in for *already authenticated* SDK
  // claims. A raw JWT/header/body can NEVER supply this proof.
  if (process.env.NODE_ENV === "production") {
    throw new Error("P4 CI-only router cannot be mounted in production");
  }
  assertP4V1CiPrismaEnvironment(deps.env);
  if (typeof deps.resolveVerifiedSdkEvidence !== "function" ||
      typeof deps.nowEpochSeconds !== "function") {
    throw new Error("P4 CI-only router requires trusted test middleware");
  }
  const router = Router();
  async function authAndRead(
    req: Request, res: import("express").Response, appOnly: boolean,
  ) {
    res.setHeader("Cache-Control","no-store");
    let actorId: string;
    try {
      actorId = await resolveP4V1CiActor(
        await deps.resolveVerifiedSdkEvidence(req),
        { issuer: deps.expectedIssuer, audience: deps.expectedAudience },
        deps.mappingLookup, deps.nowEpochSeconds(),
      );
    } catch {
      res.status(401).json({ error: { code: "P4_IDENTITY_REQUIRED" } });
      return;
    }
    try {
      const scope = { actorId, organizationId: req.params.orgId };
      if (appOnly) {
        const data = await readP4V1CiAuthorizedApp(
          deps.prisma, scope, req.params.appCode, deps.env,
        );
        res.status(200).json({ scope: "disposable-ci-only", data });
      } else {
        const data = await readP4V1CiAppManifest(deps.prisma, scope, deps.env);
        res.status(200).json({ scope: "disposable-ci-only", data });
      }
    } catch {
      res.status(403).json({ error: { code: "P4_ACCESS_DENIED" } });
    }
  }
  router.get("/:orgId/apps", async (req,res) => authAndRead(req,res,false));
  router.get("/:orgId/apps/:appCode", async (req,res) => authAndRead(req,res,true));
  return router;
}
