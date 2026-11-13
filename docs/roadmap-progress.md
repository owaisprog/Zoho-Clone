# Zoho Clone — Master Roadmap Progress

**Updated:** 2026-11-13
**Master roadmap:** `Zoho Clone Complete AI Master Roadmap v2.0`
**Current sub-phase:** **P1.03 — Nonfunctional SRS (DRAFT PREPARED, OWNER REVIEW PENDING)**
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
| **P1.03 Nonfunctional SRS** | **IN PROGRESS — 46 proposed NFR targets / 52 future test cases authored**, [Issue #16](https://github.com/owaisprog/Zoho-Clone/issues/16) OPEN, awaiting owner review |
| P1.04 Personas and Journeys | NOT STARTED |
| P1.05 Feature Hierarchy and Release Gates | NOT STARTED |
| P1.06 Permission and Sharing Matrix | NOT STARTED |
| P1.07 Domain Glossary and Sample Records | NOT STARTED |
| P1.08 API and Event Contract Spec | NOT STARTED |
| P1.09 Acceptance and Traceability Map | NOT STARTED |
| P1.10 Risk and Decision Register | NOT STARTED |

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

### P1.03 deliverables prepared for owner review
- [x] [Nonfunctional SRS](product/nfr.md): **46** proposed measurable requirements across 10 domains.
- [x] [NFR matrix](product/nfr-matrix.csv): metric, verification, phase/owner and hard gate.
- [x] [Synthetic benchmark/verification plan](product/nfr-verification-plan.md): 25 VU/10 demo organizations, performance profile, backup/restore, security and accessibility checks.
- [x] [NFR acceptance cases](product/nfr-acceptance-cases.csv): **52 future tests, NONE EXECUTED**.
- [ ] Owner approves P1.03 proposed response time, RPO/RTO, accessibility and security gates before P1.04.

**No executable software or runtime tests were added for these documentation phases.** `frontend/` and `backend/` remain placeholder folders, not running Next.js/Express applications.

## Technical decisions (unchanged)

Frontend Next.js + React + TypeScript + Tailwind/shadcn; backend Node.js + Express.js + TypeScript; PostgreSQL/Prisma and Redis/BullMQ when justified; modular monolith, versioned REST/OpenAPI and tenant/record policy checks.

## Operating boundary

No real merchant/card/bank/identity/KYC data; no live processor credentials, payment collection, production deployment or external pilot without fresh explicit approvals and verified controls. Public GitHub must contain synthetic/anonymized-only examples, no secrets or identifiable interview material.
