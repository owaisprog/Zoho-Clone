# P0.10 — Phase 0 Build / No-Build Decision Gate

**Project:** Zoho Clone
**Prepared:** 2026-11-13
**Status:** DECISION PACKAGE COMPLETE; **OWNER SIGN-OFF / VALIDATION GATE NOT SATISFIED**.
**Issue:** https://github.com/owaisprog/Zoho-Clone/issues/13

## Executive decision recommendation

**RECOMMEND: CONDITIONAL GO for internal P1 requirements, P2 UX and later P3 sandbox application engineering using synthetic data only.**
**RECOMMEND: NO-GO for public merchant CRM launch, paid customer pilots, regulated-data handling or claims of proven demand until evidence and security gates pass.**
**Do not yet call P0 commercially validated or owner-signed.**

This is a **recommendation**, not a signed product-owner decision. The owner requested that all P0 documents be prepared together; that request did **not** itself establish five buyer interviews, pilot commitments, pricing approval or legal authorization.

## 1. Source-of-truth P0 audit

| Phase | Required roadmap outcome | What exists | Evidence/decision status |
|---|---|---|---|
| P0.01 Business vision charter | Signed vision/measure | Owner-approved charter and long-term all-app breadth | **APPROVED** |
| P0.02 Customer segment map | 3 ranked buyer/JTBD segments | ISO > POS reseller > PayFac, owner-approved | **APPROVED as hypothesis** |
| P0.03 Competitive matrix | Source-dated comparative claims | 6 competitors and 29 capabilities, research limitations | **APPROVED desk research** |
| P0.04 Interview playbook | 15–25 interviews **or documented shortfall** | Neutral scripts, blank notes, **0 interviews** documented | **CLOSED WITH SHORTFALL** |
| P0.05 Merchant process maps | >=3 real-world workflows validated | 3 hypothetical ISO/POS/PayFac flow diagrams | **OWNER-SKIPPED, 0/3 VERIFIED** |
| P0.06 Data sensitivity inventory | Classify bank/contact/ID/card/credentials | 5 proposed classes, 36 categories, prohibited fields | **OWNER-APPROVED AS DESIGN ONLY** |
| P0.07 MVP value proposition | One measurable benefit *validated by prospects* | Narrow claim, landing copy, measurement plan | **DRAFT; 0 actual prospect tests** |
| P0.08 Pricing interviews | >=5 qualified buyers tested | Plan/worksheet, vendor public prices, proposed price anchors | **DRAFT; 0/5 buyer interviews** |
| P0.09 Pilot/design partner criteria | 2 commitments **or explicit continue-without decision** | Pilot plan, applicant criteria, scorecard | **DRAFT; 0/2 commitments; no alternate owner decision** |
| P0.10 Build/no-build decision | Scope frozen, open unknowns owned, explicit owner sign | This decision package, open risks and recommendation | **AWAITING OWNER DECISION** |

### P0 umbrella exit criteria
Master roadmap: **Approved ICP, evidence-backed problem statements, measurable pilot criteria, explicit build/no-build decision**.

- Approved research target ICP: YES.
- Evidence-backed customer problem statements: **NO** (vendor pages + hypotheses only).
- Measurable pilot criteria: PREPARED, NOT MEASURED.
- Explicit approved build/no-build signoff: **PENDING**.
- Hence: **P0 planning documentation is prepared; the validated Phase P0 exit gate is NOT MET**.

## 2. Bounded product scope to freeze for internal planning only

**Internal workstream:** ISO Merchant Operations CRM, within the full eventual Zoho-like suite.

### In initial proposed MVP
- P4: organizations, managed identity, membership, RBAC/ABAC, isolated tenant records, audit, app registry.
- P5: leads, contacts, accounts, deals/pipelines, tasks, activities, authorized imports/exports and sales views.
- P6: subscription plans and enforceable entitlements through approved hosted billing.
- P7: notifications, import/workflow job boundaries, external integration adapters only after approval.
- P8: agents/reseller assignments, merchant records, internal application stages/checklists, next action, bottleneck reporting.
- P12: security tests and observability necessary to handle any permitted customer records.

### Excluded from first launch
- Bank/card/KYC raw data; merchant underwriting, funding, residual calculation/payout execution, payroll and native card processing.
- Direct processor boarding and POS hardware management without separate agreements/security/technical proof.
- Customer-facing mobile, white-label app builder, complete Zoho application portfolio as if shipping now.
- Claims that our tool saves a proven amount of time, is cheaper or offers audited/certified compliance.

### Technical stack (owner confirmed)
Frontend Next.js/React/TypeScript/Tailwind CSS/shadcn/ui. Backend Node.js/Express.js/TypeScript. PostgreSQL/Prisma, modular monolith, REST/OpenAPI, Redis+BullMQ when needed. Original branding/code and no imitation of proprietary Zoho assets.

## 3. Ranked unresolved risks

| Priority | Risk / uncertainty | Severity | Consequence | Owner/mitigation | Phase gate |
|---|---|---|---|---|---|
| **CRITICAL** | 0 customer interviews / unproven pain | High for commercial viability | Build may address problem already solved | Product owner contacts operators; neutral 15–25 interviews / credible shortfall decision | Before paid pilot or commercialization |
| **CRITICAL** | 0/3 merchant workflows validated; P0.05 waived | High product-fit uncertainty | Wrong stages/roles/field schema | Owner obtains real anonymized workflow samples; revise P8 models | Before freeze of real process-specific states / pilots |
| **CRITICAL** | No processor partner or API rights | High integration risk | Cannot advertise automatic boarding | Owner/partners verify contracts, protocols and access | Before integration functionality |
| **CRITICAL** | No implemented tenant/security controls | Critical production safety risk | Customer/merchant data exposure | P4/P12 tests + independent review as appropriate | **Hard blocker before live customer data** |
| HIGH | No target contracting jurisdiction/terms | Legal, payment-provider applicability | Cannot finalize privacy, tax, retention | Owner with qualified adviser; choose markets/entity | Before production terms and billing |
| HIGH | 0/5 buyer price interviews | Monetization uncertainty | Price model may be unsellable | Owner collects real buyer budget/current spend evidence | Before publishing price/paid plan |
| HIGH | 0 pilot commitments | No test customer and weak distribution | Cannot claim traction | Owner obtains 2 written pilot next steps or signs explicit no-partner strategy | Before commercial pilot or Phase 0 validated exit |
| HIGH | No accepted market-facing brand | Brand/trademark risk | Cannot launch product site with “Zoho Clone” | Owner chooses distinct name; clearance | Before external publication |
| HIGH | Costs/hosting/support unknown | Risk of negative gross margin | Plans may lose money | Cost estimation, cloud budget/spending caps | Before sellable plan |
| MEDIUM | Scope explosion: all Zoho product parity | Dilution / slow first revenue | No usable first product | Keep full 172-track roadmap but stage one product first | P1 backlog / quarterly scope |
| MEDIUM | AI-led single-operator execution | Testing/review capacity | Missed edge/security cases | CI, tests, independent review for high-risk systems | All implementation phases |

**Security cannot be waived by the owner for real external data.** The owner may accept *research risk* for sandbox development, but cannot make untested sensitive-data handling safe by marking a checkbox.

## 4. Three separate decisions

| Decision | Recommendation | Current authorization |
|---|---|---|
| **A — Prepare P1/P2 plans and build internal sandbox demo on synthetic data** | CONDITIONAL GO | Recommended only; user has authorized AI-led planning work. Explicit decision memo signoff pending |
| **B — Allow a closed external pilot with real customers/data** | NO-GO until auth/tenant/privacy/file and security controls demonstrably pass and pilot terms exist | NOT AUTHORIZED |
| **C — Launch paid production SaaS and claim product-market fit** | NO-GO without customer evidence, legal/commercial readiness, tested security, billing and support | NOT AUTHORIZED |

### Conditions for A
- Use **synthetic data only**; no raw card, bank, identity or KYC document content.
- Treat P0.05 workflows as provisional and avoid hardcoding irreversible states prematurely.
- Do not make unsupported public claims, accept commercial funds or connect live processor systems.
- Keep costs bounded with owner controls for external cloud accounts.
- P1 requirements must label every assumption and allow change; P3 scaffolding/testing must follow approved stack.
- Establish actual onboarding/data privacy safeguards before even a limited real-data trial.

## 5. Owners of each unresolved assumption and evidence
| Item | Accountable | AI support | Target review |
|---|---|---|---|
| Actual merchant workflow | Product owner + consenting industry operators | Summarize anonymized diagrams | P1/P8 before state-machine freeze |
| Buyer pain/pricing | Product owner + qualified buyer | Scripts, analysis, option modeling | Before real pricing/paid pilot |
| Provider integrations | Product owner/approved processor partner | API adapters once legal access exists | P7/P8 connector implementation |
| Target market, legal entity and brand | Product owner + advisers | Research candidates and document | Before external launch |
| Authorization, isolation, data safety | Product owner + engineering implementers/security reviewers | Express/Prisma design/tests | P3/P4/P12 gates |
| Budget, provider costs | Product owner controls accounts | Estimate/compare configurations | Before paid SaaS |
| Scope baseline | Product owner | Produce P1 PRD and release backlog | Before P3 implementation |
| Build/no-build decision | **Product owner** | Recommend based on evidence | P0.10 decision gate |

## 6. Product-owner signoff record — NOT YET SIGNED

- Decision A: GO / NO-GO / REVISE
- Decision B: NO-GO until verified safeguards / REVISE
- Decision C: NO-GO until verified market/commercial readiness / REVISE
- Allowed data types: Synthetic only until controls pass (proposed)
- Committed scope: Proposed P4–P8 Merchant Operations CRM, all other Zoho-like product tracks remain future
- P0.08 price interviews waiver (if any): Pending explicit decision
- P0.09 continue-without-design-partners (if any): Pending explicit decision
- Owner authorization and date: **PENDING**
- Status: **P0 DOCUMENT PACKAGE PREPARED — EVIDENCE GATES UNMET**

The owner can explicitly approve a conditional internal build while acknowledging research deficits; this does **not** retroactively validate interviews, measured outcomes or pilot commitments.

## 7. Exit actions and handoff to P1 (after owner authorizes)
1. Confirm conditional P1 planning / synthetic-only development vs no-build.
2. Record waiver, if chosen, for the remaining P0.07, P0.08 and P0.09 *market validation gates*, while preserving underlying evidence debt.
3. Translate scope to P1 product modules with roles, data contracts, performance/reliability and negative security tests.
4. Keep unresolved risk register and private real research issue #8 open; do not claim validated ICP/product-market fit.
5. Before P3 scaffolding, check repo/CI and account access; no production environment until independent gates satisfied.

## 8. Reference documents
- [Vision](vision.md), [ICPs](icp.md), [competitive comparison](competitive-capability-matrix.md)
- [Interview shortfall](p0-04-interview-shortfall.md), [P0.05 waived workflow evidence](p0-05-validation-waiver.md)
- [Data classification](data_classification.md), [MVP positioning](positioning.md)
- [Pricing hypotheses](pricing_hypotheses.md), [Pilot plan](pilot_plan.md)
- [P0 master ledger](../p0-phase-ledger.md)

**Final:** All *preparable* P0 documents exist; **P0 has NOT achieved a validated commercial go**. Await owner decision.
