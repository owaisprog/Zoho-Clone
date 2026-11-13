# Zoho Clone - Product and Technical Decision Log

**Date:** 2026-11-13  
**Current roadmap checkpoint:** P0.05 (Merchant Process Maps — drafts; awaiting real-world workflow validation)

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
| DEC-018 | P0.05 draft ISO/POS/PayFac workflow maps | **Owner-approved provisional draft 2026-11-13** | Three draft maps usable for planning; **0/3 actual real-world validations**; issue #7 remains open |

| DEC-019 | P0.06 Data Sensitivity Inventory preliminary research can be drafted without concluding P0.05 | **PREWORK ONLY** | Classification assumptions recorded; policy/retention/legal decisions and P0.05 validations remain open |

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
- Current phase: P0.05 - Merchant Process Maps (open; real-world validation 0/3)
- P0.06: preliminary data sensitivity prework drafted only; official phase not started
