# Zoho Clone — Master Roadmap Progress

**Updated:** 2026-11-13
**Master roadmap:** `Zoho Clone Complete AI Master Roadmap v2.0`
**Current sub-phase:** **P2.01 — Brand and Design Tokens (DRAFT PREPARED, OWNER REVIEW PENDING)**
**Current authorization:** P0.10 owner-approved **CONDITIONAL GO** for P1/P2 requirements/design and later internal P3 sandbox engineering, **synthetic data only**. Not commercial GO.
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
| **P2.01 Brand and Design Tokens** | **IN PROGRESS — owner-review draft**: [brand guidance](design/brand-and-tokens.md), [154-token design JSON](design/design_tokens.json), [27 sampled contrast formula checks](design/color-contrast-review.csv), [component examples](design/component-examples.md), [static theme/density preview](design/token-preview.html). [Issue #24](https://github.com/owaisprog/Zoho-Clone/issues/24) OPEN. No browser a11y/usability tests or running app. |
| P2.02 Information Architecture | NOT STARTED — after P2.01 owner approval. |
| P2.03–P2.17 UX/screens/usability | NOT STARTED — tracked individually in phase plan. |

**P2.01 owner gate:** Approve original/non-Zoho commercial trade dress, provisional name not final, light/dark palette, density and accessibility token rules; then start P2.02. The 14 risks, 12 decisions and 727 unexecuted tests remain open/unverified.

## Technical decisions (unchanged)

Frontend Next.js + React + TypeScript + Tailwind/shadcn; backend Node.js + Express.js + TypeScript; PostgreSQL/Prisma and Redis/BullMQ when justified; modular monolith, versioned REST/OpenAPI and tenant/record policy checks.

## Operating boundary

No real merchant/card/bank/identity/KYC data; no live processor credentials, payment collection, production deployment or external pilot without fresh explicit approvals and verified controls. Public GitHub must contain synthetic/anonymized-only examples, no secrets or identifiable interview material.
