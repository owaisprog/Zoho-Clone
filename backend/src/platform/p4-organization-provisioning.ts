import { randomUUID } from "node:crypto";

/**
 * P4.05 TEST-ONLY atomic organization creation contract.
 * Never mount it on public Express until verified Auth0 subject -> internal user
 * mapping, unique DB constraints, P4 membership checks and real RLS are approved.
 */
export interface TrustedSyntheticOrganizationActor {
  userId: string;
  providerVerified: true;
  emailVerified: true;
}
export interface OrganizationProvisionInput {
  name: string;
  slug: string;
}
export interface OrganizationCreated {
  id: string;
  slug: string;
  name: string;
  ownerUserId: string;
}

export class OrganizationProvisionRejectedError extends Error {
  constructor() { super("P4_ORGANIZATION_PROVISION_REJECTED"); }
}
export class OrganizationSlugConflictError extends Error {
  constructor() { super("P4_ORGANIZATION_SLUG_TAKEN"); }
}
export class OrganizationPersistenceError extends Error {
  constructor() { super("P4_ORGANIZATION_PERSISTENCE_UNAVAILABLE"); }
}
export interface OrganizationProvisionTransaction {
  /**
   * Must perform INSERT protected by a database UNIQUE(slug) constraint.
   * Return false for an existing slug. A prior SELECT alone is NOT safe
   * against concurrency and must not be used for authoritative reservation.
   */
  insertOrganization(record: { id: string; slug: string; name: string; createdBy: string }): Promise<boolean>;
  insertOwnerMembership(record: {
    organizationId: string;
    userId: string;
    role: "OWNER";
    active: true;
  }): Promise<void>;
}
export interface OrganizationProvisionRepository {
  /** Commit both inserts atomically, roll back both on ANY thrown error. */
  transaction<T>(operation: (tx: OrganizationProvisionTransaction) => Promise<T>): Promise<T>;
}

export function validateSyntheticOrganizationInput(input: unknown): Readonly<OrganizationProvisionInput> {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new OrganizationProvisionRejectedError();
  const raw = input as Record<string, unknown>;
  if (Object.keys(raw).sort().join(",") !== "name,slug" ||
      typeof raw.name !== "string" ||
      !/^Demo [A-Za-z][A-Za-z0-9 &'-]{2,48}$/.test(raw.name) ||
      typeof raw.slug !== "string" ||
      raw.slug.length > 48 ||
      !/^demo-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(raw.slug) ||
      /^(?:demo-admin|demo-support|demo-system)$/.test(raw.slug)) {
    throw new OrganizationProvisionRejectedError();
  }
  return Object.freeze({ name: raw.name, slug: raw.slug });
}

export async function provisionSyntheticOrganization(
  actor: TrustedSyntheticOrganizationActor,
  input: unknown,
  repo: OrganizationProvisionRepository,
  nextId: () => string = randomUUID,
): Promise<OrganizationCreated> {
  if (actor.providerVerified !== true || actor.emailVerified !== true ||
      !/^user_demo_[a-z]{2,16}$/.test(actor.userId)) throw new OrganizationProvisionRejectedError();
  const { name, slug } = validateSyntheticOrganizationInput(input);
  const id = nextId();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new OrganizationProvisionRejectedError();
  }
  try {
    return await repo.transaction(async tx => {
      const inserted = await tx.insertOrganization({ id, slug, name, createdBy: actor.userId });
      if (!inserted) throw new OrganizationSlugConflictError();
      await tx.insertOwnerMembership({
        organizationId: id,
        userId: actor.userId,
        role: "OWNER",
        active: true,
      });
      return { id, slug, name, ownerUserId: actor.userId };
    });
  } catch (error) {
    if (error instanceof OrganizationSlugConflictError) throw error;
    // Do not expose SQL errors, secret connection details or actor records.
    throw new OrganizationPersistenceError();
  }
}
