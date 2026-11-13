# P2 — Product UX, Interface Design and Screen Specifications

**Initiated:** 2026-11-13  
**Source:** Zoho Clone Master Roadmap v2.0 — **P2.01 through P2.17** (17 sub-phases)  
**Current sub-phase:** **P2.02 Information Architecture — DRAFT IN PROGRESS, OWNER REVIEW PENDING**, [GitHub #25](https://github.com/owaisprog/Zoho-Clone/issues/25). P2.01 [issue #24](https://github.com/owaisprog/Zoho-Clone/issues/24) closed after owner-approved provisional original UX baseline on 2026-11-13.  
**P1 gate:** P1.01–P1.10 signed off **as planning/design only** on 2026-11-13, P1.10 [issue #23](https://github.com/owaisprog/Zoho-Clone/issues/23) closed.  
**Constraints:** **ALL 14 P1.09 evidence/implementation gaps remain OPEN**; **12 P1.10 unresolved decisions remain OPEN**. P0.10 permits only **synthetic-data internal UX/planning/development**. No actual auth, tenant enforcement, Prisma schema, Express APIs, customer data, live processor, production or public trial exists. No executed test result can be implied by a design review.

## P2 master sequence and owner checkpoints

| Sub-phase | Required UX deliverable | Planned working artifacts (not all exist) | Status |
|---|---|---|---|
| **P2.01** | Brand and design tokens — Original provisional brand, typography/colors/spacing, contrast/themes | `docs/design/brand-and-tokens.md`, `docs/design/design_tokens.json`, `docs/design/color-contrast-review.csv`, `docs/design/component-examples.md`, `docs/design/token-preview.html` | **COMPLETE — owner-approved provisional original internal UX baseline 2026-11-13; issue #24 closed; not final brand/a11y** |
| **P2.02** | Information architecture — App taxonomy, sitemap, permission-filtered navigation | `docs/design/information-architecture.md`, `docs/design/navigation.yml`, `docs/design/route-inventory.csv`, `docs/design/navigation-review-cases.csv` | **IN PROGRESS — draft IA/navigation/route design prepared; issue #25 open, owner review pending** |
| **P2.03** | Marketing website wireframes — Home/features/pricing/docs/legal/demo with honest claims | `docs/design/marketing-wireframes.md` | NOT STARTED |
| **P2.04** | Login and recovery UX — Sign-up/login/MFA/recovery/verify, tenant switch, expired links | `docs/design/auth-ux.md` | NOT STARTED |
| **P2.05** | Organization onboarding UX — New org, invite, app selection, synthetic data, save/recover | `docs/design/onboarding-ux.md` | NOT STARTED |
| **P2.06** | Global workspace shell — App launcher, sidebar, breadcrumbs, switcher, shortcuts | `docs/design/workspace-shell.md` | NOT STARTED |
| **P2.07** | Reusable data table — Sort/filter/saved views/columns/pagination/bulk and 1/100/10000 mock-row states | `docs/design/data-table-spec.md` | NOT STARTED |
| **P2.08** | Reusable form system — Input schema, validation summary, required/optional, safe upload exclusion | `docs/design/form-system-spec.md` | NOT STARTED |
| **P2.09** | Record detail template — Safe timeline, permitted related tabs, edit panel, empty/error | `docs/design/record-detail-spec.md` | NOT STARTED |
| **P2.10** | Kanban and pipeline UX — Drag/drop, keyboard move, invalid/stale stage rollback | `docs/design/pipeline-kanban-spec.md` | NOT STARTED |
| **P2.11** | Multi-step process screens — Internal onboarding wizards, checklist, review, save/retry | `docs/design/multi-step-process-spec.md` | NOT STARTED |
| **P2.12** | Dashboard and reporting UX — KPI cards, date filters, safe reports, currency/time units | `docs/design/dashboard-reporting-spec.md` | NOT STARTED |
| **P2.13** | Billing and usage UX — Mock plans, seats, limits, transparent upgrade/downgrade preview | `docs/design/billing-usage-ux.md` | NOT STARTED |
| **P2.14** | Settings and access editor — Members/roles/invites, explicit save/revoke audit | `docs/design/settings-access-ux.md` | NOT STARTED |
| **P2.15** | Error, empty and offline patterns — 403/404/session-expired/retries/entitlement/offline and redaction | `docs/design/error-state-patterns.md` | NOT STARTED |
| **P2.16** | Accessibility and responsiveness — Keyboard/focus/a11y contracts and 320px-mobile-to-desktop table strategy | `docs/design/accessibility-responsive-review.md` | NOT STARTED |
| **P2.17** | Design prototype validation — Clickable 5-journey prototype, usability findings and changes | `docs/design/prototype-validation.md` | NOT STARTED |

**Sequential dependency:** P2.01 design tokens inform P2.02 navigation, then P2.03–P2.17. Approved P1 functional/nonfunctional/permission/domain/API contracts are prerequisites for every UX flow. Owner explicitly approves each design baseline; later mockups must never be described as actual running product or independently validated user research.

## P2.01 — Owner-approved provisional original Brand and Design Tokens

- **UI/workflow:** Typography, color semantics, spacing, radii, high-density B2B tables and responsive/light/dark themes.
- **Backend API:** Define the proposed token package consumption contract only; **no backend endpoint or token service**.
- **Data artifact:** [design_tokens.json](design_tokens.json) with primitive, semantic, typography, spatial, layout and interaction tokens; brand/hostname not selected.
- **Business/accessibility:** Readable data-dense navigation and forms; WCAG 2.2 AA contrast targets verified computationally for **specific** token pairs, not entire UI certification.
- **Permissions:** Owner approves the original brand direction; design cannot use Zoho proprietary logo, colorways or commercial brand name.
- **Integration later:** Shared shadcn/ui / Tailwind component layer, P2.06 shell, P3 Next.js app and accessible data tables. No existing component package is claimed.
- **Review evidence:** Design tokens parse, aliases resolve, contrast pairs inspected by numeric calculation, sample component and static preview reviewed, and owner signs off. **No browser, screen-reader, Playwright/axe or real-user usability test executed unless an actual run is recorded separately.**
- **P2.01 exit COMPLETE:** Product owner approved provisional original design, light/dark palette, typography, density and usage on 2026-11-13; issue #24 closed. No commercial brand or browser/a11y verification claim. Open P1 risk/decision count unchanged.

## P2.02 — Active scope: Information Architecture and Navigation

- **Design artifacts:** [Information Architecture](information-architecture.md), [64-route inventory](route-inventory.csv), [27-item navigation YAML](navigation.yml), [40 design-review scenarios](navigation-review-cases.csv).
- **Route families:** Public concepts 5; identity/global/org R0 19; Sales CRM R1 20; Merchant Operations R2 15; deferred specialist paths 5 — unlinked. **Every route is a proposal, none runs as a Next.js page.**
- **Context model:** Verified identity → active organization membership → module entitlement → precise role/action → owner/team/agent record sharing and field projection. Org owner/admin is not automatically authorized for CRM or merchant records.
- **Direct URL security:** Safe denial/concealed existence; never expose hidden rows in search/breadcrumb/count/error/SSR. Authenticated organization switching requires cache and pending-request invalidation and renewed permission check.
- **Mobile information hierarchy:** 320px drawer/list-first layouts; labels and keyboard focus, no color-only status. Browser and screen-reader checks are future P2.16/P3 evidence, **not performed now**.
- **Sensitive-data and status boundary:** Internal applications and DEMO_ONLY status unverified; no bank/card/KYC capture, real billing or external processor authorization.
- **Review cases:** 40 new IA *design-review proposals* marked NOT_RUN; they do NOT alter the existing **727** P1.09 planned implementation-test inventory.
- **P2.02 exit:** Owner approves provisional route taxonomy, topbar/sidebar/grouping, permission-aware states and responsive navigation; then close issue #25 and begin P2.03 marketing wireframes. Do not infer route implementation or usability verification.

## P2 overall exit criteria (after P2.17, NOT YET MET)

- [ ] Reusable, owner-approved tokens and documented theme/component mappings.
- [ ] Information architecture and app navigation across permitted R0/R1/R2 scopes.
- [ ] Complete MVP screen/error/loading/empty/permission/async/disabled/recovery states.
- [ ] Responsive accessible table-intensive tasks, keyboard alternatives and actual review evidence from performed prototype validation (if user testers not available, record shortfall accurately).
- [ ] Explicit limits for synthetic merchant status, mock billing, original product branding and restricted field/record access.
- [ ] Owner approves P2 planning/design release gate **for internal P3 synthetic engineering only**; G-EXT/G-COM remain blocked.

## Evidence and decision carry-forward

- [All 14 source Gaps G-001..G-014](../qa/coverage-gaps.md) and [OPEN risk register](../product/p1-risk-register.csv) remain open. In particular real backend authorization and 727 actual test executions are future engineering tasks.
- [12 unresolved decisions](../product/p1-decision-backlog.csv), including real brand/domain, auth provider, ID format, stage semantics, billing/legal, partner/customer proof, remain open. P2.01 may propose *provisional* colors and concept label but must **not** claim final commercial brand selection.
- P2.17's 5-journey prototype will be designed around **fictional** organizations and synthetic statuses, and actual user observations must be separately logged rather than fabricated.
- Project stack remains Next.js/React/TypeScript/Tailwind frontend and Node.js/**Express.js**/TypeScript backend; P3 is the authorized **future** coding phase, not started by opening this issue.

**Updated:** 2026-11-13 · **P2.02 OPEN**. No working frontend/backend, browser tests or approval of P2.02 routes yet.


## Explicit owner-authorized parallel P3.01 development (2026-11-14)

The owner approved **starting real Next.js/Express.js code early**, without waiting for all
17 P2 design steps. [P3.01 #26](https://github.com/owaisprog/Zoho-Clone/issues/26)
is OPEN while **P2.02 #25 remains OPEN**. The P3.01 layout paths are a temporary
fictional local preview and do NOT implement or pre-approve P2.02's 64-route/tenant-safe
information architecture. Changes to P2 design can be incorporated later as real P3/P4
features are approved. [CI evidence](https://github.com/owaisprog/Zoho-Clone/actions/runs/43493982182)
shows 13 bounded scaffold tests plus builds/typechecks PASS, not browser a11y or product
acceptance. P1 risks/decisions and 727 untouched test cases remain OPEN/NOT RUN.
