# Zoho Clone — Master Roadmap Progress

**Updated:** 2026-11-13
**Master roadmap:** `Zoho Clone Complete AI Master Roadmap v2.0`
**Current sub-phase:** **P2.02 — Information Architecture (DRAFT PREPARED, OWNER REVIEW PENDING)**
**Current authorization:** P0.10 owner-approved **CONDITIONAL GO** plus explicit 2026-11-14 owner approval to **start P3.01 code early in parallel with still-open P2.02**, **synthetic data only**. Not commercial GO.
**GitHub:** https://github.com/owaisprog/Zoho-Clone

## P0 audit and explicit owner decisions

| Sub-phase | Honest status | Evidence / issue |
|---|---|---|
| P0.01 Vision Charter | COMPLETE / approved | #3 closed |
| P0.02 Customer Segment Map | COMPLETE / approved desk-research priority | #4 closed |
| P0.03 Competitive Capability Matrix | COMPLETE / owner-approved vendor research | #5 closed |
| P0.04 Interview Playbook | CLOSED with explicit shortfall | #6 closed; actual interviews **0/15–25** |
| P0.05 Merchant Process Maps | SKIPPED by owner, NOT COMPLETED | #7 closed NOT PLANNED; **0/3** real workflows verified |
| P0.06 Data Sensitivity Inventory | COMPLETE as approved design documentation | #9 closed; classifications NOT implemented or certified |
| P0.07 MVP Value Proposition | **CLOSED — research validation WAIVED for internal sequencing only** | #10 closed NOT PLANNED; 0 qualified buyer claim tests |
| P0.08 Pricing Interviews | **CLOSED — five-buyer research WAIVED for internal sequencing only** | #11 closed NOT PLANNED; **0/5** buyer interviews; no approved prices |
| P0.09 Pilot/Design Partner Criteria | **CLOSED through authorized 'continue without partners' option** | #12 closed; **0/2** actual commitments |
| P0.10 Build/No-build Gate | **APPROVED — CONDITIONAL INTERNAL GO ONLY** | #13 closed; owner signed 2026-11-13; external/production GO not granted |

**P0 conclusion:** Documentation packages completed and the **internal build/requirements transition authorized**; market validation and production readiness are **not** achieved. See [Phase P0 ledger](p0-phase-ledger.md), [waiver decision](product/p0-07-09-research-waivers.md) and [signed decision](product/phase0_gate.md).

## Outstanding evidence, safety and legal obligations

- Customer problem evidence: **0 interviews**, research issue [#8](https://github.com/owaisprog/Zoho-Clone/issues/8) remains OPEN.
- Real merchant process validation: **0/3**, P0.05 skipped for sequencing only.
- Measured value outcome: **0 prospect tests / 0 controlled time measurements**; any 30% claim is **only a target**.
- Buyer pricing research: **0/5**; hypothetical plan anchors are NOT public prices.
- Design partners: **0/2**; internal work allowed without partners, real pilots not authorized.
- Legal entity/jurisdiction, product brand, processor integration contracts, retention rules and customer data contracts remain UNDECIDED.
- Cross-tenant isolation, authentication, forbidden-data rejection, privacy and security reviews must be **implemented and tested** before any real customer data or external release. Nothing is certified.

## P1 — Requirements, specifications and acceptance contracts

[Full ten-subphase P1 tracker](p1-phase-plan.md)

| P1 sub-phase | Status |
|---|---|
| P1.01 Master PRD | **COMPLETE — OWNER APPROVED 2026-11-13**, [Issue #14](https://github.com/owaisprog/Zoho-Clone/issues/14) closed |
| P1.02 Functional SRS | **COMPLETE — OWNER APPROVED 2026-11-13**, [Issue #15](https://github.com/owaisprog/Zoho-Clone/issues/15) closed; 49 requirements / 59 future tests |
| P1.03 Nonfunctional SRS | **COMPLETE — OWNER APPROVED DESIGN TARGETS on 2026-11-13**, [Issue #16](https://github.com/owaisprog/Zoho-Clone/issues/16) closed; 46 unmeasured targets / 52 future tests |
| P1.04 Personas and Journeys | **COMPLETE — owner-approved provisional baseline on 2026-11-13**, [Issue #17](https://github.com/owaisprog/Zoho-Clone/issues/17) closed; 12 synthetic personas, 18 journeys, 72 steps, 36 future tests NOT RUN |
| P1.05 Feature Hierarchy and Release Gates | **COMPLETE — OWNER APPROVED INTERNAL PLANNING BASELINE on 2026-11-13**, [Issue #18](https://github.com/owaisprog/Zoho-Clone/issues/18) closed; 36 features and R0/R1/R2 vs external gate design approved as requirements |
| P1.06 Permission and Sharing Matrix | **COMPLETE — OWNER APPROVED DESIGN REQUIREMENTS on 2026-11-13**, [Issue #19](https://github.com/owaisprog/Zoho-Clone/issues/19) closed; 286 proposed rules / 52 tests NOT RUN; no security controls implemented |
| P1.07 Domain Glossary and Sample Records | **COMPLETE — OWNER APPROVED PROVISIONAL DESIGN 2026-11-13**, [Issue #20](https://github.com/owaisprog/Zoho-Clone/issues/20) closed; 31 entities, 230 fields, 68 fictional records; no DB or tests |
| P1.08 API and Event Contract Spec | **COMPLETE — owner-approved provisional design 2026-11-13**, [Issue #21](https://github.com/owaisprog/Zoho-Clone/issues/21) closed; 67 proposed operations/16 events/164 future cases NOT RUN |
| P1.09 Acceptance and Traceability Map | **COMPLETE — OWNER APPROVED PLANNING ONLY on 2026-11-13**, [Issue #22](https://github.com/owaisprog/Zoho-Clone/issues/22) closed; 727 future cases NOT RUN and 14 gaps remain OPEN |
| P1.10 Risk and Decision Register | **COMPLETE — owner-approved TRACKING PLANNING on 2026-11-13**, [Issue #23](https://github.com/owaisprog/Zoho-Clone/issues/23) closed; all 14 evidence risks and 12 open decisions remain OPEN |

### P1.01 completed and P1.02 drafted
- [x] [Master PRD](product/prd.md) — problem, users, personas, scope, major use cases, releases, non-goals, success measurement, dependencies and open unknowns.
- [x] [26 use-case/release rows](product/prd-release-matrix.csv) — mapped to R0 platform, R1 CRM, R2 MerchantOps and later features.
- [x] [Fictional demo fixtures](product/prd-synthetic-fixtures.json) — two separate invented orgs, 5 example merchant applications, negative access/data tests.
- [x] [P1 execution plan](p1-phase-plan.md) — ten requirement sub-phases and gates.
- [x] Product owner approved R0/R1/R2 scope and all initial release priorities on 2026-11-13.
- [x] P1.01 issue #14 closed and P1.02 Functional SRS started in issue #15.

### P1.02 current deliverables
- [x] [Functional SRS](product/srs.md) — 49 detailed behavioral requirements, policy/validation, error/recovery patterns.
- [x] [Requirements CSV](product/srs-requirements.csv) — every one of the 26 approved PRD use cases traced.
- [x] [Provisional state transitions](product/srs-state-transitions.md) — lead, deal, task, membership and internal merchant workflows.
- [x] [Acceptance cases](product/srs-acceptance-cases.csv) — 59 future test cases, **NOT EXECUTED**.
- [x] Product owner approved P1.02 functional behavior, permissions, errors and provisional state rules on 2026-11-13; issue #15 closed.

### P1.03 owner-approved requirements
- [x] [Nonfunctional SRS](product/nfr.md): **46** proposed measurable requirements across 10 domains.
- [x] [NFR matrix](product/nfr-matrix.csv): metric, verification, phase/owner and hard gate.
- [x] [Synthetic benchmark/verification plan](product/nfr-verification-plan.md): 25 VU/10 demo organizations, performance profile, backup/restore, security and accessibility checks.
- [x] [NFR acceptance cases](product/nfr-acceptance-cases.csv): **52 future tests, NONE EXECUTED**.
- [x] Owner approved P1.03 performance, RPO/RTO, accessibility and mandatory security gates as DESIGN REQUIREMENTS only, on 2026-11-13; issue #16 closed. **No performance or security tests run.**

### P1.04 owner-approved provisional design baseline
- [x] [12 personas](product/personas.md), including ISO buyer, internal admin/sales/onboarding/agent manager and future external roles.
- [x] [18 journeys](product/journeys.md) and [72 synthetic mapped steps](product/journey-map.csv) covering all 26 PRD use cases.
- [x] [36 future journey acceptance cases](product/journey-acceptance-cases.csv), **NOT RUN**.
- [x] Owner approved P1.04 personas/journeys **only as provisional design assumptions** on 2026-11-13; issue #17 closed. No customer interview validation implied.

### P1.05 owner-approved planning baseline
- [x] [Feature hierarchy](product/features.md) — 36 planned features across R0, R1, R2, cross-cutting and deferred full-suite modules.
- [x] [MVP backlog](product/mvp-backlog.csv) — 24 MUST, 6 SHOULD and 6 DEFERRED, with dependencies, phases and acceptance conditions.
- [x] [Feature traceability](product/feature-traceability.csv) — all 26 approved PRD use cases and 49 SRS functional requirements assigned.
- [x] [Release gates](product/release-gates.md) — product-slice internal sandbox, external pilot and commercial readiness separated.
- [x] Owner approved P1.05 priorities, exclusions, dependency order and internal-vs-external gates as DESIGN/PLANNING on 2026-11-13; issue #18 closed. No software implemented or release gate passed.

### P1.06 owner-approved permissions design
- [x] [Permission matrix](security/permission-matrix.md) — 13 actor roles, 22 resource families, deny by default and explicit field/row access.
- [x] [Permission matrix CSV](security/permission-matrix.csv) — 286 draft role/resource decisions; 217 default-denied.
- [x] [Authorization policy rules](security/permission-policy-rules.md) — server authorization order, active membership, role/record/field scopes, revocation, audit and safe worker restrictions.
- [x] [52 proposed negative access scenarios](security/permission-negative-cases.csv) — **NOT RUN**.
- [x] Owner approved P1.06 least-privilege roles, default deny, tenant isolation and record/field sharing as **DESIGN ONLY**, on 2026-11-13; issue #19 closed. Security implementation and tests remain undone.

### P1.07 owner-approved provisional design
- [x] [31-entity glossary](product/domain-glossary.md) for R0/R1/R2 and deferred provider references.
- [x] [230-row field dictionary](product/domain-dictionary.csv) with types, classifications, allowlists and explicit forbidden-field examples.
- [x] [33 relationship rules](product/domain-relationships.md) for same-org joins, stage history, assignment and source boundaries.
- [x] [68 fictional sample records](product/domain-synthetic-records.json) across two demo organizations; no real customer/payment information.
- [x] [46 future domain validation scenarios](product/domain-validation-cases.csv) — **NOT RUN**.
- [x] Owner approved P1.07 glossary, classified fields, provisional states, relations and synthetic records **as design only** on 2026-11-13; issue #20 closed. Not an implemented database schema.

### P1.08 owner-approved provisional API/event design
- [x] [API contracts](api/api-contracts.md) and [draft OpenAPI 3.1](api/openapi-v1.json): **67 operations**, 44 paths, 72 schemas. No actual server routes.
- [x] [API/FR/UC/feature traceability](api/api-traceability.csv): 18 PRD UC and 37 Functional FR with direct API operations; cross-cutting UI/QA and deferred specialist modules intentionally not exposed.
- [x] [16 internal event types and outbox design](api/event-contracts.md), [catalog](api/event-catalog.csv) and [JSON Schema](api/event-envelope.schema.json): **not emitted**.
- [x] [164 future contract/security cases](api/api-contract-cases.csv): all **NOT EXECUTED**.
- [x] Owner approved P1.08 API/event contracts as **provisional design requirements** on 2026-11-13; issue #21 closed. No API endpoints/event workers/contract tests implemented.

### P1.09 approved acceptance planning
- [x] [Traceability and evidence rules](qa/acceptance-traceability.md) with **121/121** UC/FR/NFR planning-test links.
- [x] [Requirement coverage CSV](qa/requirements-coverage.csv), [feature coverage CSV](qa/feature-coverage.csv): **36/36** features have planned-test links, not proven independent implementation coverage.
- [x] [727 future test cases](qa/test-inventory.csv), including [286 permission decision cases](qa/permission-decision-cases.csv) and [32 event scenarios](qa/event-acceptance-cases.csv) — **0 executed**.
- [x] [Release acceptance gates](qa/release-acceptance-gates.md) and [14-item gap register](qa/coverage-gaps.md).
- [x] Owner approved P1.09 test and evidence mapping **as internal planning, not executed/passed tests** on 2026-11-13; issue #22 closed. **All 14 evidence gaps remain OPEN.**

### P1.10 owner-approved risk/decision tracking (not mitigation)
- [x] [14-item open risk register](product/p1-risk-register.csv) and [risk guidance](product/p1-risk-register.md): all original G-001 through G-014 mapped and **OPEN**.
- [x] [12 open future decisions](product/p1-decision-backlog.csv) and [decision narrative](product/p1-decision-register.md): no unapproved choice fabricated as decided.
- [x] [Risk mitigation plan](product/p1-risk-mitigation-plan.md): proposed roles/actions/checkpoints plus external/commercial gates.
- [x] Owner explicitly approved P1.10 risk/decision tracking and starting P2 as **internal planning only** on 2026-11-13; issue #23 closed. **No G-001..G-014 or OPEN-001..012 was resolved**.

**0 of 727 tests executed, 0 passed. No executable app/schema/authorization/runtime security evidence exists. G-EXT and G-COM remain blocked.** `frontend/` and `backend/` remain placeholder folders, not running Next.js/Express applications.

## P2 — UX and Interface Design (17 sub-phases)

**Phase entered:** 2026-11-13 after owner-approved P1.10 tracking. The [P2 phase plan](design/p2-phase-plan.md) follows roadmap P2.01–P2.17; all design screens and example data must be **synthetic and original**. P2 planning completion will not imply tested code, market proof or external release approval.

| Sub-phase | Status / evidence |
|---|---|
| P2.01 Brand and Design Tokens | **COMPLETE — owner-approved provisional original internal UX baseline (2026-11-13)**. [Brand guidance](design/brand-and-tokens.md), [154-token JSON](design/design_tokens.json), [27 sampled contrast formula checks](design/color-contrast-review.csv), [component rules](design/component-examples.md), [static synthetic preview](design/token-preview.html). [Issue #24](https://github.com/owaisprog/Zoho-Clone/issues/24) CLOSED. Not final brand, certified accessibility or implemented UI. |
| **P2.02 Information Architecture** | **IN PROGRESS — 64 proposed route patterns, 27 menu entries, 5 intentionally deferred routes and 40 future IA design cases**. [Information Architecture](design/information-architecture.md), [navigation.yml](design/navigation.yml), [route inventory](design/route-inventory.csv), [navigation review cases](design/navigation-review-cases.csv). [Issue #25](https://github.com/owaisprog/Zoho-Clone/issues/25) OPEN; owner review pending. |
| P2.03–P2.17 UX/screens/usability | NOT STARTED — tracked individually in phase plan. |

**P2.01 owner gate PASSED as provisional design, not final branding or verified accessibility (2026-11-13). P2.02 owner gate PENDING:** Approve proposed original IA, 64 route patterns, visible/hidden permission states, safe direct-link/tenant switch and mobile hierarchy before P2.03. All **14 risks and 12 unresolved decisions remain OPEN**, with **727 P1 tests still NOT RUN**. The 40 additional IA review scenarios are paper-design checks separate from the P1 test inventory.

## Parallel P3.01 — First REAL frontend/backend source (early start)

**Owner authorization:** 2026-11-14 approval to begin actual Next.js frontend and Express.js backend implementation **before completing P2**. This is a bounded internal-synthetic exception to the original sequential roadmap. **P2.02 UX information architecture remains OPEN in issue #25; P3.01 scaffold remains OPEN in issue #26 for review.**

| Actual code / evidence | Verified status |
|---|---|
| \`frontend/package.json\`, \`frontend/src/app\`, components, token CSS | **COMMITTED** — Next.js 16.4.6 App Router, React/TypeScript, responsive original landing/workspace/sales/merchant pages |
| \`frontend/src/lib/synthetic-data.ts\` | **COMMITTED** — 5 invented internal cases + 4 fictional example.com leads; no external or customer data |
| \`backend/src/app.ts\`, \`server.ts\`, \`config.ts\` | **COMMITTED** — Express 5 health-only route \`GET /api/v1/health\`, safe 404/errors and localhost bind |
| Scaffold tests in \`frontend/test\`, \`backend/test\` | **13 ACTUALLY PASSED** (9 frontend + 4 backend) in [GitHub Actions run #43493982182](https://github.com/owaisprog/Zoho-Clone/actions/runs/43493982182), commit \`a6fb6c8b6391738f3bdddb01e11ed7bc6a7d208f\` |
| TypeScript checks / builds | **PASS** same actual run for both workspaces |
| Original P1.09 planned acceptance inventory | **727/727 STILL NOT RUN** — unrelated future auth/tenant/security/CRM tests |
| Runtime identity, role/record/field guards, Prisma schema, protected business APIs, DB, processor/production | **NOT IMPLEMENTED**, not inferred from process-health or demo UI |
| Requirements/gates | All **14 risks/gaps** and **12 undecided choices** remain OPEN; G-EXT/G-COM BLOCKED; research issue #8 OPEN |

[Engineering handoff and scope notes](engineering/p3-early-start.md) document exact scripts and the absence of real customer data/production. No PostgreSQL or Prisma migration is created as an unapproved ID/tenant model decision. CI npm install without lockfile is a known improvement opportunity. The 13 scaffold passes are not a substitute for required original 727 product test cases.

## Technical decisions (unchanged)

Frontend Next.js + React + TypeScript + Tailwind/shadcn; backend Node.js + Express.js + TypeScript; PostgreSQL/Prisma and Redis/BullMQ when justified; modular monolith, versioned REST/OpenAPI and tenant/record policy checks.

## Operating boundary

No real merchant/card/bank/identity/KYC data; no live processor credentials, payment collection, production deployment or external pilot without fresh explicit approvals and verified controls. Public GitHub must contain synthetic/anonymized-only examples, no secrets or identifiable interview material.


## Parallel P3 batch 01 — Five real-code subphases (P3.03–P3.07)

**Implemented 2026-11-14; owner feature/UX review pending.** These are an authorized
synthetic-only engineering batch in parallel with open P2.02. Code is on
[draft stacked PR #28](https://github.com/owaisprog/Zoho-Clone/pull/28),
which depends on draft P3.02 PR #27. Neither is merged into `main`.

| Engineering subphase | Actual GitHub evidence | Review status |
|---|---|---|
| [P3.03 #29](https://github.com/owaisprog/Zoho-Clone/issues/29) — build hardening | Node 22 `package-lock.json`, `npm ci` CI, localhost-only demo URL tests | Code/CI passed; owner review pending |
| [P3.04 #30](https://github.com/owaisprog/Zoho-Clone/issues/30) — synthetic contract | New shared `@zoho-clone/demo-contracts` npm workspace, exact canonical record validation in Express/Next adapter | Code/CI passed; owner review pending |
| [P3.05 #31](https://github.com/owaisprog/Zoho-Clone/issues/31) — UI | Improved breadcrumbs, derived demo pipeline and responsive metrics | Code/CI passed; owner review pending |
| [P3.06 #32](https://github.com/owaisprog/Zoho-Clone/issues/32) — lead interaction | Search/filter and fictional in-memory create/edit; no API writes or persistence | Code/CI passed; owner review pending |
| [P3.07 #33](https://github.com/owaisprog/Zoho-Clone/issues/33) — error/QA | Generic error, loading/not-found, HTTP safety and adapter tests | Code/CI passed; owner review pending |

**Independent CI result:** [run #43499956192](https://github.com/owaisprog/Zoho-Clone/actions/runs/43499956192) SUCCESS at `8f181cab93d735d68f07a5e915350744194e040b`. **21 frontend + 11 backend + 4 shared tests = 36 passed / 0 failed**, npm ci from committed lockfile, both TypeScript checks and Next.js/Express builds passed. Actual manual browser UX, accessibility, security, production operations and integration with real data were NOT exercised.

**Unchanged gates:** 727 original P1.09 future acceptance/security cases remain NOT RUN; 40 P2.02 IA design cases remain NOT RUN; all 14 original evidence risks and 12 unresolved product decisions remain OPEN. P3.01 #26 and P2.02 #25 are not approved/closed. G-EXT and G-COM remain BLOCKED. No real credentials, customer data, tenant auth, protected CRM CRUD, PostgreSQL/Prisma, live processor/boarding/payments or public deployment. This batch is a CI-verified internal prototype, not production-complete functionality.


## Parallel P3 Batch 02 — five additional subphases (P3.08–P3.12)

**Implemented 2026-11-14 on separate branch `feat/p3-batch-02`; CI passed, owner review pending.** This early P3 engineering sequence covers fictional lead detail/session events, internal-only MerchantOps queue updates, fixed synthetic tasks API and board, shared sorting/pagination, and negative safety tests. [Implementation handoff](engineering/p3-batch-02.md).

P3.08–P3.12 are implementation slices in the synthetic preview, not full production-ready CRM functionality or a replacement for any P2 design signoffs. The new \`/app/tasks\` route is provisional pending P2.02 review.

**Still unchanged:** all 14 risks/gaps OPEN; all 12 decisions OPEN; all 727 P1.09 acceptance/security cases NOT RUN; all 40 P2.02 IA review cases NOT RUN; P2.02 #25/P3.01 #26 open; PR #27 and #28 draft. G-EXT/G-COM BLOCKED. No identity, secure tenant DB, customer data, protected CRUD, processor approval, KYC or production release.

**P3 Batch 02 CI evidence:** [run #43502348085](https://github.com/owaisprog/Zoho-Clone/actions/runs/43502348085) completed SUCCESS: 34 frontend + 13 backend + 5 shared = **52 scaffold/demo tests passed**, typechecks, locked npm install and builds passed. [Draft PR #34](https://github.com/owaisprog/Zoho-Clone/pull/34); review issues #35–#39 remain OPEN. This does not affect the 727 original NOT_RUN acceptance cases or 14 open risks / 12 decisions.
