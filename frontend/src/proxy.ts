import { NextResponse, type NextRequest } from "next/server";
import { auth0 } from "./lib/auth0";

/**
 * Next.js 16 request proxy. Auth0 mounts /auth/login, /auth/callback and
 * /auth/logout only when private server configuration is complete.
 * Other public pages remain a clearly marked fictional demo.
 */
export async function proxy(request: NextRequest) {
  if (!auth0) {
    if (request.nextUrl.pathname.startsWith("/auth/")) {
      return NextResponse.json(
        { error: { code: "AUTH_NOT_CONFIGURED", message: "Login is not configured" } },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.next();
  }
  return auth0.middleware(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)"],
};
