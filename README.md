# Zoho Clone

**Status:** **P0.10 owner-approved CONDITIONAL INTERNAL GO; P1.01 Master PRD approved; P1.02 Functional SRS approved; P1.03 Nonfunctional SRS approved as design; P1.04 Personas and Journeys approved provisionally; P1.05 Feature Hierarchy and Release Gates in progress.** P0.07 and P0.08 market evidence gates were waived **for internal sequencing only**, and P0.09 elected continuation without partners. P0 is **not commercially validated**; only synthetic-data internal development is authorized.

Zoho Clone is the working name of an original, AI-led, multi-tenant SaaS ecosystem designed to provide integrated business applications. The long-term scope is comparable in breadth to the Zoho ecosystem, but the software, code, branding, and user experience will be independently developed.

## Repository structure

- [frontend/](frontend/README.md) - Next.js, React, TypeScript, Tailwind CSS and shadcn/ui (scaffold scheduled for P3).
- [backend/](backend/README.md) - Node.js, Express.js, TypeScript, PostgreSQL, Prisma, Redis and BullMQ (scaffold scheduled for P3).
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

## P1 — Requirements (active)

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
- [P1.05 GitHub issue](https://github.com/owaisprog/Zoho-Clone/issues/18) — open for owner review.

## Development approach

Follow the **Zoho Clone Complete AI Master Roadmap v2.0** (P0-P17 plus individual product tracks). The owner has authorized internal P1/P2 planning and future synthetic-data P3 engineering under conditional P0.10 GO; all production/data-security/real-customer proof gates remain. Work on one sub-phase at a time, inspect the repository, implement and test the scoped change, record evidence, then advance after the required approval. Application scaffolding begins in P3.

## Important

This repository intentionally does not yet contain a working frontend or backend. Do not assume the project is deployable until its foundation, tests, infrastructure, and release gates are completed. Never commit passwords, API tokens, secrets, or actual customer payment data.
