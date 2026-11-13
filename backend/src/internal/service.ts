import {
  InternalApiError, assertStageTransition, parseDemoId,
  parseExpectedVersion, parseIdempotencyKey, parseLeadCreate, parseLeadPatch,
  projectLead, type VerifiedPreviewActor,
} from "./contracts.js";
import { authorizePreview, visibleLeadPredicate } from "./policy.js";
import type { LeadRepository } from "./repository.js";

/**
 * P3.15–P3.16: fully functional INTERNAL service layer using a pluggable
 * repository, but only the in-memory fictional adapter exists today.
 *
 * Every call reloads current membership and builds a scoped query predicate;
 * no client-supplied roles, ownership, org proof, or field projection.
 */
export class InternalLeadService {
  constructor(private readonly repo: LeadRepository) {}

  private context(actor: VerifiedPreviewActor | null, rawOrgId: unknown, action: "read" | "write") {
    const orgId = parseDemoId(rawOrgId, "org");
    const membership = actor?.verified ? this.repo.findMembership(orgId, actor.userId) : undefined;
    return authorizePreview(actor, membership, orgId, action);
  }

  list(actor: VerifiedPreviewActor | null, rawOrgId: unknown) {
    const ctx = this.context(actor, rawOrgId, "read");
    const data = this.repo.select(ctx.orgId, visibleLeadPredicate(ctx))
      .map(row => projectLead(row, ctx.canReadContact));
    // Aggregates must count ONLY authorized rows. No unrestricted totals.
    return { scope: "synthetic-only" as const, data, count: data.length };
  }
  read(actor: VerifiedPreviewActor | null, rawOrgId: unknown, rawId: unknown) {
    const ctx = this.context(actor, rawOrgId, "read");
    const id = parseDemoId(rawId, "lead");
    const row = this.repo.selectById(ctx.orgId, id, visibleLeadPredicate(ctx));
    if (!row) throw new InternalApiError(404, "NOT_FOUND");
    return { scope: "synthetic-only" as const, data: projectLead(row, ctx.canReadContact) };
  }
  create(actor: VerifiedPreviewActor | null, rawOrgId: unknown, rawBody: unknown, rawKey: unknown) {
    const ctx = this.context(actor, rawOrgId, "write");
    const key = parseIdempotencyKey(rawKey);
    const draft = parseLeadCreate(rawBody);
    const dedupeKey = [ctx.orgId, ctx.actor.userId, "create", key].join("|");
    const fingerprint = JSON.stringify(draft);
    const result = this.repo.replayOnce(dedupeKey, fingerprint, () =>
      this.repo.insert(ctx.orgId, ctx.actor.userId, draft));
    return {
      scope: "synthetic-only" as const,
      data: projectLead(result.value, ctx.canReadContact),
      replayed: result.replayed,
    };
  }
  advance(
    actor: VerifiedPreviewActor | null, rawOrgId: unknown, rawId: unknown,
    rawBody: unknown, rawVersion: unknown, rawKey: unknown,
  ) {
    const ctx = this.context(actor, rawOrgId, "write");
    const id = parseDemoId(rawId, "lead");
    const key = parseIdempotencyKey(rawKey);
    const expectedVersion = parseExpectedVersion(rawVersion);
    const patch = parseLeadPatch(rawBody);
    const visible = visibleLeadPredicate(ctx);
    // Re-check record visibility on EVERY request, including idempotent replays.
    // Otherwise a once-authorized update could disclose a now-revoked record.
    if (!this.repo.selectById(ctx.orgId, id, visible)) {
      throw new InternalApiError(404, "NOT_FOUND");
    }
    // The idempotency identity and semantic fingerprint scope to verified user,
    // verified membership/tenant, resource, operation and requested change.
    const dedupeKey = [ctx.orgId, ctx.actor.userId, "advance", id, key].join("|");
    const fingerprint = JSON.stringify({ expectedVersion, patch });
    const result = this.repo.replayOnce(dedupeKey, fingerprint, () => {
      const current = this.repo.selectById(ctx.orgId, id, visible);
      if (!current) throw new InternalApiError(404, "NOT_FOUND");
      // Deliberately check version before stage semantics: no stale data signal.
      if (current.version !== expectedVersion) throw new InternalApiError(409, "CONFLICT");
      assertStageTransition(current.stage, patch.stage);
      return this.repo.transition(ctx.orgId, id, expectedVersion, patch.stage, visible);
    });
    return {
      scope: "synthetic-only" as const,
      data: projectLead(result.value, ctx.canReadContact),
      replayed: result.replayed,
    };
  }
}
