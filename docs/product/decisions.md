# Zoho Clone - Product and Technical Decision Log

**Date:** 2026-11-13  
**Current roadmap checkpoint:** P0.01 (draft; owner approval pending)

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
| DEC-009 | Specialized Merchant Operations CRM is first commercial product | **Proposed - confirm** | Previous roadmap recommendation; validate through P0.02-P0.10 |
| DEC-010 | Initial paid plans and published prices | **Unvalidated proposal** | Price interviews and cost model required |
| DEC-011 | Selling jurisdiction and billing provider | **Open** | Verify provider eligibility, taxation and legal entity |
| DEC-012 | Public-facing brand / product names | **Open** | Original name and trademark clearance required |
| DEC-013 | P0.01 business vision charter acceptance | **Awaiting owner approval** | Close only after explicit sign-off |

## Change control

Add a dated entry before changing architecture, product order or launch scope. Separate **confirmed owner decisions**, **engineering recommendations**, and **unvalidated hypotheses**. Never describe a proposed price, legal choice or deployment status as approved.

## Owner sign-off record

- Decision: Pending
- Approved by: Pending
- Date: Pending
- Next permitted phase on approval: P0.02 - Customer Segment Map
