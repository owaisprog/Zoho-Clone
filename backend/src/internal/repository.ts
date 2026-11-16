import {
  InternalApiError, type InternalLead, type LeadCreate, type LeadStage,
  type PreviewMembership,
} from "./contracts.js";

/**
 * P3.15: explicit repository boundary. This in-memory implementation
 * is ephemeral, only for synthetic integration tests. NOT Prisma/SQL.
 */
export interface LeadRepository {
  findMembership(orgId: string, userId: string): PreviewMembership | undefined;
  select(orgId: string, predicate: (row: InternalLead) => boolean): InternalLead[];
  selectById(orgId: string, id: string, predicate: (row: InternalLead) => boolean): InternalLead | undefined;
  insert(orgId: string, ownerId: string, draft: LeadCreate): InternalLead;
  transition(orgId: string, id: string, expectedVersion: number, stage: LeadStage, predicate: (row: InternalLead) => boolean): InternalLead;
  replayOnce<T>(key: string, fingerprint: string, action: () => T): { value: T; replayed: boolean };
}

export class InMemoryFictionalLeadRepository implements LeadRepository {
  private readonly leads: InternalLead[];
  private readonly members: PreviewMembership[];
  private readonly idempotency = new Map<string, {fingerprint: string; value: unknown}>();
  private sequence: number;

  constructor(leads: readonly InternalLead[], memberships: readonly PreviewMembership[]) {
    this.leads = leads.map(row => ({ ...row }));
    this.members = memberships.map(row => ({ ...row, roles: [...row.roles] }));
    this.sequence = Math.max(700, ...this.leads.map(row => {
      const match = /^LEAD-DEMO-(\d{3})$/.exec(row.id);
      return match ? Number(match[1]) : 0;
    }));
  }

  findMembership(orgId: string, userId: string): PreviewMembership | undefined {
    const item = this.members.find(row => row.orgId === orgId && row.userId === userId);
    return item ? { ...item, roles: [...item.roles] } : undefined;
  }
  // A synthetic revision mechanism lets integration tests prove next-request deny.
  setMembershipActive(orgId: string, userId: string, active: boolean): void {
    const item = this.members.find(row => row.orgId === orgId && row.userId === userId);
    if (item) item.active = active;
  }
  select(orgId: string, predicate: (row: InternalLead) => boolean): InternalLead[] {
    return this.leads.filter(row => row.orgId === orgId && predicate(row)).map(row => ({ ...row }));
  }
  selectById(orgId: string, id: string, predicate: (row: InternalLead) => boolean): InternalLead | undefined {
    const found = this.leads.find(row => row.orgId === orgId && row.id === id && predicate(row));
    return found ? { ...found } : undefined;
  }
  insert(orgId: string, ownerId: string, draft: LeadCreate): InternalLead {
    if (this.sequence >= 999) throw new InternalApiError(409, "CONFLICT");
    const record: InternalLead = {
      id: "LEAD-DEMO-" + ++this.sequence,
      orgId, ownerId,
      organization: draft.organization, contact: draft.contact, email: draft.email,
      stage: "new", version: 1,
    };
    this.leads.push(record);
    return { ...record };
  }
  transition(orgId: string, id: string, expectedVersion: number, stage: LeadStage, predicate: (row: InternalLead) => boolean): InternalLead {
    // Scoped row acquisition is mandatory BEFORE version and mutation.
    const found = this.leads.find(row => row.orgId === orgId && row.id === id && predicate(row));
    if (!found) throw new InternalApiError(404, "NOT_FOUND");
    if (found.version !== expectedVersion) throw new InternalApiError(409, "CONFLICT");
    found.stage = stage;
    found.version++;
    return { ...found };
  }
  replayOnce<T>(key: string, fingerprint: string, action: () => T): { value: T; replayed: boolean } {
    const previous = this.idempotency.get(key);
    if (previous) {
      if (previous.fingerprint !== fingerprint) throw new InternalApiError(409, "CONFLICT");
      return { value: previous.value as T, replayed: true };
    }
    const value = action();
    this.idempotency.set(key, { fingerprint, value });
    return { value, replayed: false };
  }
}
