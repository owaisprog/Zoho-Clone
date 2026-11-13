import express, { type ErrorRequestHandler, type RequestHandler } from "express";
import helmet from "helmet";

export const API_VERSION = "v1" as const;

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(express.json({ limit: "16kb", strict: true }));

  const noStore: RequestHandler = (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  };

  // This is the ONLY public endpoint in P3.01. It checks process health,
  // not database readiness, permission enforcement, or external integrations.
  app.get("/api/v1/health", noStore, (_req, res) => {
    res.status(200).json({
      status: "ok",
      service: "zoho-clone-api",
      version: API_VERSION,
      scope: "synthetic-only",
      checks: { process: "up" },
    });
  });

  // Explicitly no /api/v1/organizations, CRM, payments, KYC or merchant API yet.
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
