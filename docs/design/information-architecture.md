# P2.02 — Information Architecture, Application Sitemap and Permission-Aware Navigation

**Version:** 0.1 — owner-review DRAFT  
**Prepared:** 2026-11-13 · [P2.02 GitHub Issue #25](https://github.com/owaisprog/Zoho-Clone/issues/25)  
**Prerequisite:** P2.01 owner-approved as a **provisional original internal UX baseline** (issue #24 closed). Public product name/logo/domain and accessibility compliance remain unapproved/unverified.  
**Authority:** P1.01–P1.10 approved design/planning documents, P1.06 permission matrix, P1.07 glossary, P1.08 OpenAPI, P2.01 design tokens.  
**Status:** Proposed route, navigation and interaction plan **ONLY**. **No Next.js routes, login, authorization, frontend navigation or automated browser tests are implemented**. No real user/merchant data.

## 1. UX goal

Give an ISO/POS/merchant-services operator a **single recognizable work environment** for R0 platform administration, R1 Sales CRM and R2 internal Merchant Operations without falsely signaling that deferred processor services exist.

The core operator question is **“Who owns this case, what is its *internal* stage, and what is the next action?”** The first information architecture prioritizes an organization context, visible record ownership and clear status provenance over broad app counts or Zoho product imitation.

**Naming:** “Zoho Clone” is an internal repository name; “Workspace OS” is a descriptive visual-design placeholder, **not approved commercial branding**. All visual assets and navigation must be independently developed.

**Audience:** Org owner/admin for authorized organization administration; Sales Manager/Rep; Onboarding Manager/Coordinator; Agent Manager; Billing Admin; Security Reviewer. These are roles from the P1.06 design matrix, not live accounts or validated user interviews. External agents, merchants and platform support are **not** automatically authorized tenant users or portal readers.

## 2. Four navigation surfaces and distinct security boundaries

| Surface | Source/scope | Primary purpose | Security boundary |
|---|---|---|---|
| Public website (future P2.03) | `/`, `/features`, `/contact`, potential pending pricing/privacy pages | Explain intended products without unsupported launch/price claims | No authentication or capture inferred; site routes **conceptual**, not live |
| Identity / onboarding | `/sign-in`, `/sign-up`, `/auth/callback`, `/recovery`, `/invitation/:invitationId` | OIDC identity, verified invites, new workspace bootstrap | Exact managed identity provider/CSRF/recovery choices **OPEN-001**, no password CRUD |
| Global workspace | `/app`, `/app/workspaces/new`, `/app/profile` | Choose authorized organization, start new workspace or identity settings | One global identity can have multiple **separate** memberships; only verified active orgs listed |
| Organization workspace | `/app/o/:orgId/...` | R0 overview/settings, entitled R1 Sales CRM and R2 Merchant Operations | **Every direct route and data request requires server-verified membership+entitlement+operation+record+field policy** |

The organization ID in a URL is **not** a permission grant, and a visible menu item is never an API authorization. No amount of client-side role-filtering replaces backend checks.

## 3. Complete UI route taxonomy

[Route inventory CSV](route-inventory.csv) has **64 distinct proposed UI route patterns**:

| Group | Route patterns | Owner-review scope |
|---|---:|---|
| Public concepts | **5** | Home, features, contact, pricing pending, privacy pending; no approved live pricing/legal/customer claims |
| R0 identity/global/organization | **19** | Managed identity placeholder, org select/bootstrap, member/invite/roles, app entitlements, mock billing, audit |
| R1 Sales CRM | **20** | Leads, contacts, accounts, deals, pipeline, tasks, scoped reports and import/export *metadata* |
| R2 Internal Merchant Operations | **15** | Internal application queue/cases, merchant/agent directory, owner-stage-next-action, checklist/history, stalled counts |
| Deferred specialist products | **5** | External agent portal, live payments, boarding, commissions/residuals, raw KYC/KYB — **NOT ROUTED / NOT LINKED** |
| **Total** | **64** | **All proposed, 0 implemented** |

The YAML [navigation tree](navigation.yml) proposes **27 visible menu entries across five groups** (public concept, workspace, sales, merchant operations, settings). Children, create/edit forms, record details, invitations and profile screens are reached through authorized contextual actions, deep links and/or global identity surfaces, **not duplicated in every sidebar**.

### Sitemap — R0/R1/R2

```text
PUBLIC CONCEPT (no live site or approved offer)
├── /                    Home concept
├── /features            Feature concept
├── /contact             Contact concept; actual capture not implemented
├── /pricing             Pending approved pricing (do not advertise price)
└── /legal/privacy       Pending reviewed legal text

IDENTITY (future managed OIDC, no custom passwords)
├── /sign-in
├── /sign-up
├── /auth/callback
├── /recovery
└── /invitation/:invitationId    Verified invitee + one-time proof TBD

GLOBAL WORKSPACE
├── /app                         Only authenticated, active member organizations
├── /app/workspaces/new          Verified new-tenant bootstrap only
└── /app/profile                 Managed identity profile settings TBD

ORGANIZATION /app/o/:orgId       Must verify selected active org on every protected request
├── /overview                    Authorized summary; never broad "owner sees everything"
├── /settings
│   ├── /general                 Safe organization profile
│   ├── /members                 Members and safe membership state
│   │   └── /:memberId           Restricted grants/revocation
│   ├── /invitations             Verified, allowlisted invites
│   ├── /roles                   Assignment-policy editor, not system role creator
│   ├── /apps                    Server-authoritative entitlement list
│   ├── /billing-demo            Mock billing only, no real charges
│   └── /audit                   Sanitized audit trail
├── /sales                       Only sales_crm entitlement AND operational permissions
│   ├── /leads[ /new /:leadId ]
│   ├── /accounts[ /new /:accountId ]
│   ├── /contacts[ /new /:contactId ]
│   ├── /deals[ /new /:dealId ]
│   ├── /pipeline                Keyboard-operable deal board later (P2.10)
│   ├── /tasks[ /new /:taskId ]
│   ├── /reports/pipeline
│   └── /transfers[ /:jobId ]    Metadata only; no raw CSV file endpoints
└── /operations                  Only merchant_ops entitlement AND row/field permissions
    ├── /queue                   Owner / INTERNAL stage / next action
    ├── /applications[ /new /:applicationId ]
    │   └── /:applicationId/history
    │   └── /:applicationId/checklist
    ├── /merchants[ /new /:merchantId ]
    ├── /agents[ /new /:agentId ]
    ├── /reports/stalled
    └── /stages                  Provisional customizable internal states

DEFERRED: /agent-portal, /payments, /boarding, /commissions, /kyc
    NONE of these five are active links, modules, supported API routes or real provider flows.
```

**Bracket/indentation is conceptual shorthand**, not actual Next.js directory syntax. Exact App Router folder naming and route parameters are P3 implementation decisions. No `frontend/app` routes exist.

## 4. Permission-aware menu computation contract

The UI may **request** a menu model, but only a future server/authorization layer can be authoritative. Proposed order:

1. Verify identity session using managed OIDC; verify no expired/revoked session. If not signed in, use authentication flow; never show cached protected content.
2. If org-scoped, server-verify active `Membership` for exact selected `orgId`. Reject guessed or inaccessible org IDs without confirming another organization's existence.
3. Compute **module entitlement** and only enable modules authorized for that organization. Entitlement alone is insufficient to open records.
4. Resolve precise P1.06 `permission-matrix.csv` row for action, resource, role and **row/field scope**. A role label is not a global allow grant. `ORG_OWNER` and `ORG_ADMIN` do **not** receive universal sales/merchant record access.
5. Hide unauthorized menu entries and protect direct URLs with a safe 403 or privacy-preserving 404; do not place hidden records/fields in HTML, browser search index, local storage, breadcrumbs, error messages, counts or prefetch.
6. On member/role/agent assignment revocation, the **next protected request** must be denied; invalidate stale menus and caches. A temporary visual menu cannot continue granting data.
7. Use explicit field projections and record-safe API queries for breadcrumbs, quick search, dashboard counts, exports and activity history.
8. Operations `C/U/M/E` need independently authorized controls: a user with read permission to the list does not automatically gain create, edit, stage transition, export, role-grant or billing actions.

| P1.06 permission example | UI implication | Prohibited shortcut |
|---|---|---|
| Authorized Sales Rep with scoped `leads:R` | Show only permitted lead list and safe record attributes | “Has Sales CRM → can read every sales lead” |
| Org Owner without CRM record read grant | May see appropriate org settings, **not hidden deal/merchant records** | “Owner sees everything” |
| Onboarding Coordinator with case grant | See assigned application, internal stage and next action | Expose raw KYC/processor status or another team’s cases |
| Agent Manager with authorized merchant assignments | Display only present portfolio as permitted | Old assignment remains visible after revocation |
| Billing Admin permitted billing reference | Show **demo plan / no charges**; cannot read all sales or real card details | Paid subscription/customer card claims |
| Security Reviewer with sanctioned sanitized audit | Can inspect allowlisted audit metadata, not full PII | Audit endpoint shows raw request payload |
| External agent or merchant | **No public self-service portal in R0–R2** | Log in as any org member via a deferred page |
| System worker / platform support | **No automatic tenant UI access** | Bypass membership via internal staff or worker label |

The YAML uses explicit **policy-resource identifiers, not hardcoded actual role grants**. Policy implementation and negative/positive access tests are still open risk G-003, G-013 and G-014.

## 5. Information hierarchy for primary screens

### Workspace shell

- **Top bar:** Verified organization switcher, workspace breadcrumb, environment label (“SYNTHETIC DEMO” for all current previews), current verified user context and account menu.
- **Sidebar:** Overview, entitled/authorized app groups, contextually allowed settings; no app launcher with misleading complete Zoho-parity features.
- **Main body:** Page title, screen purpose and primary next action; filter/sort/search only against permitted data; read-only status provenance.
- **Record area:** Merchant/Lead name, assigned owner, **internal status**, next action, update time and safe related tabs as permitted by policy.
- **Global search:** Proposed for a later UX specification; it must not become a cross-tenant search shortcut. Actual indexing contract does not exist.
- **Status system:** “Internal active” remains distinct from processor-authorized; `DEMO_ONLY_ACTIVE` stays “synthetic, unverified”. Mock billing stays explicitly mock.

### Desktop/tablet/mobile

| Width class (P2.01 proposed tokens) | Navigation pattern | Content strategy |
|---|---|---|
| 320–639px | Keyboard/screen-reader reachable drawer and short title bar | One-column task details, essential owner/stage/next action visible, safe list/card alternative to wide table |
| 640–1023px | Collapsible rail/sidebar plus top bar | Main list with detail drawer or stacked panel; no inaccessible hover-only actions |
| ≥1024px | Full sidebar, breadcrumbs, protected deep links | Data-first table, on-demand inspector; keep row/context permissions visible |
| ≥1440px | Full desktop workspace | Wider authorized report/queue, bounded content text, not stretched forms |

P2.16 must later check zoom, 320px, accessible focus, reduced motion, screen readers and keyboard operability. **No browser accessibility, screen-reader or customer usability testing has been performed.**

## 6. Proposed navigation and recovery flows

**J-A: Sign in → workspace:** Open sign-in → managed identity → query only active memberships → if zero, show safe new workspace/invitation help; if one, use selected org; if several, show picker → verify again on module entry. Never infer membership from a typed `orgId`.

**J-B: Sales lead → deal:** Open Sales CRM only with entitlement + permitted `leads:R`; open assigned record detail → read allowed fields → use separately permitted edit/transition, keep unsaved form state and version conflicts visible. A “won” deal does **not** imply processor boarding.

**J-C: Internal merchant onboarding:** Authorized queue → open permitted application → identify owner/internal stage/next action → optional safe checklist/history tabs if separately authorized → stage changes require distinct grant, version and audit. Processor status is a restricted **read-only synthetic demo** provenance concept.

**J-D: Organization administration:** Verified org → Settings → only permitted members/invitations/role grants → revoke roles with last-owner checks; do not show arbitrary private Sales/Operations records via admin UI.

**J-E: Switch tenant during work:** Alert on unsaved input → after user confirms, cancel pending tenant queries and clear per-tenant caches → verify new selected membership → recalculate entitlement/policy/menu → only then fetch target tenant records. Back/forward history must re-check new org; old app data should not flash.

## 7. Global UI error, denied, empty and not-entitled model

| State | Proposed screen behavior | Privacy/security expectation |
|---|---|---|
| Not authenticated | Redirect to managed login with bounded return destination | No open redirect, no restricted page content in HTML |
| No active membership | Org chooser (if other memberships exist), or safe “No access” | Do not reveal target organization or record exists |
| App not entitled | Explain module not enabled to authorized org admins only | No accidental API access or fake paywall/paid success |
| Role or row denied | Safe access-denied or privacy 404, request support path | No hidden title/count, sensitive note, owner or existence |
| Field denied | Omit field, action, search result and export column | Do not render hidden value then mask client-side |
| No permitted records | “No available records for your current access” | Do not imply organization truly has zero records |
| Filter returns empty | “No results matching these filters” + clear filters | Count based only on authorized rows |
| Record archived/unavailable | Minimal safe state and authorized navigation fallback | Cross-tenant IDs concealed |
| Session expired | Preserve non-sensitive draft locally only where designed; reauthenticate | No cached protected data rendered |
| Offline/error | “Changes not saved; retry” with correlation-safe message | No false success, unsafe autosubmit or leaks |
| Stale write / conflict | Fetch authorized new version, review changes and retry | Do not silently overwrite other user’s actions |
| Deferred/forbidden page | No active link; direct URL safe unavailable/404 | Must never accept real card/bank/KYC upload or provider activity |
| 320px/keyboard drawer | Trap/focus-return pattern proposed, ensure Escape and labels | Browser testing later; mock cannot prove accessibility |

## 8. Information architecture ↔ API mapping

The [64-route CSV](route-inventory.csv) maps each proposed screen to its P1.08 `operationId` where available, including scoped CRUD, internal application transitions and audit. **API_DEFINED** means an OpenAPI *design operation exists*, not Express code. **COMPOSED_API_DESIGN** means a view would depend on multiple future contracted calls. **AUTH_FLOW_PROVISIONAL, CONTRACT_GAP, UI_ONLY, PUBLIC_CONCEPT_ONLY, DEFERRED_NOT_ROUTED** explicitly describe non-implemented or unapproved portions.

The available [navigation.yml](navigation.yml) is a **structured design source**, not a Next.js route file or runtime RBAC implementation. Every sidebar entry in the route CSV is represented once in that YAML, and every deferred route is explicitly excluded from active navigation.

**P1.08 contract gaps carried into P3/P4:** managed identity password recovery and profile actions, permission-filtered workspace overview aggregation, CSRF/cookie provider selection, verified invitation acceptance semantics, exact route/record parameters, and access/safe breadcrumb fetch APIs (if needed). Do not invent successful backend endpoints.

## 9. Design-review test cases and limits

[Navigation review cases](navigation-review-cases.csv) are **new P2.02 paper-design scenarios** for route visibility, deep links, org switch, role changes, privacy and mobile navigation. They are **not included in the existing P1.09 727-test master inventory** without a future approved traceability change. Every scenario is `NOT_RUN_DOCUMENT_ONLY`; no UI test runner or browser validation has occurred.

**Current preservation obligations:** 14 G-001–G-014 source gaps and risks OPEN; 12 OPEN-001–012 decisions OPEN; 727 existing planned tests NOT RUN (0 executed/passed); P0.10 conditional internal synthetic-only GO; G-EXT/G-COM blocked. A P2.02 design approval does not close risk, implement permission enforcement, certify accessibility, validate real operator workflows or authorize external data use.

## 10. P2.02 owner-review exit gate

- [x] Original R0/R1/R2 app taxonomy and 64-route proposed sitemap documented.
- [x] 27 policy-aware visible navigation entries and five deferred, unlinked routes defined.
- [x] Explicit server-side identity/membership/entitlement/role+record/field flow and owner/admin non-universal access documented.
- [x] Safe direct links, tenant switching, disclosure prevention and responsive navigation specified.
- [x] Synthetic journey/navigation review scenarios prepared; no executed tests claimed.
- [ ] **Product owner approves** the proposed app taxonomy, navigation placement, public/auth/org URL scheme, permission-safe direct-link and mobile behavior as provisional UX design.
- [ ] **After owner approval**, close P2.02 issue #25 and open **P2.03 Marketing Website Wireframes**.

**P2.02 remains IN PROGRESS.** Route patterns, mobile navigation, public pages and roles have **not been implemented or verified in a running Next.js/Express application.**
