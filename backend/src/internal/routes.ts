import { Router, type Request, type Response, type NextFunction } from "express";
import { InternalApiError, type VerifiedPreviewActor } from "./contracts.js";
import { InternalLeadService } from "./service.js";
import type { LeadRepository } from "./repository.js";

/**
 * P3.16: the real service is ONLY mountable via an explicitly injected
 * TEST-ONLY trusted resolver. The normal server never supplies this adapter.
 * Do not add request-header => identity conversion to production code.
 */
export interface InternalPreviewTestAdapter {
  readonly scope: "TEST_ONLY_FICTIONAL_RECORDS";
  readonly repo: LeadRepository;
  resolveVerifiedActor(request: Request): Promise<VerifiedPreviewActor | null>;
}

export function createInternalPreviewRouter(adapter: InternalPreviewTestAdapter): Router {
  if (adapter.scope !== "TEST_ONLY_FICTIONAL_RECORDS") {
    throw new Error("Fictional internal preview adapter must be test-only");
  }
  const router = Router();
  const service = new InternalLeadService(adapter.repo);
  router.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  type Handler = (req: Request, actor: VerifiedPreviewActor | null) => unknown | Promise<unknown>;
  const safe = (fn: Handler, success = 200) =>
    async (req: Request, res: Response, _next: NextFunction) => {
      try {
        const actor = await adapter.resolveVerifiedActor(req);
        const payload = await fn(req, actor);
        // Replayed creates/advances return 200, first creates return 201.
        const status = success === 201 && typeof payload === "object" && payload !== null &&
          "replayed" in payload && payload.replayed === true ? 200 : success;
        res.status(status).json(payload);
      } catch (error: unknown) {
        if (error instanceof InternalApiError) {
          res.status(error.httpStatus).json({ error: { code: error.code, message: "Request not permitted" } });
          return;
        }
        // Do not leak third-party resolver errors, credentials, request body or stack.
        res.status(503).json({ error: { code: "UNAVAILABLE", message: "Service unavailable" } });
      }
    };

  router.get("/:orgId/leads", safe((req, actor) => service.list(actor, req.params.orgId)));
  router.get("/:orgId/leads/:leadId", safe((req, actor) =>
    service.read(actor, req.params.orgId, req.params.leadId)));
  router.post("/:orgId/leads", safe((req, actor) =>
    service.create(actor, req.params.orgId, req.body, req.header("Idempotency-Key")), 201));
  router.patch("/:orgId/leads/:leadId", safe((req, actor) =>
    service.advance(actor, req.params.orgId, req.params.leadId,
      req.body, req.header("If-Match"), req.header("Idempotency-Key"))));
  return router;
}
