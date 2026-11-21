/**
 * P4.01/06/10 CI-only bridge: verified Auth0 issuer+subject -> internal UUIDv4.
 *
 * The VERIFIED bit must be supplied only by trusted Auth0 SDK middleware.
 * The object itself does NOT prove a JWT signature. Only injected synthetic
 * claims are permitted here, never raw browser headers or JWT decoding.
 * No production/Express app.ts or Neon paths import this module.
 */
import pg from "pg";
import type { P4VerifiedProviderToken } from "./p4-auth0-subject-bridge.js";
import {
  requireCanonicalUuidV4, type P4UuidV4,
} from "./p4-approved-uuid.js";
import { assertP4V1CiPrismaEnvironment } from "./p4-v1-ci-prisma.js";

export class P4V1CiIdentityDeniedError extends Error {
  constructor() { super("P4_V1_CI_IDENTITY_DENIED"); }
}
export type P4V1CiIdentityLookup = Readonly<{
  findVerifiedIssuerSubject(issuer: string, subject: string): Promise<{
    userId: string;
    emailVerified: boolean;
  } | null>;
}>;
const AUTH0_ISSUER = /^https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*\.auth0\.com\/$/;
const AUTH0_SUBJECT = /^[A-Za-z0-9|:_-]{3,200}$/;

export async function resolveP4V1CiActor(
  verifiedSdkEvidence: P4VerifiedProviderToken | null,
  expected: Readonly<{ issuer: string; audience: string }>,
  lookup: P4V1CiIdentityLookup,
  nowEpochSeconds: number,
): Promise<P4UuidV4> {
  const e = verifiedSdkEvidence;
  const audiences = typeof e?.audience === "string" ? [e.audience] : e?.audience;
  if (!e || e.cryptographicallyVerified !== true ||
      !expected || typeof expected.issuer !== "string" ||
      !AUTH0_ISSUER.test(expected.issuer) ||
      typeof expected.audience !== "string" ||
      !/^(urn:|https:\/\/)[\w./:-]{3,190}$/.test(expected.audience) ||
      e.issuer !== expected.issuer || !AUTH0_SUBJECT.test(e.subject) ||
      !Array.isArray(audiences) || audiences.length < 1 || audiences.length > 4 ||
      audiences.some(a => typeof a !== "string") ||
      !audiences.includes(expected.audience) ||
      !Number.isSafeInteger(nowEpochSeconds) ||
      !Number.isSafeInteger(e.expiresAtEpochSeconds) ||
      e.expiresAtEpochSeconds <= nowEpochSeconds ||
      e.expiresAtEpochSeconds > nowEpochSeconds + 86_400 ||
      !lookup || typeof lookup.findVerifiedIssuerSubject !== "function") {
    throw new P4V1CiIdentityDeniedError();
  }
  try {
    const subject = await lookup.findVerifiedIssuerSubject(e.issuer,e.subject);
    if (!subject || subject.emailVerified !== true) {
      throw new P4V1CiIdentityDeniedError();
    }
    return requireCanonicalUuidV4(subject.userId);
  } catch {
    throw new P4V1CiIdentityDeniedError();
  }
}

/**
 * Dedicated restricted role for the mapping function, NOT the tenant runtime.
 * The backend's disposable bootstrap role is used solely for SET LOCAL ROLE
 * in GitHub CI; never copy this pattern into production connections.
 */
export function createP4V1CiIdentityPool(
  env: NodeJS.ProcessEnv = process.env,
): pg.Pool {
  assertP4V1CiPrismaEnvironment(env);
  return new pg.Pool({
    host: "127.0.0.1", port: 5432,
    database: "zoho_clone_synthetic_ci",
    user: "demo_ci",
    password: "fake_ci_not_for_real_accounts",
    max: 1,
  });
}
export function createP4V1CiSubjectLookup(
  pool: pg.Pool,
  env: NodeJS.ProcessEnv = process.env,
): P4V1CiIdentityLookup {
  assertP4V1CiPrismaEnvironment(env);
  return Object.freeze({
    async findVerifiedIssuerSubject(issuer: string, subject: string) {
      assertP4V1CiPrismaEnvironment(env);
      if (!AUTH0_ISSUER.test(issuer) || !AUTH0_SUBJECT.test(subject)) {
        throw new P4V1CiIdentityDeniedError();
      }
      const c = await pool.connect();
      let transactionOpen = false;
      let discard = false;
      try {
        await c.query("BEGIN");
        transactionOpen = true;
        await c.query("SET LOCAL ROLE p4_v1_ci_identity_lookup");
        const role = await c.query(
          'SELECT current_user AS "role", (SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname=current_user) AS "privileged"',
        );
        if (role.rows.length !== 1 ||
            role.rows[0]?.role !== "p4_v1_ci_identity_lookup" ||
            role.rows[0]?.privileged !== false) {
          throw new P4V1CiIdentityDeniedError();
        }
        const mapped = await c.query(
          'SELECT user_id::text AS "userId", email_verified AS "emailVerified" ' +
          "FROM p4_v1_ci.lookup_verified_subject($1,$2)", [issuer,subject],
        );
        if (mapped.rows.length > 1) throw new P4V1CiIdentityDeniedError();
        const row: unknown = mapped.rows[0];
        if (row !== undefined && (!row || typeof row !== "object" ||
            !("userId" in row) || !("emailVerified" in row) ||
            typeof row.userId !== "string" || row.emailVerified !== true)) {
          throw new P4V1CiIdentityDeniedError();
        }
        await c.query("COMMIT");
        transactionOpen = false;
        if (row === undefined) return null;
        return { userId: row.userId as string, emailVerified: true };
      } catch {
        if (transactionOpen) {
          try { await c.query("ROLLBACK"); }
          catch { discard = true; }
        }
        throw new P4V1CiIdentityDeniedError();
      } finally {
        c.release(discard);
      }
    },
  });
}
