import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Workspace OS · Synthetic Prototype",
  description: "Original internal-only workspace prototype with fictional records. Optional Auth0 identity-only session, no organization permissions or merchant processing.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
