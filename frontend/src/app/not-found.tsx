import Link from "next/link";

export default function NotFound() {
  return (
    <main className="error-shell">
      <div>
        <span className="eyebrow">404 · UNAVAILABLE</span>
        <h1>This page is not available.</h1>
        <p>No additional data about records or organizations can be provided.</p>
        <Link href="/app" className="btn btn-primary">Return to synthetic workspace</Link>
      </div>
    </main>
  );
}
