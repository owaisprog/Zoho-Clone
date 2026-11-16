import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { authorizePreview, visibleLeadPredicate } from "../src/internal/policy.js";
import {
  InternalApiError, assertStageTransition, parseLeadCreate, parseLeadPatch,
  parseExpectedVersion, parseIdempotencyKey, projectLead,
} from "../src/internal/contracts.js";
import { createFictionalLeadRepository } from "../src/internal/fixtures.js";

const actor = { userId: "user_demo_alice", verified: true } as const;

describe("P3.13/14/15 provisional tenant & field policy", () => {
  it("requires verified actor AND fresh active membership for each operation", () => {
    const repo = createFictionalLeadRepository();
    const member = repo.findMembership("org_demo_orchid", actor.userId);
    assert.ok(member);
    assert.equal(authorizePreview(actor, member, "org_demo_orchid", "read").canEdit, true);
    assert.throws(() => authorizePreview(null, member, "org_demo_orchid", "read"), (error: unknown) =>
      error instanceof InternalApiError && error.httpStatus === 401);
    assert.throws(() => authorizePreview(actor, undefined, "org_demo_cedar", "read"), (error: unknown) =>
      error instanceof InternalApiError && error.httpStatus === 404);
    repo.setMembershipActive("org_demo_orchid", actor.userId, false);
    assert.throws(() => authorizePreview(actor,
      repo.findMembership("org_demo_orchid", actor.userId), "org_demo_orchid", "write"), (error: unknown) =>
      error instanceof InternalApiError && error.httpStatus === 404);
  });

  it("does not grant business record access to ordinary org admin alone", () => {
    const repo = createFictionalLeadRepository();
    const admin = { userId: "user_demo_admin", verified: true } as const;
    const member = repo.findMembership("org_demo_orchid", admin.userId);
    assert.throws(() => authorizePreview(admin, member, "org_demo_orchid", "read"), (error: unknown) =>
      error instanceof InternalApiError && error.httpStatus === 403);
  });

  it("pushes tenant and ownership restrictions into repository row selection", () => {
    const repo = createFictionalLeadRepository();
    const member = repo.findMembership("org_demo_orchid", actor.userId);
    const ctx = authorizePreview(actor, member, "org_demo_orchid", "read");
    const rows = repo.select(ctx.orgId, visibleLeadPredicate(ctx));
    assert.deepEqual(rows.map(row => row.id), ["LEAD-DEMO-201"]);
    assert.equal(repo.selectById(ctx.orgId, "LEAD-DEMO-301", visibleLeadPredicate(ctx)), undefined);
    assert.equal(repo.selectById(ctx.orgId, "LEAD-DEMO-202", visibleLeadPredicate(ctx)), undefined);
  });

  it("projects only approved fields to read-only sales users", () => {
    const repo = createFictionalLeadRepository();
    const bob = { userId: "user_demo_bob", verified: true } as const;
    const ctx = authorizePreview(bob, repo.findMembership("org_demo_orchid", bob.userId), "org_demo_orchid", "read");
    assert.equal(ctx.canReadContact, false);
    assert.equal(ctx.canEdit, false);
    const row = repo.select("org_demo_orchid", visibleLeadPredicate(ctx))[0];
    assert.ok(row);
    assert.deepEqual(Object.keys(projectLead(row, false)).sort(), ["id","organization","stage","version"]);
    assert.throws(() => authorizePreview(bob, ctx.membership, ctx.orgId, "write"), (error: unknown) =>
      error instanceof InternalApiError && error.httpStatus === 403);
  });

  it("denies unsupported attributes, real addresses and non-sequential transitions", () => {
    assert.deepEqual(parseLeadCreate({ organization: "Demo Sample Store", contact: "Example Person", email: "sample@example.com" }),
      { organization: "Demo Sample Store", contact: "Example Person", email: "sample@example.com" });
    assert.throws(() => parseLeadCreate({
      organization:"Demo Sample Store", contact:"Example Person", email:"real@corp.com",
    }));
    assert.throws(() => parseLeadCreate({
      organization:"Demo Sample Store", contact:"Example Person", email:"sample@example.com", tenantId:"org_demo_cedar",
    }));
    assert.throws(() => parseLeadPatch({stage:"qualified", role:"ADMIN"}));
    assert.deepEqual(parseLeadPatch({stage:"contacted"}), {stage:"contacted"});
    assert.equal(parseExpectedVersion('"2"'), 2);
    assert.throws(() => parseExpectedVersion("2"));
    assert.equal(parseIdempotencyKey("DEMO-req-01234"), "DEMO-req-01234");
    assert.throws(() => parseIdempotencyKey("real-customer-key"));
    assert.doesNotThrow(() => assertStageTransition("new", "contacted"));
    assert.throws(() => assertStageTransition("new", "qualified"), (error: unknown) =>
      error instanceof InternalApiError && error.httpStatus === 422);
  });

  it("repository returns copies rather than leaking live references", () => {
    const repo = createFictionalLeadRepository();
    const ctx = authorizePreview(actor, repo.findMembership("org_demo_orchid", actor.userId), "org_demo_orchid", "read");
    const rows = repo.select(ctx.orgId, visibleLeadPredicate(ctx));
    const mutable = rows[0];
    assert.ok(mutable);
    mutable.organization = "Demo Corrupted";
    const after = repo.select(ctx.orgId, visibleLeadPredicate(ctx));
    assert.equal(after[0]?.organization, "Demo Orchid Shops");
  });
});
