"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { p4FilterDemoApps, P4_DEMO_APPS } from "@/lib/p4-navigation-preview";

/** Keyboard controls are UI-only: server must authorize every actual app. */
export function P4AppLauncherPreview({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(!compact);
  const [query, setQuery] = useState("");
  const searchInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault(); setOpen(current => !current);
      } else if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  useEffect(() => { if (open) searchInput.current?.focus(); }, [open]);
  const results = p4FilterDemoApps(query);
  return (
    <section aria-label="Fictional app launcher">
      <button type="button" className="p4-button" onClick={() => setOpen(v => !v)}
        aria-expanded={open} aria-controls={compact ? "p4-quick-launcher" : "p4-full-launcher"}
        aria-keyshortcuts="Control+K Meta+K">
        {open ? "Close launcher" : "Open app launcher"} <span aria-hidden="true">⌘ K</span>
      </button>
      {open && (
        <div id={compact ? "p4-quick-launcher" : "p4-full-launcher"} className="p4-panel p4-launcher"
          role="region" aria-label="Search demo apps">
          <label className="p4-eyebrow" htmlFor={compact ? "p4-nav-query-compact" : "p4-nav-query-full"}>Search fictional applications</label>
          <input id={compact ? "p4-nav-query-compact" : "p4-nav-query-full"} ref={searchInput}
            type="search" value={query} maxLength={80} autoComplete="off"
            onChange={event => setQuery(event.target.value)}
            placeholder="Try CRM, Teams, Finance…" />
          <div className="p4-app-grid" role="list" aria-label="Application status">
            {results.map(app => (
              <div role="listitem" className="p4-app-card" key={app.code}>
                <div><strong>{app.name}</strong><small>{app.description}</small></div>
                {app.available
                  ? <Link href={app.href} className="p4-button"
                      onClick={() => { setOpen(false); setQuery(""); }}>Open demo</Link>
                  : <span className="p4-policy-state denied" aria-label={app.name + " locked"}>Locked</span>}
              </div>
            ))}
            {!results.length && <p>No fictional apps match this search.</p>}
          </div>
          <p className="p4-status-note">{P4_DEMO_APPS.length} fictional apps · access is not a commercial entitlement</p>
        </div>
      )}
    </section>
  );
}
