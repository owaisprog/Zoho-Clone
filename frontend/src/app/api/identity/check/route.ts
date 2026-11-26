import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { safeLocalApiBase } from "@/lib/local-api-url";
import {
  identityUnavailableBody,
  classifyIdentityFetchFailure,
  type IdentityDiagnosticReason,
} from "@/lib/identity-check-diagnostics";

// BFF-only P3.13 identity test. The browser never sees Auth0 access tokens.
// Identity verification does NOT grant a tenant membership or CRM permission.
export const dynamic = "force-dynamic";

export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  const unavailable = (reason: IdentityDiagnosticReason) =>
    NextResponse.json(identityUnavailableBody(reason), { status: 503, headers });

  // Never forward a Vercel staging session token to the localhost adapter.
  if (process.env.VERCEL === "1") return unavailable("LOCAL_API_URL_REJECTED");

  if (!auth0) {
    return NextResponse.json({ status: "not_configured" }, { status: 503, headers });
  }
  const session = await auth0.getSession();
  if (!session) {
    return NextResponse.json({ status: "unauthenticated" }, { status: 401, headers });
  }

  const internalApi = safeLocalApiBase(process.env.API_INTERNAL_URL);
  if (!internalApi) return unavailable("LOCAL_API_URL_REJECTED");

  let token: string;
  try {
    // Auth0 sets the API audience during login via authorizationParameters.
    // getAccessToken reads the corresponding server-side session token only.
    const result = await auth0.getAccessToken();
    if (!result.token) return unavailable("AUTH0_ACCESS_TOKEN_MISSING");
    token = result.token;
  } catch {
    // Never echo SDK errors: they may contain user, OAuth or provider metadata.
    return unavailable("AUTH0_TOKEN_REQUEST_FAILED");
  }

  let response: Response;
  try {
    response = await fetch(new URL("/api/v1/auth/check", internalApi), {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
  } catch (error: unknown) {
    return unavailable(classifyIdentityFetchFailure(error));
  }

  if (response.status === 401) {
    return NextResponse.json({ status: "unauthenticated" }, { status: 401, headers });
  }
  if (response.status === 503) return unavailable("BACKEND_AUTH_NOT_READY");
  if (!response.ok) return unavailable("BACKEND_UNEXPECTED_STATUS");

  return NextResponse.json(
    { status: "authenticated", scope: "identity-only", organizationAccess: false },
    { status: 200, headers },
  );
}
