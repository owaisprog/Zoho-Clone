import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { safeLocalApiBase } from "@/lib/local-api-url";

// BFF-only test: the browser sees neither the API access token nor Auth0 secret.
// This route deliberately confirms IDENTITY ONLY, never tenant membership.
export const dynamic = "force-dynamic";

export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  if (!auth0) return NextResponse.json({ status: "not_configured" }, { status: 503, headers });

  const session = await auth0.getSession();
  if (!session) return NextResponse.json({ status: "unauthenticated" }, { status: 401, headers });

  const internalApi = safeLocalApiBase(process.env.API_INTERNAL_URL);
  if (!internalApi) return NextResponse.json({ status: "backend_unavailable" }, { status: 503, headers });

  try {
    const { token } = await auth0.getAccessToken();
    const response = await fetch(new URL("/api/v1/auth/check", internalApi), {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (response.status === 401) return NextResponse.json({ status: "unauthenticated" }, { status: 401, headers });
    if (!response.ok) return NextResponse.json({ status: "backend_unavailable" }, { status: 503, headers });
    return NextResponse.json(
      { status: "authenticated", scope: "identity-only", organizationAccess: false },
      { status: 200, headers },
    );
  } catch {
    return NextResponse.json({ status: "backend_unavailable" }, { status: 503, headers });
  }
}
