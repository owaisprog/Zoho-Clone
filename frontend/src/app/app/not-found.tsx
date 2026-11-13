import Link from "next/link";

export default function DemoWorkspaceNotFound() {
  return (
    <div className="error-shell">
      <div>
        <h1>Demo page unavailable</h1>
        <p>This page is not part of the current synthetic preview. No real business data is available.</p>
        <Link className="btn btn-primary" href="/app">Back to preview overview</Link>
      </div>
    </div>
  );
}
