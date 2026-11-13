# Zoho Clone - Product and Technical Decision Log

**Date:** 2026-11-13  
**Current roadmap checkpoint:** P1.09 Acceptance and Traceability Map OWNER-APPROVED as PLANNING ONLY; P1.10 Risk and Decision Register active, owner review pending; all 14 source gaps remain OPEN

| ID | Decision | Status | Rationale / next check |
| --- | --- | --- | --- |
| DEC-001 | Internal project/repository name is **Zoho Clone** | Confirmed | Use consistently in internal documentation; review external trademark/brand before launch |
| DEC-002 | Build an original, multi-tenant SaaS ecosystem spanning every identified major Zoho product and application category | Confirmed goal | Each major capability is a separate later track; no proprietary code/assets |
| DEC-003 | ChatGPT-led implementation without hiring another developer | Confirmed delivery preference | Owner retains account control, approvals and production accountability |
| DEC-004 | Frontend: Next.js, React, TypeScript, Tailwind CSS, shadcn/ui | Confirmed | Common application shell; detailed setup occurs during P3 |
| DEC-005 | Backend: **Node.js + Express.js + TypeScript** (not NestJS) | Confirmed | Modular router/controller/service/repository architecture |
| DEC-006 | Database: PostgreSQL + Prisma; Redis + BullMQ when needed | Confirmed architectural direction | Tenant constraints/RLS and transactions to be fully specified during P3/P4 |
| DEC-007 | Modular monolith initially; use REST/OpenAPI and domain events | Confirmed architectural direction | Avoid premature microservices |
| DEC-008 | Separate top-level `frontend/` and `backend/` folders | Confirmed by owner request | Created in P0.01; full scaffolding belongs to P3 |
| DEC-009 | Specialized Merchant Operations CRM is the initial product direction | **Approved 2026-11-13 (subject to market validation)** | ISO-first, POS reseller second, PayFac third; refine during P0.02-P0.10 |
| DEC-010 | Initial paid plans and published prices | **Unvalidated proposal** | Price interviews and cost model required |
| DEC-011 | Selling jurisdiction and billing provider | **Open** | Verify provider eligibility, taxation and legal entity |
| DEC-012 | Public-facing brand / product names | **Open** | Original name and trademark clearance required |
| DEC-013 | P0.01 business vision charter acceptance | **Approved 2026-11-13** | Product owner explicitly approved mission and proposed order; P0.01 closed |

| DEC-014 | P0.02 segment order ISO -> POS reseller -> PayFac | **Approved 2026-11-13 as research priority** | Ranking is authorized; scores and pain hypotheses still need interviews in P0.04/P0.05 |
| DEC-015 | P0.03 competitive matrix and differentiation hypotheses | **Approved 2026-11-13 as research baseline** | Six competitors, 29 feature dimensions; buyer validation still required |
| DEC-016 | P0.04 interview protocol and general outreach approach | **Owner-approved 2026-11-13** | 0/15-25 interviews completed; documented shortfall under roadmap exception, issue #8 remains open |

| DEC-017 | P0.04 shortfall explicitly reported and moved to separate evidence work | **Documented 2026-11-13** | Public repo must not include real contact identities, merchant records or interview transcripts |
| DEC-018 | P0.05 draft ISO/POS/PayFac workflow maps | **Owner-approved provisional drafts** | Three maps remain unvalidated; actual customer validation = 0/3 |

| DEC-019 | P0.06 five classifications and initial CRM raw sensitive-data exclusions | **Owner-approved as DESIGN REQUIREMENTS on 2026-11-13; phase closed** | 36 category inventory, no raw bank/card/identity/KYC/credentials; NOT legal certification or implemented controls |

| DEC-020 | P0.05 three-workflow validation gate | **OWNER WAIVED on 2026-11-13 for roadmap sequencing; NOT COMPLETED** | "skip this and jump to next". 0/3 verified; issue #7 closed as not planned, validation debt issue #8 remains open. Security/compliance controls NOT waived. |

| DEC-021 | P0.07 merchant operations CRM value proposition | **Working hypothesis; P0.07 active** | ISO buyer; measurable time to identify owner/status/next action on stalled case; no actual buyer validation yet |
| DEC-022 | Market-facing name, pricing, processor integrations, regulated data jurisdiction | **OPEN** | No unsupported product, customer ROI, live integration or certification claims permitted |

| DEC-023 | P0.07 proposed ISO first-product value: identify stalled application owner and next action | **Owner WAIVED validation for internal sequencing only (2026-11-13)** | Positioning and landing copy remain unvalidated; 0 prospect reviews / 0 timed tests; #10 closed NOT PLANNED |
| DEC-024 | P0.08 pricing hypotheses: proposed $149/$399/from $999 organization plans to test | **Owner WAIVED five-buyer requirement for internal sequencing only (2026-11-13)** | 0/5 pricing interviews, NO approved selling prices; #11 closed NOT PLANNED |
| DEC-025 | P0.09 design-partner program and two-partner target | **Owner APPROVED continue internal development WITHOUT partners (2026-11-13)** | 0/2 actual commitments; no external pilot authorized; #12 closed under roadmap alternative |
| DEC-026 | P0.10 build/no-build gate | **Owner SIGNED CONDITIONAL INTERNAL GO on 2026-11-13** | P1/P2 and future internal P3 sandbox authorized; synthetic-only; external pilot/production NO-GO; #13 closed |
| DEC-027 | P0 overall status | **Internal sequencing approved; COMMERCIAL validation NOT MET** | Market and security gaps remain open issue #8; do not misstate demand / ROI / partnerships |
| DEC-028 | User request to complete all P0 work in one pass | **AUTHORIZED DOCUMENT PREPARATION** | It does not falsely establish prospect calls, commercial contracts, pilot commitments, or consent to accept every security/commercial risk |

| DEC-029 | P1.01 Master PRD release baseline | **OWNER-APPROVED 2026-11-13; issue #14 CLOSED** | R0 shared platform, R1 sales CRM and R2 merchant operations approved for synthetic-data-only internal planning; 26 mapped use cases |
| DEC-030 | Initial development data restrictions | **Owner-APPROVED internal boundary on 2026-11-13** | Synthetic/non-identifying only; real merchant/card/bank/ID/KYC data and production excluded |

| DEC-031 | P1.02 Functional SRS behavior/validation/exception specification | **OWNER-APPROVED 2026-11-13, issue #15 CLOSED** | 49 numbered FRs mapped to 26 PRD use cases, 59 future unexecuted acceptance cases; provisional state transitions remain editable |
| DEC-032 | P1.01 approval scope | **Owner-approved as internal release prioritization ONLY** | No payment processor integration, paid production, real customer data, market validation or security certification implied |

| DEC-033 | P1.03 measurable nonfunctional requirements (performance, reliability, security, accessibility) | **OWNER-APPROVED DESIGN TARGETS 2026-11-13; issue #16 CLOSED** | 46 NFRs and 52 unexecuted cases; 25 VU benchmark profile, 99.9% uptime and 24h RPO / 4h RTO design targets NOT measured/guaranteed |
| DEC-034 | Production/data safety release gates | **REMAIN MANDATORY despite internal GO** | Verified tenant authorization, forbidden data rejection, legal/processor contracts, accessibility and real backups required before external data; P1.03 does not certify a system |

| DEC-035 | P1.04 primary ISO user personas and journeys | **OWNER-APPROVED PROVISIONAL DESIGN BASELINE on 2026-11-13; issue #17 CLOSED** | 12 hypothesis-based personas, 18 synthetic journeys, 72 steps, 36 future tests, 26 UC covered; no real customer evidence |
| DEC-036 | P1.03 approval scope | **CONFIRMED DESIGN ONLY** | No performance benchmark, backup restore, accessibility conformance, implemented access control or compliance certification is claimed; external release safety obligations remain mandatory |

| DEC-037 | P1.05 R0 shared platform, R1 sales CRM, R2 merchant operations and deferred full suite feature backlog | **OWNER-APPROVED INTERNAL PLANNING BASELINE 2026-11-13; issue #18 CLOSED** | 36 planned features (24 MUST, 6 SHOULD, 6 DEFERRED), all 26 UC and 49 FR mapped; NOT implemented |
| DEC-038 | P1.05 distribution gate distinction | **OWNER-APPROVED PLANNING POLICY 2026-11-13** | R0/R1/R2 internal synthetic demo is separate from external pilot/production; G-EXT/G-COM remain BLOCKED and require separate evidence and owner signoff |

| DEC-039 | P1.06 permission/sharing security baseline | **OWNER-APPROVED DESIGN REQUIREMENTS 2026-11-13, issue #19 CLOSED** | 13 roles, 22 resource families, 286 rule decisions (217 denied), 52 future tests NOT RUN; not an implemented policy engine or security certification |
| DEC-040 | P1.06 admin/owner and system access boundary | **OWNER-APPROVED POLICY DESIGN, NOT IMPLEMENTED** | Org owner/admin has no automatic CRM/merchant row access; revoked agent/members lose access on next request; platform support/external actors/workers get no automatic tenant privileges |

| DEC-041 | P1.07 domain glossary and provisional entity model | **OWNER-APPROVED PROVISIONAL DESIGN 2026-11-13; issue #20 CLOSED** | 31 candidate entities, 230 classified fields, 33 relationship rules; NO implemented database schema, Prisma migration or real operator validation |
| DEC-042 | P1.07 sample record privacy/processor boundary | **OWNER-APPROVED SYNTHETIC-ONLY DESIGN 2026-11-13** | 68 fictional Orchid/Juniper demo records; no raw bank/card/identity/KYC/MID/credentials; external demo status unverified; NOT database seed code |

| DEC-043 | P1.08 versioned REST/OpenAPI endpoints and auth/error contracts | **OWNER-APPROVED PROVISIONAL DESIGN 2026-11-13; issue #21 CLOSED** | 67 proposed OpenAPI 3.1 operations, 44 paths, 72 schemas, and 164 future tests NOT RUN; no implemented Express endpoint |
| DEC-044 | P1.08 internal event and external provider boundary | **OWNER-APPROVED PROVISIONAL DESIGN ONLY; NO EVENT DELIVERY IMPLEMENTED** | 16 internal event types, restrictive envelope schema, transactional outbox proposal; no live processors, provider webhooks, payouts, real card/bank/KYC or production |

| DEC-045 | P1.09 planned acceptance traceability and test inventory | **OWNER-APPROVED PLANNING BASELINE 2026-11-13; issue #22 CLOSED** | 26 UC + 49 FR + 46 NFR = 121 requirement mappings; 36 features; 727 future test cases, **0 executed / 0 passed**; not runtime quality evidence |
| DEC-046 | P1.09 implementation vs external release evidence gates | **OWNER-APPROVED PLANNING RULE; NOT A PRODUCT RELEASE APPROVAL** | **ALL 14 G-001..G-014 remain OPEN**, P0.10 synthetic internal sequencing only; G-EXT/G-COM blocked; no requirement/quality pass implied |

| DEC-047 | P1.10 risk register and provisional mitigation ranking | **DRAFT ACTIVE — owner review pending** | All 14 P1.09 gaps mapped one-to-one to OPEN risks in `docs/product/p1-risk-register.csv`; proposed impact/likelihood/owner/actions only; issue #23 |
| DEC-048 | P1.10 unresolved architecture, domain, vendor and release decisions | **OPEN / NOT OWNER-APPROVED** | 12 tracked choices in `docs/product/p1-decision-backlog.csv`; prior P0/P1 design approvals retained, none assumed implemented or commercial GO |

## Change control

Add a dated entry before changing architecture, product order or launch scope. Separate **confirmed owner decisions**, **engineering recommendations**, and **unvalidated hypotheses**. Never describe a proposed price, legal choice or deployment status as approved.

## Owner sign-off record

- Decision: Approved - P0.01 charter and initial product order
- Approved by: Product owner, in ChatGPT conversation
- Date: 2026-11-13
- P0.02 segment priority approval: Approved by product owner on 2026-11-13; customer evidence still outstanding
- P0.03 competitor research approval: Approved by product owner on 2026-11-13; external product testing and buyer discovery remain open
- P0.04 owner sign-off: Approved by product owner in this conversation on 2026-11-13; interview shortfall 0 of 15–25 recorded
- P0.05 provisional draft approval: Product owner approved planning diagrams in conversation on 2026-11-13; not evidence of customer validation
- P0.05 waiver: Owner explicitly requested to skip validation and proceed on 2026-11-13; unvalidated 0/3, issue #7 closed as not planned
- P0.06 owner sign-off: Product owner explicitly approved the five classes and initial CRM raw card/bank/identity/KYC/credential exclusions as design requirements on 2026-11-13; no certification implied; issue #9 closed
- P0.07–P0.10 artifact preparation: Completed in one pass at user direction, with unvalidated gates explicitly open
- P0.10 OWNER SIGNOFF: Explicitly approved CONDITIONAL GO for internal requirements, UX and synthetic-only later engineering, on 2026-11-13
- P0.07/P0.08: Owner waived external validation for internal sequencing only (0 value tests / 0 of five pricing buyers); no market proof claimed
- P0.09: Owner elected continue internal work without two partners (0 commitments); no external pilot
- P1.01 sign-off: Owner approved PRD and R0/R1/R2 prioritized release baseline on 2026-11-13; issue #14 closed
- P1.02 owner sign-off: Owner expressly approved Functional SRS and provisional behavior/state rules on 2026-11-13; issue #15 closed
- P1.03 sign-off: Product owner explicitly approved NFR target numbers and mandatory security gates AS DESIGN REQUIREMENTS, not verified outcomes, on 2026-11-13; issue #16 closed
- P1.04 signoff: Owner explicitly approved 12 personas and 18 journeys as a PROVISIONAL planning baseline on 2026-11-13, not customer-validated evidence; issue #17 closed
- P1.05 signoff: Owner approved feature hierarchy, priority/dependency and R0/R1/R2 vs external gates as internal planning baseline on 2026-11-13; issue #18 closed
- P1.06 signoff: Owner approved least-privilege, default deny, tenant isolation, row/field sharing rules as DESIGN REQUIREMENTS on 2026-11-13; issue #19 closed; no implemented controls claimed
- P1.07 signoff: Owner expressly approved 31-entity provisional glossary, 230 classified fields, 33 relationships and 68 synthetic records as DESIGN ONLY on 2026-11-13; issue #20 closed
- P1.08 signoff: Owner explicitly approved versioned API and internal event contracts as PROVISIONAL DESIGN ONLY on 2026-11-13; issue #21 closed; no running endpoints/event services
- P1.09 signoff: Owner explicitly approved acceptance/traceability map as **internal planning only** on 2026-11-13; 727 future tests remain NOT RUN, 14 gaps remain OPEN; issue #22 closed
- Current sub-phase: **P1.10 Risk and Decision Register** — 14 OPEN gap-mapped risks and 12 OPEN decisions; owner review pending
- No real merchant workflows, buyer interviews, price tests or pilot commitments have been fabricated
