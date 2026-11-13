# P2.01 — Component Applications of the Proposed Design Tokens

**Version:** 1.0 — owner-approved provisional visual usage guidance · 2026-11-13  
**Status:** Owner-approved P2.01 provisional internal visual guidance on 2026-11-13. These remain textual UI specifications and a static HTML sample, **not Next.js/shadcn components, actual permission enforcement or verified accessible behavior**.  
**Token source:** [design_tokens.json](design_tokens.json) · [visual direction](brand-and-tokens.md) · [27 measured token color pairs](color-contrast-review.csv).  
**Data:** All examples are fictional and **SYNTHETIC DEMO ONLY**; no actual merchant/processor status is implied.

## 1. Shared application shell (R0/R1/R2)

```text
┌──────────────────────────────┬─────────────────────────────────────────────────────────────┐
│ WORKSPACE [internal concept] │ Orchid Payments Demo   /   Merchant Operations   [avatar] │
│                              ├─────────────────────────────────────────────────────────────┤
│ Overview                     │ Merchant applications                         [+ New case] │
│ Sales CRM                    │ Assigned to me | All authorized | Needs next action          │
│  Leads, Accounts, Deals      │ [Search permitted cases] [Internal stage ▼] [Owner ▼]        │
│ Merchant Operations          │ [Table] Merchant | Internal stage | Owner | Next action     │
│  Merchants, Applications     │ Demo River  | Waiting for info | Demo Ops | Review checklist│
│ Tasks                        │ ...                                                         │
│ Reports                      │  5 synthetic sample cases                                   │
│ ──────────────────────────── │                                                             │
│ Organization settings        │     NOTE: Internal tracking — no real processor verification │
└──────────────────────────────┴─────────────────────────────────────────────────────────────┘
```

- Background `color.semantic.light.canvas`, main data panel `surface`, sidebar `sidebarSurface`.
- Sidebar has high-contrast white labels, a clearly bounded selected state and **text + icon**, not decorative colored dots.
- All navigation links are **permission- and entitlement-filtered in future server-backed UI**; hidden/disabled links do not substitute for authorization. External agent portals not visible in initial R0/R1/R2 UI.
- Active organization name, environment "SYNTHETIC DEMO" label and user role are always visible; never use unverified data as real.

## 2. Dense but readable data table

```text
Merchant               Internal stage     Owner         Next action          Updated
Demo River Retail      Draft              Demo Ops      Review checklist     Demo
Demo Pine Market       Needs more info    Demo Ops      Request follow-up    Demo
Demo Cedar Books       Waiting external   Demo Ops      Check demo status    Demo
```

- Default row height = 44px, optional compact = 36px, 14px text minimum for operational data.
- Leading selection checkbox, name as primary row label, stage status text with icon, owner and action columns, an accessible per-row overflow menu.
- Column chooser, bulk actions, advanced filter, pagination and saved views will be designed in **P2.07**. This is not a claim they work now.
- Filters and totals only include **authorized** records, never all-organization global counts by default.
- Distinguish empty states: *No permitted records*, *No results matching filters*, *No entitlement* and *Access denied* without leaking hidden existence.
- For 320px view, switch to stacked cards or a horizontally scrolling semantic table with persistent first column; tested interaction is future work.

## 3. Merchant application status card (R2)

A status tile should have:
- **Title:** “Demo Cedar Books — Internal tracking”
- **Status label:** “Waiting on external update (unverified demo)” with informational icon.
- **Owner:** “Demo Operations” and **Next action:** “Check synthetic status using permitted channel.”
- **Source note:** “Demo source only — no processor connection.”
- **Primary action:** “Update internal next action”, only for assigned onboarding role with authorized record scope.
- **Disabled/deferred area:** Real underwriting, settlement, KYC upload, processor activation not available.

Do not label internal `active_internal` or demo `DEMO_ONLY_ACTIVE` as actual processor/merchant activation or processing approval.

## 4. Access-controlled edit form (R0/R1/R2)

- Always show exact record title, tenant and purpose.
- Labels above inputs; hints separate from error text. Use `borderControl` for field recognition and 2px `focusRing` with offset.
- Use **“Save changes”** (primary) and **“Cancel”** (secondary) with an unsaved-changes confirmation.
- Required text and conditionally hidden/locked fields have clear status; do not imply user may edit a hidden restricted field.
- Disallow arbitrary JSON keys and prohibited payment/identity/KYC fields; an actual backend will enforce this only after implemented.
- Validation summary navigates to field errors; preserve values on a failed request and make session-expiry resolution safe.
- Example permission error: “You don't have access to update this record.” Avoid revealing another organization's record name.

## 5. Organization switcher and permission-aware navigation

- Current organization presented in top bar as “Orchid Payments Demo”.
- Switcher only shows **currently authorized active membership organizations** after server verification; do not use client role strings as authorization.
- Confirm pending unsaved forms; clear tenant-specific cache on switch.
- Roles must not display "Org Owner = can view all CRM/merchant records". The P1.06 matrix requires explicit operational grants.
- Revoked membership, expired invite and forbidden role-grant cases each have safe, distinct user feedback without exposing hidden record existence.

## 6. Buttons, status chips, notifications and alerts

| State | Required visual treatment | Accessibility and semantics |
|---|---|---|
| Primary | Solid indigo background, white action label; no gradients | Text/action contrast formula checked, keyboard focus ring |
| Secondary | White/light surface with visible border and ink text | 3:1 essential border for actual adjacent surface |
| Success | Deep green label + simple check icon + description | Not color-only; confirmed *internal action*, not actual payment processing |
| Warning | Dark amber label + triangle icon and reason | State says "Needs attention" or "Demo unverified", never an automatic provider judgement |
| Error | Deep red label + alert icon and next step | Live region and field summary in future running UI |
| Loading | Spinner/label or skeleton with preserved layout; `aria-busy` | Don't report completion before API response |
| Disabled | Explicit "Unavailable" reason, not a misleading active CTA | Inform via text and tooltip/details, not opacity alone |
| Offline | Explain "Changes not saved" and retry on reconnect | No claim of automatic secure offline persistence |

## 7. Responsive accessibility examples

**320px mobile:** Navigation becomes a keyboard-reachable menu; page title uses 24px size, filter row stacks; display top merchant fields with a “View details” option. Click targets at least 24px where appropriate, ideally 40–44px for main actions.

**Desktop/table:** Status/owner/action should remain visible without horizontal anxiety; optional compact mode increases density but retains focus, row selection and keyboard navigation.

**Dialog:** Trap focus, accessible heading/description, ESC behavior and return focus to trigger after close (future implementation). Destructive changes require explicit confirmation.

**Charts:** Status/trend symbols and accessible text data table alternatives; color not only information. The P2.12 dashboard must reconcile sample KPI totals manually, and actual aggregate permission validation waits for running tests.

**Reduced motion:** Future CSS respects `prefers-reduced-motion`, suppresses nonessential transitions, and never disables focus outlines.

## 8. Static preview vs real application

[Open token-preview.html locally](token-preview.html) for a **self-contained illustrative HTML/CSS page** using fictional merchant labels. It is not hosted, not the real Next.js app, has no server/API, never authenticates users and does not prove record/tenant access. The preview's client-side theme and density toggles, if used, are **visual only**.

## 9. P2.01 owner review checkpoints

- [ ] Approve or revise the provisional light/navy default, deep indigo actions, restrained functional status colors.
- [ ] Approve typography and comfortable/compact table density strategy.
- [ ] Approve original/non-Zoho-branded UI direction (commercial name, domain and legal/trademark checks remain OPEN).
- [ ] Approve token usage rules for P2.02 Information Architecture and subsequent 16 UX phases.
- [ ] Keep P1 gaps/risks and 12 decisions OPEN. No automated a11y/browser usability or production QA is claimed.

**P2.01 owner design baseline approved; P2.02 navigation/IA remains a separate OPEN design gate.**
