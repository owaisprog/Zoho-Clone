/**
 * P4.04: global profile contract, independent of organization membership.
 * Not connected to a live API or real user database before P4.10-P4.13.
 */
export interface GlobalProfileDraft {
  displayName: string;
  locale: string;
  timeZone: string;
}
export interface GlobalProfile extends GlobalProfileDraft {
  userId: string;
  revision: number;
}

export class GlobalProfileRejectedError extends Error {
  constructor() { super("P4_GLOBAL_PROFILE_REJECTED"); }
}

export function validateProfileDraft(input: unknown): Readonly<GlobalProfileDraft> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) throw new GlobalProfileRejectedError();
  const raw = input as Record<string, unknown>;
  const keys = Object.keys(raw).sort();
  if (keys.join(",") !== "displayName,locale,timeZone") throw new GlobalProfileRejectedError();

  const { displayName, locale, timeZone } = raw;
  if (typeof displayName !== "string" ||
      displayName !== displayName.trim() || displayName.length < 2 || displayName.length > 80 ||
      !/^[a-zA-Z0-9][a-zA-Z0-9 .'-]*$/.test(displayName) ||
      typeof locale !== "string" ||
      !/^[a-z]{2}(?:-[A-Z]{2})?$/.test(locale) ||
      typeof timeZone !== "string" || timeZone.length > 64) throw new GlobalProfileRejectedError();

  try {
    // This only checks the IANA identifier; it does not leak an IP/location.
    new Intl.DateTimeFormat("en", { timeZone }).format(new Date(0));
  } catch {
    throw new GlobalProfileRejectedError();
  }
  return Object.freeze({ displayName, locale, timeZone });
}

export interface TrustedSyntheticProfileActor {
  userId: string;
  providerVerified: true;
  emailVerified: true;
}
export interface GlobalProfileRepository {
  getByUserId(userId: string): Promise<GlobalProfile | null>;
  updateByUserId(userId: string, draft: GlobalProfileDraft): Promise<GlobalProfile>;
}

function requireSyntheticActor(actor: TrustedSyntheticProfileActor): void {
  if (actor.providerVerified !== true || actor.emailVerified !== true ||
      !/^user_demo_[a-z]{2,16}$/.test(actor.userId)) throw new GlobalProfileRejectedError();
}

export async function readOwnProfile(
  actor: TrustedSyntheticProfileActor,
  repository: GlobalProfileRepository,
): Promise<GlobalProfile | null> {
  requireSyntheticActor(actor);
  return repository.getByUserId(actor.userId);
}

export async function updateOwnProfile(
  actor: TrustedSyntheticProfileActor,
  input: unknown,
  repository: GlobalProfileRepository,
): Promise<GlobalProfile> {
  requireSyntheticActor(actor);
  const validated = validateProfileDraft(input);
  return repository.updateByUserId(actor.userId, validated);
}
