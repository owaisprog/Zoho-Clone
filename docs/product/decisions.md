# Zoho Clone - Product and Technical Decision Log

**Date:** 2026-11-13  
**Current roadmap checkpoint:** All P0.01–P0.10 decision/document packages prepared; P0 commercial validation and owner P0.10 signoff pending

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

| DEC-023 | P0.07 proposed ISO first-product value: identify stalled application owner and next action | **RESEARCH HYPOTHESIS / NOT VALIDATED** | Positioning and landing copy drafted; 0 prospect reviews and timed tests |
| DEC-024 | P0.08 pricing hypotheses: proposed $149/$399/from $999 organization plans to test | **NOT APPROVED SELLING PRICES** | 0/5 qualified price interviews; fair comparable quotes outstanding |
| DEC-025 | P0.09 design-partner program and two-partner target | **DOCUMENTED / UNCOMMITTED** | 0/2 partners, owner has not elected explicit no-partner path |
| DEC-026 | P0.10 decision recommendation | **CONDITIONAL INTERNAL-GO / COMMERCIAL NO-GO RECOMMENDED, NOT OWNER-SIGNED** | See `phase0_gate.md`: synthetic-data-only engineering is materially different from deploying to customers |
| DEC-027 | P0 overall status | **DOCUMENTS PREPARED; VALIDATED P0 EXIT NOT MET** | No evidence-backed customer problem validation, no approved P0.10 build decision |
| DEC-028 | User request to complete all P0 work in one pass | **AUTHORIZED DOCUMENT PREPARATION** | It does not falsely establish prospect calls, commercial contracts, pilot commitments, or consent to accept every security/commercial risk |

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
- Current decision: P0.10 product-owner conditional GO/NO-GO signoff outstanding
- No real merchant workflows, buyer interviews, price tests or pilot commitments have been fabricated
