import Link from "next/link";
import { auth0 } from "@/lib/auth0";
import { getPublicAccountState } from "@/lib/p4-account-view";

export const dynamic = "force-dynamic";

/** Hosted Auth0 handles credentials; never build our own password form. */
export default async function AccountFoundationPage() {
  const session = auth0 ? await auth0.getSession() : null;
  const user = session?.user as { email_verified?: unknown; name?: unknown } | undefined;
  const state = getPublicAccountState(Boolean(auth0), Boolean(session), user?.email_verified);
  const displayName = state === "identity_verified" && typeof user?.name === "string"
    ? user.name.slice(0, 80) : null;

  const statusTitle = state === "identity_verified" ? "Identity verified" :
    state === "verification_required" ? "Email verification required" :
    state === "signed_out" ? "Sign in to continue" : "Auth0 setup needed";
  const statusText = state === "identity_verified"
    ? "Your Auth0 session is active. Organization permissions and profile persistence are not enabled yet."
    : state === "verification_required"
      ? "Your provider session exists, but verified email evidence is missing. Check your inbox or sign in again through Auth0."
      : state === "signed_out"
        ? "Sign in or create an account through Auth0 Universal Login. We do not collect passwords in this application."
        : "Auth0 is not configured in this local environment. Set private environment values; no fallback identity is created.";

  return (
    <main className="p4-page">
      <Link href="/app" className="p4-back">← Fictional workspace</Link>
      <div className="p4-headline">
        <span className="p4-eyebrow">P4 · IDENTITY FOUNDATION</span>
        <h1>Account and security</h1>
        <p>Central account status and planned organization setup. Your password stays with Auth0.</p>
      </div>

      <div className="p4-alert" role="note">
        <strong>Synthetic development only</strong>
        <span>Signing in confirms identity, not access to any organization, customer record or paid module.</span>
      </div>

      <section className="p4-grid" aria-label="Identity foundation sections">
        <article className="p4-panel p4-panel-featured">
          <span className="p4-eyebrow">P4.01 / P4.02 · REGISTRATION AND SESSIONS</span>
          <h2>{statusTitle}</h2>
          <p>{statusText}</p>
          {displayName && <p className="p4-identity-name">Signed in as {displayName}</p>}
          <div className="p4-actions">
            {state === "signed_out" && <a className="p4-button p4-button-primary" href="/auth/login">Continue with Auth0</a>}
            {state === "verification_required" && <a className="p4-button" href="/auth/logout">Sign out and verify</a>}
            {state === "identity_verified" && <a className="p4-button" href="/auth/logout">Sign out</a>}
            <Link href="/api/account/session" className="p4-button">View safe session status</Link>
          </div>
        </article>

        <article className="p4-panel">
          <span className="p4-eyebrow">P4.03 · MFA AND RECOVERY</span>
          <h2>Protected account actions</h2>
          <p>Use the recovery option on the hosted Auth0 sign-in page. Privileged MFA policy requires provider configuration and acceptance testing before it can authorize anything.</p>
          <p className="p4-status-note">MFA enforcement: not yet verified</p>
        </article>

        <article className="p4-panel">
          <span className="p4-eyebrow">P4.04 · GLOBAL USER PROFILE</span>
          <h2>One profile, many organizations</h2>
          <p>Display name, locale, time zone and avatar will belong to the global user, not an organization. Profile editing is disabled until a protected, self-only database API exists.</p>
          <p className="p4-status-note">Profile persistence: not connected</p>
        </article>

        <article className="p4-panel">
          <span className="p4-eyebrow">P4.05 · ORGANIZATION CREATION</span>
          <h2>Organization onboarding</h2>
          <p>Preview a fictional organization's display name and slug. Real creation must atomically add a verified owner and enforce unique slugs and tenant isolation.</p>
          <div className="p4-actions">
            <Link className="p4-button" href="/app/organization/new">Open fictional organization preview</Link>
          </div>
          <p className="p4-status-note">Real organizations: cannot be created yet</p>
        </article>
      </section>
    </main>
  );
}
