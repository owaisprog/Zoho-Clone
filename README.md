# Zoho Clone

**Status:** **P0.10 owner-approved CONDITIONAL INTERNAL GO; P1.01 Master PRD approved; P1.02 Functional SRS approved; P1.03 Nonfunctional SRS approved as design; P1.04 Personas and Journeys approved provisionally; P1.05 Feature Hierarchy and Release Gates approved as planning; P1.06 Permission and Sharing Matrix approved as design; P1.07 Domain Glossary and Synthetic Sample Records owner-approved as provisional design; P1.08 API and Event Contract Specification owner-approved as design; P1.09 Acceptance and Traceability Map owner-approved as internal planning; P1.10 Risk and Decision Register owner-approved for tracking only; P2.01 Brand and Design Tokens owner-approved as provisional internal UX; P2.02 Information Architecture in progress; **P3.01 actual Next.js and Express.js source started early in parallel**, with 13 new scaffold tests passed in GitHub Actions. All 14 risks and 12 decisions remain OPEN; the original 727 P1 tests remain NOT RUN.** P0.07 and P0.08 market evidence gates were waived **for internal sequencing only**, and P0.09 elected continuation without partners. P0 is **not commercially validated**; only synthetic-data internal development is authorized.

Zoho Clone is the working name of an original, AI-led, multi-tenant SaaS ecosystem designed to provide integrated business applications. The long-term scope is comparable in breadth to the Zoho ecosystem, but the software, code, branding, and user experience will be independently developed.

## Run the first real frontend and backend

**P3.01 is now actual source code, not documentation.** Use Node.js **22+** and npm. From this repository's root:

~~~sh
npm install
npm run dev:api
~~~

In a **second terminal**, from the same repository:

~~~sh
npm run dev:web
~~~

Open **http://localhost:3000** for the original concept landing page and
**http://localhost:3000/app** for the synthetic dashboard. The Express process
health endpoint is **http://127.0.0.1:4000/api/v1/health**.

Run checks:

~~~sh
npm run typecheck
npm run test
npm run build
~~~

**Verified CI evidence:** [P3 scaffold run #43493982182](https://github.com/owaisprog/Zoho-Clone/actions/runs/43493982182)
on commit \`a6fb6c8b6391738f3bdddb01e11ed7bc6a7d208f\`: frontend TypeScript PASS,
backend TypeScript PASS, **9 frontend + 4 backend scaffold tests PASS**, Next.js build PASS,
Express build PASS. The original **727 P1.09 product acceptance cases remain NOT RUN**.
These 13 tests are additional scaffold tests and do not establish security, DB or tenancy readiness.

**Important:** The demo pages are publicly readable fictional examples with **NO login,
tenant RBAC, database, commercial billing or processor connection**. They are not
safe for real customer/card/bank/identity/KYC data or external production. P2.02
remains open; its final route architecture can change the temporary preview routes.
All 14 evidence risks and 12 open decisions remain outstanding. GitHub CI currently
uses \`npm install\` without a checked-in lockfile; lockfile/fully reproducible install
is a near-term improvement.

## Repository structure

- [frontend/](frontend/README.md) — **working Next.js 16/React/TypeScript App Router source**, Tailwind CSS and original shared token CSS; shadcn component integration is later.
- [backend/](backend/README.md) — **working Node.js/Express 5/TypeScript health-only source**; PostgreSQL/Prisma/auth/Redis/BullMQ are future, not installed or verified.
- [docs/product/vision.md](docs/product/vision.md) - P0.01 Business Vision Charter.
- [docs/product/decisions.md](docs/product/decisions.md) - Product and technical decisions.
- [docs/roadmap-progress.md](docs/roadmap-progress.md) - Active roadmap checkpoint.

- [docs/product/icp.md](docs/product/icp.md) - P0.02 Customer Segment Map (owner-approved initial segment ranking; customer validation later).

- [docs/product/competitive-capability-matrix.md](docs/product/competitive-capability-matrix.md) - P0.03 vendor capability comparison (owner-approved research baseline; prospect validation pending).
- [docs/product/competitive-evidence.md](docs/product/competitive-evidence.md) - Official vendor source register and evidence limitations.

- [docs/product/customer-interview-playbook.md](docs/product/customer-interview-playbook.md) - P0.04 interview protocol (owner-approved; 0 of 15-25 target interviews actually completed).
- [docs/product/interview-question-bank.md](docs/product/interview-question-bank.md) - interview questions and segment-specific probes.
- [docs/product/interview-execution-plan.md](docs/product/interview-execution-plan.md) - recruiting quotas, evidence handling and decision gates.

- [docs/product/p0-04-interview-shortfall.md](docs/product/p0-04-interview-shortfall.md) - explicit research shortfall and owner handoff.
- [docs/product/workflow-maps.md](docs/product/workflow-maps.md) - P0.05 draft ISO, POS and PayFac swimlanes (unvalidated).
- [docs/product/workflow-validation.md](docs/product/workflow-validation.md) - three real-world workflow validation gate.
- [docs/product/workflow-scenarios.csv](docs/product/workflow-scenarios.csv) - 20 synthetic future test scenarios.

- [docs/product/p0-06-data-sensitivity-prework.md](docs/product/p0-06-data-sensitivity-prework.md) - archived P0.06 preliminary notes; replaced by active draft inventory.

- [docs/product/p0-05-validation-waiver.md](docs/product/p0-05-validation-waiver.md) - owner-directed P0.05 skip (not completed).
- [docs/product/data_classification.md](docs/product/data_classification.md) - P0.06 owner-approved data classification design (not implemented certification).
- [docs/product/data-inventory.csv](docs/product/data-inventory.csv) - 36 candidate data categories.
- [docs/product/prohibited-fields.md](docs/product/prohibited-fields.md) - initial CRM sensitive-data exclusions.
- [docs/product/file-handling-policy.md](docs/product/file-handling-policy.md) - future private-file safety policy.
- [docs/product/p0-06-security-review.md](docs/product/p0-06-security-review.md) - P0.06 risk/design review; jurisdiction and security implementation remain open.

- [docs/product/positioning.md](docs/product/positioning.md) - P0.07 MVP positioning draft.
- [docs/product/landing-copy.md](docs/product/landing-copy.md) - P0.07 two landing copy concepts (not published).
- [docs/product/value-validation-plan.md](docs/product/value-validation-plan.md) - P0.07 measurable customer value test.
- [docs/product/value-claims.csv](docs/product/value-claims.csv) - proposed marketing claims and evidence restrictions.

## P0 complete documentation package (prepared, not a validated exit)

- [P0 ten-subphase audit](docs/p0-phase-ledger.md)
- [P0.07 positioning](docs/product/positioning.md), [landing copy](docs/product/landing-copy.md), [claim testing](docs/product/value-validation-plan.md)
- [P0.08 pricing hypotheses](docs/product/pricing_hypotheses.md), [buyer worksheet](docs/product/pricing-interview-worksheet.csv), [competitor price notes](docs/product/pricing-competitor-notes.md)
- [P0.09 pilot criteria](docs/product/pilot_plan.md), [scorecard](docs/product/pilot-scorecard-template.csv), [qualification template](docs/product/pilot-qualification-template.md)
- [P0.10 build/no-build gate](docs/product/phase0_gate.md), [open risks](docs/product/p0-critical-risks.csv)

**P0 DECISION:** Product owner explicitly approved conditional internal GO on 2026-11-13; see [owner waiver record](docs/product/p0-07-09-research-waivers.md) and [signed build gate](docs/product/phase0_gate.md). Real market evidence and production security/contract/legal release gates are outstanding. Production, live payments, real merchant data and public commercial use are NOT authorized.

## P1 — Requirements (owner-approved planning/design only)

- [P1 sub-phase plan](docs/p1-phase-plan.md) — P1.01 through P1.10 requirements work.
- [P1.01 Master PRD](docs/product/prd.md) — first Merchant Operations CRM, prioritized releases and non-goals; owner-approved 2026-11-13.
- [P1.01 release/use-case matrix](docs/product/prd-release-matrix.csv) — 26 scoped use cases.
- [P1.01 synthetic-only fixture examples](docs/product/prd-synthetic-fixtures.json) — fictional organizations and merchant cases, NOT a running database seed.
- [P1.01 GitHub issue](https://github.com/owaisprog/Zoho-Clone/issues/14) — closed after owner approval.
- [P1.02 Functional SRS](docs/product/srs.md) — 49 requirements (owner-approved 2026-11-13).
- [P1.02 requirements CSV](docs/product/srs-requirements.csv) — traceability to all 26 approved use cases.
- [P1.02 state transitions](docs/product/srs-state-transitions.md) — provisional status flows, actor restrictions and recovery.
- [P1.02 acceptance cases](docs/product/srs-acceptance-cases.csv) — 59 planned future test cases, not executed.
- [P1.02 GitHub issue](https://github.com/owaisprog/Zoho-Clone/issues/15) — closed after owner approval.
- [P1.03 Nonfunctional SRS](docs/product/nfr.md) — 46 owner-approved design targets, not measured or certified.
- [P1.03 requirements matrix](docs/product/nfr-matrix.csv) — measurable budgets and release gates.
- [P1.03 verification plan](docs/product/nfr-verification-plan.md) — synthetic benchmark/security/backup protocols.
- [P1.03 acceptance cases](docs/product/nfr-acceptance-cases.csv) — 52 planned future tests, not executed.
- [P1.03 GitHub issue](https://github.com/owaisprog/Zoho-Clone/issues/16) — closed after owner approval.
- [P1.04 User Personas](docs/product/personas.md) — 12 synthetic user profiles; owner review pending.
- [P1.04 User Journeys](docs/product/journeys.md) — 18 workflows, including security/error branches.
- [P1.04 Step Map](docs/product/journey-map.csv) — 72 steps tracing to all 26 PRD use cases.
- [P1.04 Acceptance Cases](docs/product/journey-acceptance-cases.csv) — 36 future tests, none executed.
- [P1.04 GitHub issue](https://github.com/owaisprog/Zoho-Clone/issues/17) — closed after owner approval as a provisional design baseline.
- [P1.05 feature hierarchy](docs/product/features.md) — 36 planned features, R0 shared platform/R1 CRM/R2 merchant operations, future app families.
- [P1.05 prioritized MVP backlog](docs/product/mvp-backlog.csv) — 24 MUST, 6 SHOULD, 6 DEFERRED features; not implemented.
- [P1.05 UC/FR traceability](docs/product/feature-traceability.csv) — all 26 approved PRD use cases and 49 Functional SRS requirements covered.
- [P1.05 release gates](docs/product/release-gates.md) — synthetic-only internal acceptance versus external pilot/commercial hard blockers.
- [P1.05 GitHub issue](https://github.com/owaisprog/Zoho-Clone/issues/18) — closed after owner approval as an internal planning baseline.
- [P1.06 Permission Matrix](docs/security/permission-matrix.md) — roles, access scopes, field restrictions and default deny.
- [P1.06 Matrix CSV](docs/security/permission-matrix.csv) — 286 proposed role/resource decisions across 13 actors and 22 resources.
- [P1.06 Policy Rules](docs/security/permission-policy-rules.md) — safe authorization order, revocation and tenant/record checks.
- [P1.06 Negative Cases](docs/security/permission-negative-cases.csv) — 52 future access tests, none executed.
- [P1.06 GitHub issue](https://github.com/owaisprog/Zoho-Clone/issues/19) — closed after owner approval as design requirements only.
- [P1.07 Domain Glossary](docs/product/domain-glossary.md) — 31 proposed entities and bounded context definitions.
- [P1.07 Domain Dictionary](docs/product/domain-dictionary.csv) — 230 proposed field definitions and data classifications.
- [P1.07 Domain Relationships](docs/product/domain-relationships.md) — 33 tenant-safe relationship design rules.
- [P1.07 Synthetic Records](docs/product/domain-synthetic-records.json) — 68 fictional records across two demo organizations, not database seeds.
- [P1.07 Domain Validation Cases](docs/product/domain-validation-cases.csv) — 46 future tests, not executed.
- [P1.07 GitHub issue](https://github.com/owaisprog/Zoho-Clone/issues/20) — closed after provisional design approval, not a running database.
- [P1.08 REST API Contracts](docs/api/api-contracts.md) — versioned HTTP, errors, tenant-scoped authorization and synthetic-only restrictions.
- [P1.08 OpenAPI 3.1 Draft](docs/api/openapi-v1.json) — 67 proposed operations, 44 paths and 72 schemas, NOT IMPLEMENTED.
- [P1.08 API/Requirement Map](docs/api/api-traceability.csv) — 18/26 PRD use cases and 37/49 FR mapped to direct routes; remaining UI/test/deferred.
- [P1.08 Internal Event Contracts](docs/api/event-contracts.md) — 16 events and outbox design, NOT RUNNING.
- [P1.08 Event Catalog](docs/api/event-catalog.csv) and [Envelope JSON Schema](docs/api/event-envelope.schema.json) — safe proposed message definitions.
- [P1.08 Contract Acceptance Cases](docs/api/api-contract-cases.csv) — 164 planned future tests, none executed.
- [P1.08 GitHub issue](https://github.com/owaisprog/Zoho-Clone/issues/21) — closed after owner-approved provisional design; no API/events running.
- [P1.09 Acceptance & Traceability](docs/qa/acceptance-traceability.md) — all 121 UC/FR/NFR have planned tests; no execution.
- [P1.09 Requirement Coverage](docs/qa/requirements-coverage.csv) and [Feature Coverage](docs/qa/feature-coverage.csv) — 121 requirements and 36 features mapped.
- [P1.09 Test Inventory](docs/qa/test-inventory.csv) — 727 future tests (all NOT RUN).
- [P1.09 Permission Decision Cases](docs/qa/permission-decision-cases.csv) — 286 proposed policy tests.
- [P1.09 Event Acceptance Cases](docs/qa/event-acceptance-cases.csv) — 32 proposed event tests.
- [P1.09 Release Acceptance Gates](docs/qa/release-acceptance-gates.md) and [Coverage Gap Register](docs/qa/coverage-gaps.md) — real evidence/production boundaries.
- [P1.09 GitHub issue](https://github.com/owaisprog/Zoho-Clone/issues/22) — closed after owner approved planning only; 727 tests NOT RUN, 14 gaps OPEN.
- [P1.10 Open Risk Register](docs/product/p1-risk-register.md) and [CSV](docs/product/p1-risk-register.csv) — 14 original P1.09 G-001..G-014 gaps retained **OPEN**, with proposed priorities/mitigations and real evidence needs.
- [P1.10 Decision Register](docs/product/p1-decision-register.md) and [Open Decision Backlog](docs/product/p1-decision-backlog.csv) — existing owner-approved design baselines distinguished from 12 unresolved choices.
- [P1.10 Risk Mitigation Sequencing](docs/product/p1-risk-mitigation-plan.md) — phase checkpoints, accountability and G-INT versus blocked G-EXT/G-COM.
- [P1.10 GitHub issue](https://github.com/owaisprog/Zoho-Clone/issues/23) — CLOSED as owner-approved tracking only; all 14 risks and 12 decisions remain OPEN.

## P2 — Product UX and Interface Design (active)

- [P2.01–P2.17 UX phase plan](docs/design/p2-phase-plan.md) — full 17-step design sequence and owner checkpoints.
- [P2.01 Original Brand & Tokens](docs/design/brand-and-tokens.md) — proposed original B2B typography/spacing/semantics, **NOT final commercial branding**.
- [154 proposed design tokens](docs/design/design_tokens.json) — 36 primitive colors, 24 light and 24 dark semantic color tokens; other layout/type/motion/density tokens.
- [P2.01 Sample Contrast Review](docs/design/color-contrast-review.csv) — 27 calculated light/dark token pair checks; NOT browser-based WCAG certification.
- [P2.01 Component Usage Examples](docs/design/component-examples.md) — dense CRM tables, merchant application context, permissions and failure states.
- [P2.01 Standalone Static UX Preview](docs/design/token-preview.html) — fictional merchant queue, theme and density toggles; no backend, auth, real data or deployment.
- [P2.01 GitHub issue](https://github.com/owaisprog/Zoho-Clone/issues/24) — CLOSED after owner approval as provisional original internal UX; **not** final commercial branding or accessibility certification.
- [P2.02 Information Architecture](docs/design/information-architecture.md) — product sitemap, safe org switching, responsive navigation and tenant/record/field restrictions.
- [P2.02 Navigation YAML](docs/design/navigation.yml) — proposed 27-entry permission-aware menu structure in five groups (not runtime RBAC).
- [P2.02 Route Inventory](docs/design/route-inventory.csv) — 64 conceptual patterns: 5 public, 19 R0, 20 R1, 15 R2, 5 deferred/unlinked.
- [P2.02 Navigation Review Cases](docs/design/navigation-review-cases.csv) — 40 unexecuted paper-design cases, **separate** from the existing 727-case P1 test inventory.
- [P2.02 GitHub issue](https://github.com/owaisprog/Zoho-Clone/issues/25) — OPEN pending owner approval before P2.03 marketing wireframes.

## Development approach

Follow the **Zoho Clone Complete AI Master Roadmap v2.0** (P0-P17 plus individual product tracks). The owner has authorized internal P1/P2 planning and an explicit **early P3.01 synthetic-only code start parallel with P2.02** under conditional P0.10 GO; all production/data-security/real-customer proof gates remain. Work on one sub-phase at a time, inspect the repository, implement and test the scoped change, record evidence, then advance after the required approval. P3.01 frontend/backend scaffold source is committed; deeper protected platform coding remains gated.

## Important

This repository now contains an actual **running-capable local synthetic frontend/backend scaffold**, verified by a bounded GitHub CI build and 13 scaffold tests. It is **NOT** a secure, deployable customer-facing SaaS; authentication, tenant isolation, data storage, product acceptance tests and release gates are still unfinished. Never commit passwords, API tokens, secrets, or actual customer payment data.

- [Early P3.01 engineering handoff and CI proof](docs/engineering/p3-early-start.md) — parallel authorization, real source overview, 13 executed scaffold checks and restrictions.
- [P3.01 GitHub development issue](https://github.com/owaisprog/Zoho-Clone/issues/26) — OPEN for owner review; P2.02 issue #25 remains OPEN.
