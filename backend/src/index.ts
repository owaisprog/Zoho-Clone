import express from "express";
import helmet from "helmet";

/**
 * Vercel function entrypoint. No listener, CI fixture modules, DB, token
 * verifier or worker. External activation still requires owner approval.
 */
export function createVercelApi(env: NodeJS.ProcessEnv = process.env) {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  const enabled = env.VERCEL === "1" && env.VERCEL_ENV === "preview" &&
    env.P4_VERCEL_SYNTHETIC_PREVIEW === "true";
  app.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    if (!enabled) {
      res.status(503).json({ status: "not_ready", scope: "synthetic-only" });
      return;
    }
    next();
  });
  app.get("/health/live", (_req, res) => {
    res.json({ status: "alive", scope: "synthetic-only" });
  });
  app.get("/api/v1/health", (_req, res) => {
    res.json({ status: "ok", service: "zoho-clone-api", version: "v1",
      scope: "synthetic-only", checks: { process: "up" } });
  });
  app.get("/health/ready", (_req, res) => {
    res.status(503).json({ status: "not_ready", scope: "synthetic-only" });
  });
  app.get("/api/v1/auth/check", (_req, res) => {
    res.status(503).json({ error: { code: "AUTH_NOT_CONFIGURED" } });
  });
  app.use((_req, res) => {
    res.status(404).json({ error: { code: "NOT_FOUND" } });
  });
  return app;
}

export default createVercelApi();
