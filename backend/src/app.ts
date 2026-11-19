import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import express, { type ErrorRequestHandler, type RequestHandler } from "express";
import helmet from "helmet";
import { demoApplications, demoLeads, demoTasks } from "./demo-fixtures.js";
import { DEMO_CONTRACT } from "@zoho-clone/demo-contracts";
import { createInternalPreviewRouter, type InternalPreviewTestAdapter } from "./internal/routes.js";
import { auth0IdentityCheckMiddleware } from "./auth/auth0-api.js";
import { categorizeHttpSample, type SafeRequestMetrics } from "./platform/observability.js";

export const API_VERSION = "v1" as const;

export function createApp(options: {
  internalPreview?: InternalPreviewTestAdapter;
  /** Production readiness is denied until an authorized dependency probe is installed. */
  readinessProbe?: () => Promise<boolean>;
  /** Receives JSON with request ID, HTTP method, status and duration ONLY. */
  logRequest?: (entry: string) => void;
  /** Bounded internal-only metrics sink; never available through HTTP routes. */
  metrics?: SafeRequestMetrics;
} = {}) {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(express.json({ limit: "16kb", strict: true }));

  // P3.11: server-generated ID. Never trust a caller-supplied request ID or log
  // paths, query strings, payloads, IPs or headers (they may contain secrets).
  app.use((_req, res, next) => {
    const requestId = randomUUID();
    const startedAt = performance.now();
    res.setHeader("X-Request-Id", requestId);
    res.once("finish", () => {
      const durationMs = Math.max(0, Math.round(performance.now() - startedAt));
      options.metrics?.observe(_req.method, res.statusCode, durationMs);
      const safeMethod = categorizeHttpSample(_req.method, res.statusCode, durationMs).method;
      const entry = JSON.stringify({
        event: "http.request.finished",
        requestId,
        method: safeMethod,
        status: res.statusCode,
        durationMs,
      });
      (options.logRequest ?? console.info)(entry);
    });
    next();
  });

  const noStore: RequestHandler = (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  };

  // Process liveness only: NOT readiness, authorization, or database health.
  app.get("/api/v1/health", noStore, (_req, res) => {
    res.status(200).json({
      status: "ok",
      service: "zoho-clone-api",
      version: API_VERSION,
      scope: "synthetic-only",
      checks: { process: "up" },
    });
  });

  // P3.04: process liveness is not dependency or database readiness.
  app.get("/health/live", noStore, (_req, res) => {
    res.status(200).json({ status: "alive", scope: "synthetic-only" });
  });

  // Fail closed until a real provider/database connectivity probe is supplied.
  // This MUST NOT be bypassed when preparing an external or paid release.
  app.get("/health/ready", noStore, async (_req, res) => {
    let ready = false;
    try {
      ready = (await options.readinessProbe?.()) === true;
    } catch {
      // Do not leak readiness dependencies, connection strings or error detail.
    }
    res.status(ready ? 200 : 503).json({
      status: ready ? "ready" : "not_ready",
      scope: "synthetic-only",
    });
  });

  // P3.02: Fixed, publicly readable, FICTIONAL demo fixtures. No protected CRUD.
  // Local bind restrictions in config.ts remain required; this is not a real CRM API.
  app.get("/api/v1/demo/leads", noStore, (_req, res) => {
    res.status(200).json({ contract: DEMO_CONTRACT, scope: "synthetic-only", dataset: "leads", records: demoLeads });
  });

  app.get("/api/v1/demo/applications", noStore, (_req, res) => {
    res.status(200).json({ contract: DEMO_CONTRACT, scope: "synthetic-only", dataset: "applications", records: demoApplications });
  });

  // Fixed synthetic tasks only; this does not implement an authenticated work API.
  app.get("/api/v1/demo/tasks", noStore, (_req, res) => {
    res.status(200).json({ contract: DEMO_CONTRACT, scope: "synthetic-only", dataset: "tasks", records: demoTasks });
  });

  // P3.13: verified Auth0 API access-token endpoint. Authentication is NOT
  // membership or record authorization; never mount business CRUD on this path.
  // Missing Auth0 configuration fails closed with 503.
  app.get("/api/v1/auth/check", noStore, auth0IdentityCheckMiddleware(), (_req, res) => {
    res.status(200).json({
      status: "authenticated",
      scope: "identity-only",
      organizationAccess: false,
    });
  });

  // P3.16: PRODUCTION SERVER MUST NEVER MOUNT THIS internal test route.
  // A future verified provider, tenant policy and Prisma adapter require
  // owner-approved OPEN-001/002/003 choices and separate release gates.
  if (options.internalPreview) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Internal fictional preview routes cannot run in production");
    }
    app.use("/api/v1/internal/organizations", createInternalPreviewRouter(options.internalPreview));
  }

  // No real /api/v1/organizations, CRM, merchant, payments, KYC or public writes.
  app.use(noStore, (_req, res) => {
    res.status(404).json({
      error: { code: "NOT_FOUND", message: "Endpoint is not available" },
    });
  });

  const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    // Never echo errors, request bodies, credentials, or stack traces to callers.
    const code = typeof error === "object" && error !== null && "type" in error
      ? (error as { type?: unknown }).type : undefined;
    if (code === "entity.too.large") {
      res.status(413).json({ error: { code: "PAYLOAD_TOO_LARGE", message: "Request exceeds size limit" } });
      return;
    }
    // Do not reveal token verification or JWKS details to the caller.
    if (typeof error === "object" && error !== null && "status" in error &&
        (error as { status: unknown }).status === 401) {
      res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Authentication required" } });
      return;
    }
    if (error instanceof SyntaxError && "body" in error) {
      res.status(400).json({ error: { code: "INVALID_JSON", message: "Invalid JSON body" } });
      return;
    }
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Request could not be processed" } });
  };
  app.use(errorHandler);

  return app;
}

export type ApiApp = ReturnType<typeof createApp>;
