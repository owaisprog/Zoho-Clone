import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  provisionSyntheticOrganization, validateSyntheticOrganizationInput,
  OrganizationProvisionRejectedError, OrganizationSlugConflictError, OrganizationPersistenceError,
  type OrganizationProvisionRepository, type OrganizationCreated,
} from "../src/platform/p4-organization-provisioning.js";

type Org = { id: string; name: string; slug: string; createdBy: string };
type Member = { organizationId: string; userId: string; role: "OWNER"; active: true };

function makeTransactionalStore() {
  let organizations = new Map<string, Org>();
  let members: Member[] = [];
  let failMembership = false;
  const repo: OrganizationProvisionRepository = {
    async transaction(operation) {
      const shadow = new Map(organizations);
      const staged = [...members];
      const result = await operation({
        async insertOrganization(record) {
          if (shadow.has(record.slug)) return false;
          shadow.set(record.slug, record);
          return true;
        },
        async insertOwnerMembership(record) {
          if (failMembership) throw new Error("PRIVATE POSTGRES ERROR WITH SECRET");
          staged.push(record);
        },
      });
      organizations = shadow;
      members = staged;
      return result;
    },
  };
  return {
    repo,
    get organizations() { return [...organizations.values()]; },
    get members() { return [...members]; },
    failMembership: (value: boolean) => { failMembership = value; },
  };
}
const alice = { userId: "user_demo_alice", providerVerified: true as const, emailVerified: true as const };
const bob = { userId: "user_demo_bob", providerVerified: true as const, emailVerified: true as const };
const id1 = "10000000-0000-4000-8000-000000000001";
const id2 = "10000000-0000-4000-8000-000000000002";

describe("P4.05 synthetic atomic organization + owner membership contract", () => {
  it("creates an isolated tenant and owner membership in a single commit", async () => {
    const store = makeTransactionalStore();
    const result: OrganizationCreated = await provisionSyntheticOrganization(
      alice, { name: "Demo Maple Payments", slug: "demo-maple-payments" }, store.repo, () => id1,
    );
    assert.deepEqual(result, { id: id1, name: "Demo Maple Payments", slug: "demo-maple-payments", ownerUserId: alice.userId });
    assert.deepEqual(store.organizations, [{ id: id1, slug: result.slug, name: result.name, createdBy: alice.userId }]);
    assert.deepEqual(store.members, [{ organizationId: id1, userId: alice.userId, role: "OWNER", active: true }]);

    await provisionSyntheticOrganization(bob, { name: "Demo Elm Commerce", slug: "demo-elm-commerce" }, store.repo, () => id2);
    assert.equal(store.organizations.length, 2);
    assert.equal(store.members.filter(m => m.organizationId === id1 && m.userId === bob.userId).length, 0);
    assert.equal(store.members.filter(m => m.organizationId === id2 && m.userId === alice.userId).length, 0);
  });

  it("rejects slug conflicts without adding an unintended membership", async () => {
    const store = makeTransactionalStore();
    await provisionSyntheticOrganization(alice, { name: "Demo Maple Payments", slug: "demo-maple-payments" }, store.repo, () => id1);
    await assert.rejects(
      provisionSyntheticOrganization(bob, { name: "Demo Different", slug: "demo-maple-payments" }, store.repo, () => id2),
      OrganizationSlugConflictError,
    );
    assert.equal(store.organizations.length, 1);
    assert.equal(store.members.length, 1);
  });

  it("rolls back both inserts after membership failure without leaking private database details", async () => {
    const store = makeTransactionalStore();
    store.failMembership(true);
    await assert.rejects(
      provisionSyntheticOrganization(alice, { name: "Demo Maple Payments", slug: "demo-maple-payments" }, store.repo, () => id1),
      error => error instanceof OrganizationPersistenceError && !error.message.includes("POSTGRES"),
    );
    assert.deepEqual(store.organizations, []);
    assert.deepEqual(store.members, []);
  });

  it("blocks unverified people, forged owner grants and non-synthetic tenant fields", async () => {
    const store = makeTransactionalStore();
    for (const input of [
      { name: "Real Shop", slug: "real-shop" },
      { name: "Demo Maple Payments", slug: "DEMO-maple" },
      { name: "Demo Maple Payments", slug: "demo-admin" },
      { name: "Demo Maple Payments", slug: "demo--maple" },
      { name: "Demo Maple Payments", slug: "demo-maple", role: "ORG_ADMIN" },
      { name: "Demo Maple Payments", slug: "demo-maple", ownerUserId: bob.userId },
      { name: "Demo Maple Payments", slug: "../secret" },
    ]) assert.throws(() => validateSyntheticOrganizationInput(input), OrganizationProvisionRejectedError);
    await assert.rejects(
      provisionSyntheticOrganization({ ...alice, emailVerified: false as never },
        { name: "Demo Maple Payments", slug: "demo-maple" }, store.repo, () => id1),
      OrganizationProvisionRejectedError,
    );
    assert.equal(store.organizations.length, 0);
  });
});
