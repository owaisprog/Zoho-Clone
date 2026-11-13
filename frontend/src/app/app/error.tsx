"use client";
import Link from "next/link";

export default function DemoWorkspaceError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // Do not print errors, request URLs, stack traces or digests to the visitor.
  return (
    <section className="error-shell" role="alert">
      <div>
        <h1>Demo view unavailable</h1>
        <p>We could not display this fictional workspace view. No real customer records are connected.</p>
        <div className="action-row">
          <button type="button" className="btn btn-primary" onClick={reset}>Retry demo</button>
          <Link className="btn" href="/app">Return to demo overview</Link>
        </div>
      </div>
    </section>
  );
}
