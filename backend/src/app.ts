import express, { type ErrorRequestHandler, type RequestHandler } from "express";
import helmet from "helmet";
import { demoApplications, demoLeads, demoTasks } from "./demo-fixtures.js";
import { DEMO_CONTRACT } from "@zoho-clone/demo-contracts";
import { createInternalPreviewRouter, type InternalPreviewTestAdapter } from "./internal/routes.js";

export const API_VERSION = "v1" as const;

export function createApp(options: { internalPreview?: InternalPreviewTestAdapter } = {}) {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(express.json({ limit: "16kb", strict: true }));

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
