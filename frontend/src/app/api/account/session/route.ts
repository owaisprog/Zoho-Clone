import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { publicAccountResponse } from "@/lib/p4-account-view";

/**
 * P4.01/P4.02: no token, subject, email or organization claims in responses.
 * This is not an API replacement for trusted backend membership verification.
 */
export const dynamic = "force-dynamic";
export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  if (!auth0) {
    return NextResponse.json(publicAccountResponse(false, false, null), { status: 503, headers });
  }
  try {
    const session = await auth0.getSession();
    const emailVerified = (session?.user as { email_verified?: unknown } | undefined)?.email_verified;
    const result = publicAccountResponse(true, Boolean(session), emailVerified);
    return NextResponse.json(result, {
      status: result.state === "signed_out" ? 401 :
        result.state === "verification_required" ? 403 : 200,
      headers,
    });
  } catch {
    // SDK/internal errors and tokens must not appear in a client response.
    return NextResponse.json(
      { state: "unavailable", identityOnly: true, organizationAccess: false },
      { status: 503, headers },
    );
  }
}
