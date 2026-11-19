import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  requireTrustedSyntheticMember, SyntheticMembershipDeniedError, SYNTHETIC_ORG_ID,
  type TrustedSyntheticMemberActor,
} from "./p4-membership.js";

/**
 * P4.08-09: strictly fictional invitation lifecycle, NOT mounted as a live API.
 * Only SHA-256 hashes are stored, never bearer invite tokens. SHA-256 is
 * appropriate here ONLY because tokens are generated with 256-bit entropy.
 * Real adapter must use unique constraints, row locks and atomic DB commits.
 */
export type SyntheticInvitationStatus = "pending" | "accepted" | "revoked";
export interface SyntheticInvitation {
  id: string;
  orgId: string;
  canonicalEmail: string;
  invitedByUserId: string;
  role: "MEMBER";
  tokenHash: string;
  status: SyntheticInvitationStatus;
  issuedAtMs: number;
  expiresAtMs: number;
  resendCount: number;
  version: number;
}
export interface SyntheticInvitationTransaction {
  getMembership(orgId: string, userId: string): Promise<{ role: "OWNER" | "MEMBER"; active: boolean } | null>;
  findPendingByEmail(orgId: string, canonicalEmail: string): Promise<SyntheticInvitation | null>;
  findById(inviteId: string): Promise<SyntheticInvitation | null>;
  findByTokenHash(tokenHash: string): Promise<SyntheticInvitation | null>;
  countRecentSends(orgId: string, senderId: string, sinceMs: number): Promise<number>;
  insertInvitation(invite: SyntheticInvitation): Promise<void>;
  replaceInvitation(invite: SyntheticInvitation): Promise<void>;
  /** Fail if user already has membership, including an inactive membership. */
  insertMembershipIfAbsent(orgId: string, userId: string, role: "MEMBER"): Promise<boolean>;
}
export interface SyntheticInvitationRepository {
  /** Must be serializable/row-locked where necessary, or changes roll back. */
  transaction<T>(callback: (tx: SyntheticInvitationTransaction) => Promise<T>): Promise<T>;
}
export interface TrustedSyntheticRecipient extends TrustedSyntheticMemberActor {
  /** Auth0-verified email, NEVER accepted from a browser form body. */
  verifiedEmail: string;
}

export class SyntheticInvitationRejectedError extends Error {
  constructor() { super("P4_INVITATION_DENIED"); }
}
export class SyntheticInvitationConflictError extends Error {
  constructor() { super("P4_INVITATION_CONFLICT"); }
}

const ISSUE_LIMIT_PER_HOUR = 5;
const INVITE_TTL_MS = 48 * 60 * 60 * 1000;
const MIN_RESEND_DELAY_MS = 60 * 1000;
const MAX_RESENDS = 3;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requireSyntheticNow(nowMs: number): void {
  if (!Number.isSafeInteger(nowMs) || nowMs <= 0) throw new SyntheticInvitationRejectedError();
}
function canonicalizeRecipient(input: unknown): string {
  if (typeof input !== "string" || input !== input.trim() || input.length > 180 ||
      !/^[a-z0-9._+%-]+@example\.com$/i.test(input)) throw new SyntheticInvitationRejectedError();
  return input.toLowerCase();
}
function tokenHash(input: unknown): string {
  if (typeof input !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(input)) throw new SyntheticInvitationRejectedError();
  return createHash("sha256").update(input, "utf8").digest("hex");
}
function requireOwner(actor: TrustedSyntheticMemberActor, orgId: unknown): string {
  try { requireTrustedSyntheticMember(actor); }
  catch { throw new SyntheticInvitationRejectedError(); }
  if (typeof orgId !== "string" || !SYNTHETIC_ORG_ID.test(orgId)) throw new SyntheticInvitationRejectedError();
  return orgId;
}
async function verifyOrgOwner(
  tx: SyntheticInvitationTransaction,
  orgId: string, actor: TrustedSyntheticMemberActor,
): Promise<void> {
  const member = await tx.getMembership(orgId, actor.userId);
  if (!member || member.active !== true || member.role !== "OWNER") {
    throw new SyntheticInvitationRejectedError();
  }
}
function requireInviteReady(invite: SyntheticInvitation | null, nowMs: number): SyntheticInvitation {
  if (!invite || invite.status !== "pending" || invite.expiresAtMs <= nowMs ||
      invite.expiresAtMs > invite.issuedAtMs + INVITE_TTL_MS ||
      invite.role !== "MEMBER" || !UUID_V4.test(invite.id) ||
      !SYNTHETIC_ORG_ID.test(invite.orgId)) throw new SyntheticInvitationRejectedError();
  return invite;
}

/** Return token ONLY to a future secure email adapter; never log or expose via API. */
export async function issueSyntheticInvitation(
  actor: TrustedSyntheticMemberActor,
  orgId: unknown,
  recipientEmail: unknown,
  repo: SyntheticInvitationRepository,
  nowMs: number,
  tokenFactory: () => string = () => randomBytes(32).toString("base64url"),
  idFactory: () => string = randomUUID,
): Promise<{ invitationId: string; tokenForEmailOnly: string; expiresAtMs: number }> {
  const scopedOrgId = requireOwner(actor, orgId);
  requireSyntheticNow(nowMs);
  const email = canonicalizeRecipient(recipientEmail);
  const token = tokenFactory();
  const hash = tokenHash(token);
  const id = idFactory();
  if (!UUID_V4.test(id)) throw new SyntheticInvitationRejectedError();
  return repo.transaction(async tx => {
    await verifyOrgOwner(tx, scopedOrgId, actor);
    const existing = await tx.findPendingByEmail(scopedOrgId, email);
    if (existing?.status === "pending" && existing.expiresAtMs > nowMs) {
      throw new SyntheticInvitationConflictError();
    }
    if (await tx.countRecentSends(scopedOrgId, actor.userId, nowMs - 60 * 60 * 1000) >= ISSUE_LIMIT_PER_HOUR) {
      throw new SyntheticInvitationRejectedError();
    }
    await tx.insertInvitation({
      id, orgId: scopedOrgId, canonicalEmail: email, invitedByUserId: actor.userId,
      role: "MEMBER", tokenHash: hash, status: "pending",
      issuedAtMs: nowMs, expiresAtMs: nowMs + INVITE_TTL_MS, resendCount: 0, version: 1,
    });
    return { invitationId: id, tokenForEmailOnly: token, expiresAtMs: nowMs + INVITE_TTL_MS };
  });
}

/** Rotates the invite token atomically so a previously emailed link stops working. */
export async function resendSyntheticInvitation(
  actor: TrustedSyntheticMemberActor,
  orgId: unknown,
  invitationId: unknown,
  repo: SyntheticInvitationRepository,
  nowMs: number,
  tokenFactory: () => string = () => randomBytes(32).toString("base64url"),
): Promise<{ invitationId: string; tokenForEmailOnly: string; expiresAtMs: number }> {
  const scopedOrgId = requireOwner(actor, orgId);
  requireSyntheticNow(nowMs);
  if (typeof invitationId !== "string" || !UUID_V4.test(invitationId)) throw new SyntheticInvitationRejectedError();
  const token = tokenFactory();
  const hash = tokenHash(token);
  return repo.transaction(async tx => {
    await verifyOrgOwner(tx, scopedOrgId, actor);
    const invite = requireInviteReady(await tx.findById(invitationId), nowMs);
    if (invite.orgId !== scopedOrgId || invite.resendCount >= MAX_RESENDS ||
        nowMs - invite.issuedAtMs < MIN_RESEND_DELAY_MS ||
        await tx.countRecentSends(scopedOrgId, actor.userId, nowMs - 60 * 60 * 1000) >= ISSUE_LIMIT_PER_HOUR) {
      throw new SyntheticInvitationRejectedError();
    }
    await tx.replaceInvitation({
      ...invite, tokenHash: hash, issuedAtMs: nowMs, expiresAtMs: nowMs + INVITE_TTL_MS,
      resendCount: invite.resendCount + 1, version: invite.version + 1,
    });
    return { invitationId: invite.id, tokenForEmailOnly: token, expiresAtMs: nowMs + INVITE_TTL_MS };
  });
}

/** One-use hash match + exact provider-verified recipient email + membership in one transaction. */
export async function acceptSyntheticInvitation(
  recipient: TrustedSyntheticRecipient,
  rawToken: unknown,
  repo: SyntheticInvitationRepository,
  nowMs: number,
): Promise<{ orgId: string; role: "MEMBER" }> {
  try { requireTrustedSyntheticMember(recipient); }
  catch { throw new SyntheticInvitationRejectedError(); }
  requireSyntheticNow(nowMs);
  const email = canonicalizeRecipient(recipient.verifiedEmail);
  const hash = tokenHash(rawToken);
  return repo.transaction(async tx => {
    const invite = requireInviteReady(await tx.findByTokenHash(hash), nowMs);
    if (invite.canonicalEmail !== email) throw new SyntheticInvitationRejectedError();
    // Underlying repo MUST reject conflicts and never promote MEMBER to OWNER.
    if (!await tx.insertMembershipIfAbsent(invite.orgId, recipient.userId, "MEMBER")) {
      throw new SyntheticInvitationConflictError();
    }
    await tx.replaceInvitation({ ...invite, tokenHash: hash, status: "accepted", version: invite.version + 1 });
    return { orgId: invite.orgId, role: "MEMBER" };
  });
}

export async function revokeSyntheticInvitation(
  actor: TrustedSyntheticMemberActor,
  orgId: unknown,
  invitationId: unknown,
  repo: SyntheticInvitationRepository,
  nowMs: number,
): Promise<void> {
  const scopedOrgId = requireOwner(actor, orgId);
  requireSyntheticNow(nowMs);
  if (typeof invitationId !== "string" || !UUID_V4.test(invitationId)) throw new SyntheticInvitationRejectedError();
  await repo.transaction(async tx => {
    await verifyOrgOwner(tx, scopedOrgId, actor);
    const invite = requireInviteReady(await tx.findById(invitationId), nowMs);
    if (invite.orgId !== scopedOrgId) throw new SyntheticInvitationRejectedError();
    await tx.replaceInvitation({ ...invite, status: "revoked", version: invite.version + 1 });
  });
}
