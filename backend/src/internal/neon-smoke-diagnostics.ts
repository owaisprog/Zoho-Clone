/**
 * Safe, fixed diagnostic codes for the synthetic Neon CLI.
 * Never print raw Prisma/pg driver errors, SQL, credentials, URLs or
 * sensitive environment variables. These codes only suggest next checks.
 */
export type NeonSmokeDiagnostic =
  | "NEON_ENVIRONMENT_MISSING_OR_INVALID"
  | "NEON_ENDPOINT_UNREACHABLE"
  | "NEON_DATABASE_NOT_FOUND"
  | "NEON_ROLE_AUTHENTICATION_FAILED"
  | "NEON_ROLE_PERMISSION_DENIED"
  | "NEON_SYNTHETIC_SCHEMA_MISSING"
  | "NEON_TEST_ASSERTION_FAILED"
  | "NEON_UNKNOWN_FAILURE";

export function classifyNeonSmokeFailure(error: unknown): NeonSmokeDiagnostic {
  if (typeof error !== "object" || error === null) return "NEON_UNKNOWN_FAILURE";

  const e = error as {
    name?: unknown;
    code?: unknown;
    message?: unknown;
    meta?: { code?: unknown };
    cause?: { code?: unknown };
  };
  // The fixed error code (not message) can be safely inspected in memory.
  if (typeof e.message === "string" &&
      /^NEON_SYNTHETIC_DATABASE_URL_(REQUIRED|INVALID|REJECTED)$/.test(e.message)) {
    return "NEON_ENVIRONMENT_MISSING_OR_INVALID";
  }
  if (e.name === "AssertionError") return "NEON_TEST_ASSERTION_FAILED";
  const code = typeof e.code === "string" ? e.code : "";
  const pgCode = typeof e.meta?.code === "string" ? e.meta.code :
    (typeof e.cause?.code === "string" ? e.cause.code : "");
  if (code === "P1000" || pgCode === "28P01" || pgCode === "28000") {
    return "NEON_ROLE_AUTHENTICATION_FAILED";
  }
  if (code === "P1003" || pgCode === "3D000") {
    return "NEON_DATABASE_NOT_FOUND";
  }
  if (code === "P1010" || pgCode === "42501") {
    return "NEON_ROLE_PERMISSION_DENIED";
  }
  if (code === "P2021" || pgCode === "42P01" || pgCode === "3F000") {
    return "NEON_SYNTHETIC_SCHEMA_MISSING";
  }
  if (code === "P1001" || code === "P1002" ||
      ["ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "ETIMEDOUT", "ENETUNREACH"].includes(pgCode)) {
    return "NEON_ENDPOINT_UNREACHABLE";
  }
  return "NEON_UNKNOWN_FAILURE";
}
