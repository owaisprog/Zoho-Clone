# P1.05 — Feature Hierarchy and Prioritized MVP Backlog

**Project:** Zoho Clone (internal working name; public brand undecided)  
**Version:** 0.1 — owner-review draft  
**Prepared:** 2026-11-13  
**Phase:** P1.05 — Feature Hierarchy and Release Gates  
**Issue:** https://github.com/owaisprog/Zoho-Clone/issues/18  
**Prerequisite:** P1.01 PRD, P1.02 Functional SRS, P1.03 NFR design and P1.04 synthetic Personas/Journeys **owner-approved on 2026-11-13**.  
**Status:** DRAFT; prioritized feature backlog prepared; **no product features are implemented, tested or deployed**.

## 1. Release vocabulary and priority meaning

- **R0 — Shared platform foundation:** organization, managed authentication, tenant/record policies, roles, audit, entitlements and **mock/hosted billing design only**. This is a *functional release slice* built in later implementation phases, not roadmap master phase P0.
- **R1 — Sales CRM:** leads, contacts, accounts, pipelines/deals, tasks, accessible UI, scoped reports and carefully gated imports/exports.
- **R2 — Merchant Operations CRM:** merchant/agent links, internal application queue, owner/next action, internal stage/checklist history, safe separation from external processor status.
- **R0/R1/R2 — cross-cutting:** security, accessible experience, synthetic fixtures and negative tests must apply across all three.
- **LATER:** processor connectors, residual/finance/payouts, external agent and merchant portals, POS fulfillment, specialist regulated flows and the broader Zoho-like Business OS portfolio. None is an MVP commitment or a claim of parity.

**Priority vocabulary:** `MUST` = prerequisite for intended R0/R1/R2 internal function or mandatory safety; `SHOULD` = useful but can move behind a narrower demonstration with documented consequence; `DEFERRED` = separately scoped future application and not an initial release. **Sequence band 1–5** is *planning order within dependency constraints*, not a calendar deadline or sprint estimate.

The product owner's P0.10 approval allows **synthetic-data-only internal development**, NOT external pilot, live merchant data, billing charges, real processor integration or public production. Product market fit remains unverified.

## 2. Proposed feature taxonomy (36 atomic features / 13 epics)

| Epic | Internal feature count | Role / intended outcome |
|---|---:|---|
| Platform identity | 3 | Reliable tenant-aware shared platform |
| Platform access | 2 | Reliable tenant-aware shared platform |
| Platform security | 1 | Reliable tenant-aware shared platform |
| Platform entitlement | 1 | Reliable tenant-aware shared platform |
| Platform billing | 1 | Reliable tenant-aware shared platform |
| Sales CRM | 8 | Sales lead-to-deal work |
| Experience foundation | 2 | Accessible and recoverable interactions |
| Merchant operations | 10 | Merchant/application ownership clarity |
| Merchant integrations | 1 | Merchant/application ownership clarity |
| Quality & validation | 2 | Synthetic tests and security evidence |
| Specialist later | 3 | Deferred specialist capabilities and future application ecosystem |
| Regulated specialist later | 1 | Deferred specialist capabilities and future application ecosystem |
| Full suite later | 1 | Deferred specialist capabilities and future application ecosystem |

## 3. Hierarchy by release

### R0 — Shared SaaS

| ID | Feature | Priority | Dependencies | Roadmap implementation |
|---|---|---|---|---|
| FT-001 | Tenant workspace creation | MUST | none | P4 |
| FT-002 | Organization switcher and verified membership | MUST | FT-001 | P4 |
| FT-003 | Internal staff invitation and revocation | MUST | FT-002 | P4 |
| FT-004 | Tenant and record authorization kernel | MUST | FT-001;FT-002 | P4/P12 |
| FT-005 | Least-privilege audit records | MUST | FT-002;FT-004 | P4/P12 |
| FT-006 | Plan and app grant enforcement | MUST | FT-002;FT-004 | P6 |
| FT-007 | Hosted billing adapter contract | SHOULD | FT-004;FT-006 | P6/P7 |
| FT-035 | Tenant-safe authentication and session recovery | MUST | FT-001;FT-004 | P4 |

### R1 — Sales CRM

| ID | Feature | Priority | Dependencies | Roadmap implementation |
|---|---|---|---|---|
| FT-008 | Lead CRUD and search | MUST | FT-002;FT-004;FT-005 | P5 |
| FT-009 | Contact and account CRUD | MUST | FT-004;FT-008 | P5 |
| FT-010 | Duplicate candidate warnings | SHOULD | FT-009 | P5 |
| FT-011 | Deal and pipeline management | MUST | FT-008;FT-009 | P5 |
| FT-012 | Activities, assigned tasks and follow-ups | MUST | FT-011;FT-004 | P5 |
| FT-013 | Scoped sales pipeline reports | SHOULD | FT-011;FT-012 | P5/P11 |
| FT-014 | Safe CSV import | SHOULD | FT-009;FT-004;FT-005 | P7 |
| FT-015 | Scoped CSV export | SHOULD | FT-004;FT-005;FT-013 | P7 |

### R0/R1/R2 — Cross-cutting quality/UX

| ID | Feature | Priority | Dependencies | Roadmap implementation |
|---|---|---|---|---|
| FT-016 | Accessible/responsive shared CRM UI states | MUST | FT-002;FT-008 | P2/P5 |
| FT-017 | Idempotent UX and concurrency conflicts | MUST | FT-005;FT-011 | P3/P5/P8 |
| FT-029 | Synthetic demo and negative security fixtures | MUST | FT-004;FT-020;FT-023;FT-026 | P3/P12 |
| FT-036 | Security/privacy hard gate implementation | MUST | FT-004;FT-005;FT-029 | P3/P4/P12 |

### R2 — Merchant Operations

| ID | Feature | Priority | Dependencies | Roadmap implementation |
|---|---|---|---|---|
| FT-018 | Internal merchant records and CRM linkage | MUST | FT-009;FT-011;FT-004 | P8 |
| FT-019 | Agent directory and merchant assignment | MUST | FT-018;FT-004 | P8 |
| FT-020 | Internal merchant application tracking | MUST | FT-018;FT-019;FT-005 | P8 |
| FT-021 | Next-action task and blocked-case metadata | MUST | FT-020;FT-012 | P8 |
| FT-022 | Stalled application queue | MUST | FT-020;FT-021 | P8 |
| FT-023 | Configurable internal stage transition policy | MUST | FT-020;FT-005;FT-017 | P8 |
| FT-024 | Non-sensitive application checklist | MUST | FT-023;FT-021 | P8 |
| FT-025 | Agent reassignment access invalidation | MUST | FT-019;FT-004;FT-005 | P8/P12 |
| FT-026 | External status provenance boundary | MUST | FT-020;FT-023 | P8 |
| FT-028 | Organization-scoped onboarding dashboard | SHOULD | FT-022;FT-004 | P8/P11 |

### LATER — Future / deferred

| ID | Feature | Priority | Dependencies | Roadmap implementation |
|---|---|---|---|---|
| FT-027 | Verified processor event adapter | DEFERRED | FT-026 | P7/P8 |
| FT-030 | External agent/reseller self-service portal | DEFERRED | FT-025;FT-029 | P15/V1 |
| FT-031 | Residual report import and commission computation | DEFERRED | FT-029 | P15/V1 |
| FT-032 | POS terminal inventory and deployment | DEFERRED | FT-029 | P15/V2 |
| FT-033 | KYC/KYB and underwriting hosted specialist flow | DEFERRED | FT-029 | Specialist |
| FT-034 | Long-term multi-app Business OS portfolio | DEFERRED | FT-001;FT-006;FT-029 | P9/P15-P17 |


## 4. Feature-level acceptance and security rules

The complete implementation-ready **planning backlog** is [mvp-backlog.csv](mvp-backlog.csv). Each feature has: unique ID, epic, release, implementation roadmap phase, MoSCoW priority, sequence band, input PRD use-case IDs, corresponding Functional SRS FR IDs, journeys, dependencies, bounded acceptance criterion, gate and evidence state.

### Foundational nonnegotiables (not optional backlog tuning)
- Tenant and record isolation (`FT-004`) and safe authentication (`FT-035`) are prerequisites for permissioned app behavior.
- Audit/safe logging (`FT-005`) and the prohibited-fields rule (`FT-036`) cannot be postponed past any external real-data release.
- Internal stage changes (`FT-023`) must never set verified external processor status (`FT-026`) as a side effect.
- Report totals and exports (`FT-013`, `FT-015`, `FT-028`) must be tenant- and record-scoped before results are returned.
- Reassigned agents must lose access (`FT-025`) even while their history remains auditable.
- A mock hosted billing interface (`FT-007`) **does not authorize money collection** or mean a provider agreement exists.
- Any declared acceptance case is **NOT RUN** until real test execution after P3 scaffolding.

## 5. P1.05 feature slicing and dependency notes

**Proposed build sequence (not sprint dates):**
1. Foundations: organization, authentication, permissions, audit, tenant-safe test fixtures and UI shell. Entitlement enforcement with mock plans.
2. Sales workflow: leads + accounts/contacts → deals/pipelines → tasks → permitted reports; then safe import/export only once restrictions exist.
3. Internal merchant workflow: merchant/agent records → internal application with owner/next action → stages/checklists → stalled queue and dashboards.
4. Quality gates: privilege denial, forbidden field rejection, reconciliation, accessible keyboard/mobile flows, recovery, backup and real CI execution.
5. Future integrations/specialist modules only after separate approvals, contracts and security/research gates.

**Dependencies are authoritative planning inputs, not proof of live code.** P1.06 formalizes record sharing; P1.07 validates field/status names; P1.08 defines REST/event contracts; P1.09 maps tests; P1.10 freezes approved backlog. The final implementation order may change as those specifications become available.

## 6. Long-term suite preservation (not initial launch)

The original approved end-to-end vision remains a multi-app, original Business OS. The following are **future families**, each to be decomposed into its own application-specific phases and PRD/gates; their names in this table do not mean software exists:

| Future family | Candidate applications | Additional review required |
|---|---|---|
| Customer operations | Advanced CRM, contact center, help desk, live chat, marketing, customer success | Privacy/communication consent and message deliverability |
| Money and finance | Accounting, expenses, invoicing, subscriptions, billing, commissions/residuals, financial analytics | Tax jurisdiction, accounting correctness, segregation of duties |
| People and HR | Recruitment, HRMS, time and attendance, payroll, performance, employee self-service | Employment jurisdictions, payroll secrets, strict employee access |
| Productivity and collaboration | Mail, calendar, meetings, workdrive/documents, tasks/projects, knowledge, office suite | Email/identity providers, storage rights, document sharing |
| Commerce and retail | Ecommerce, catalog, inventory, ordering, POS, retail operations and logistics | Transaction security, hardware and fulfillment |
| Automation/developer | Low-code app builder, workflow automation, API/integration hub, analytics, AI | Isolation, scripting security, API scopes, model/privacy contracts |
| Industry and IT | Payment/merchant verticals, business service apps, IT desk, monitoring, asset/device tools | Domain-specific security, vendor integrations and regulation |

**No claim of exact feature-for-feature replication, trademarks, third-party assets, completed app availability or authorized processor integration.** A separate master product-track decomposition remains in the full roadmap.

## 7. Traceability and coverage

- [PRD use-case matrix](prd-release-matrix.csv): **26** approved use cases.
- [Functional SRS matrix](srs-requirements.csv): **49** requirement rows.
- [Feature-to-PRD/FR/Journey traceability](feature-traceability.csv): maps every UC to at least one prioritized feature.
- [Internal MVP backlog](mvp-backlog.csv): **36** features including explicitly deferred work.
- No PRD UC or SRS FR remains unassigned in the documentation mapping, but **mapping is not implementation or test execution**.

## 8. Risks and unresolved choices
- **P0.05** ISO/POS/PayFac workflows have **0/3** real operator validations; merchant stages/hierarchies provisional.
- **P0.07–P0.09** customer value tests 0; pricing buyer interviews 0/5; design partners 0/2, waived only for internal sequencing.
- **Billing** provider, region, legal entity, production prices, actual customer security requirements and public brand not chosen.
- **Data safety** P0.06 design prohibits raw bank/card/ID/KYC/credential capture in initial CRM. Actual controls must be implemented and tested.
- **Performance** 46 P1.03 NFRs accepted as targets, not measured results. Candidate 25 VU, read p95 <=500ms, 99.9% uptime, 24h RPO and 4h RTO are NOT achieved guarantees.
- Commercial/regulated software release is still **NO-GO**; [risk/research debt issue #8](https://github.com/owaisprog/Zoho-Clone/issues/8) remains open.

## 9. P1.05 acceptance checklist

- [x] Feature hierarchy R0/R1/R2 and deferred specialist/suite scope documented.
- [x] 36 unique planned features with priority, dependencies, phase owner, bounded acceptance, release and security gate.
- [x] All 26 P1.01 use cases and 49 P1.02 FR requirements mapped.
- [x] Separate **internal build exit** from **external pilot and commercial launch** gates.
- [ ] Product owner approves feature priority and release gates as a **planning baseline**.
- [ ] Following approval close P1.05 and open **P1.06 Permission and Sharing Matrix**.

**P1.05 status: IN PROGRESS — owner review pending. Nothing implemented or tested.**
