/**
 * Safe local-only diagnostic categories for the P3.13 identity check.
 * Never include URL, authorization headers, token claims, identity, network
 * error details, SDK exceptions, or other request data in responses.
 */
export const IDENTITY_DIAGNOSTIC_REASONS = [
  "LOCAL_API_URL_REJECTED",
  "AUTH0_ACCESS_TOKEN_MISSING",
  "AUTH0_TOKEN_REQUEST_FAILED",
  "API_CONNECTION_FAILED",
  "API_REQUEST_TIMED_OUT",
  "BACKEND_AUTH_NOT_READY",
  "BACKEND_UNEXPECTED_STATUS",
] as const;

export type IdentityDiagnosticReason = (typeof IDENTITY_DIAGNOSTIC_REASONS)[number];

export function identityUnavailableBody(
  reason: IdentityDiagnosticReason,
  environment: "development" | "test" | "production" = process.env.NODE_ENV ?? "production",
): { status: "backend_unavailable"; diagnostic?: IdentityDiagnosticReason } {
  // Only fixed, non-sensitive reason codes are exposed in local development.
  // No deployment, token, identity or infrastructure details in production.
  return environment === "development"
    ? { status: "backend_unavailable", diagnostic: reason }
    : { status: "backend_unavailable" };
}

/** Reduce failed fetches to non-sensitive, deterministic categories. */
export function classifyIdentityFetchFailure(error: unknown): IdentityDiagnosticReason {
  if (typeof error === "object" && error !== null && "name" in error) {
    const name = (error as { name?: unknown }).name;
    if (name === "TimeoutError" || name === "AbortError") {
      return "API_REQUEST_TIMED_OUT";
    }
  }
  // Never return the error message, cause, URL, token or provider stack.
  return "API_CONNECTION_FAILED";
}
