import { redirect } from "next/navigation";
import { auth0 } from "@/lib/auth0";

export const dynamic = "force-dynamic";

export default async function IdentityPreview() {
  if (!auth0) {
    return (
      <main style={{ maxWidth: 720, padding: "56px 24px", margin: "auto" }}>
        <h1>Auth0 is selected but not configured</h1>
        <p>Set private Auth0 application values locally to enable this identity check.</p>
        <p>This demo does not grant organization membership or CRM permissions.</p>
        <a href="/app">Back to fictional workspace</a>
      </main>
    );
  }

  const session = await auth0.getSession();
  if (!session) redirect("/auth/login");

  return (
    <main style={{ maxWidth: 720, padding: "56px 24px", margin: "auto" }}>
      <h1>Authenticated session</h1>
      <p>Auth0 verified a login session for this browser.</p>
      <p><strong>Organization membership and CRM permissions are not active.</strong></p>
      <p>Future tenancy, invitations and record/field access must pass P4 security gates.</p>
      <p><a href="/auth/logout">Log out</a></p>
      <p><a href="/app">View the fictional-only demo</a></p>
    </main>
  );
}
