"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  ArrowUpRight,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  LayoutDashboard,
  Layers3,
  LockKeyhole,
  Settings2,
  UsersRound,
} from "lucide-react";
import type { ReactNode } from "react";
import { ThemeToggle } from "./theme-toggle";

const primary = [
  { label: "Overview", href: "/app", icon: LayoutDashboard },
  { label: "Sales CRM", href: "/app/sales/leads", icon: UsersRound },
  { label: "Merchant Operations", href: "/app/operations/applications", icon: ClipboardList },
] as const;

const administration = [
  { label: "Settings concept", href: "/app/settings", icon: Settings2 },
] as const;

function NavGroup({
  label,
  items,
  pathname,
}: {
  label: string;
  items: typeof primary | typeof administration;
  pathname: string;
}) {
  return (
    <section className="nav-group" aria-label={label}>
      <p className="nav-group-heading">{label}</p>
      <nav aria-label={label}>
        {items.map(({ label: itemLabel, href, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              className={active ? "nav-link active" : "nav-link"}
              href={href}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={18} aria-hidden="true" />
              <span>{itemLabel}</span>
              {active && <span className="nav-active-dot" aria-hidden="true" />}
            </Link>
          );
        })}
      </nav>
    </section>
  );
}

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const navigation = (
    <>
      <NavGroup label="WORKSPACE" items={primary} pathname={pathname} />
      <NavGroup label="ORGANIZATION" items={administration} pathname={pathname} />
    </>
  );

  return (
    <div className="workspace-frame">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <aside className="workspace-sidebar" aria-label="Demo application navigation">
        <Link href="/app" className="brand-lockup" aria-label="Workspace OS demo home">
          <span className="brand-symbol" aria-hidden="true"><i /><i /><i /><i /></span>
          <span className="brand-copy"><strong>Workspace OS</strong><small>ORIGINAL CONCEPT</small></span>
        </Link>

        <div className="org-selector-static" aria-label="Current fictional organization">
          <div className="org-avatar">O</div>
          <div className="org-selector-text"><strong>Orchid Payments</strong><span>Demo workspace</span></div>
          <ChevronDown size={14} aria-hidden="true" />
        </div>

        <div className="sidebar-navigation">{navigation}</div>

        <div className="sidebar-footer">
          <span className="sidebar-footer-icon"><LockKeyhole size={17} aria-hidden="true" /></span>
          <span><strong>Prototype only</strong><small>No login or tenant permissions implemented</small></span>
        </div>
      </aside>

      <div className="workspace-main">
        <header className="workspace-topbar">
          <div className="topbar-left">
            <details className="mobile-navigation">
              <summary aria-label="Open demo navigation"><Layers3 size={20} /></summary>
              <div className="mobile-nav-content">{navigation}</div>
            </details>
            <span className="topbar-path">Workspace <span className="path-separator">/</span> Internal preview</span>
          </div>
          <div className="topbar-actions">
            <span className="synthetic-badge"><span className="badge-dot" /> SYNTHETIC DEMO</span>
            <ThemeToggle />
            <span className="topbar-avatar" aria-label="Fictional demo account">D</span>
          </div>
        </header>

        <main id="main-content" className="workspace-content">{children}</main>

        <footer className="workspace-bottom">
          <span><Activity size={14} aria-hidden="true" /> P3.01 early scaffold · no production data</span>
          <span className="bottom-right">
            <CircleHelp size={14} aria-hidden="true" /> Design + process demo, not secure customer software
            <ArrowUpRight size={13} aria-hidden="true" />
          </span>
        </footer>
      </div>
    </div>
  );
}
