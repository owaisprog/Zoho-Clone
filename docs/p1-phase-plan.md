# P1 — Requirements and Acceptance Contracts: Phase Plan

**Initiated:** 2026-11-13
**Status:** P1 active. P1.01–P1.08 OWNER-APPROVED and closed as provisional design; P1.09 Acceptance and Traceability Map drafted, owner review pending.
**Authorization:** P0.10 owner-signed conditional GO for P1/P2 and future P3 **synthetic-data-only** internal development. Real customer data and external launch **not** authorized.
**P1 exit:** Versioned owner-approved PRD/SRS, a traceability matrix, domain glossary and approved bounded MVP backlog.

## Master Roadmap v2.0 P1 sub-phases

| ID | Sub-phase / required output | Working artifact path | Status / owner gate |
|---|---|---|---|
| **P1.01** | **Master PRD** — users, success metrics, scope, prioritized releases | `docs/product/prd.md`, `prd-release-matrix.csv`, `prd-synthetic-fixtures.json` | **COMPLETE — owner-approved 2026-11-13; issue #14 closed** |
| P1.02 | Functional SRS — validations, states, errors and recovery | `docs/product/srs.md`, `srs-requirements.csv`, `srs-state-transitions.md`, `srs-acceptance-cases.csv` | **COMPLETE — owner-approved 2026-11-13; 49 requirements and 59 future acceptance cases; issue #15 closed** |
| P1.03 | Nonfunctional SRS — latency, reliability, backups, accessibility, security | `docs/product/nfr.md`, `nfr-matrix.csv`, `nfr-verification-plan.md`, `nfr-acceptance-cases.csv` | **COMPLETE — owner-approved design targets on 2026-11-13; 46 unmeasured NFRs, 52 unexecuted test cases; issue #16 closed** |
| P1.04 | User personas and journeys | `docs/product/personas.md`, `docs/product/journeys.md`, `docs/product/journey-map.csv`, `docs/product/journey-acceptance-cases.csv` | **COMPLETE — owner-approved provisional baseline 2026-11-13; 12 personas, 18 synthetic journeys, 72 steps and 36 unexecuted future tests; issue #17 closed** |
| P1.05 | Feature hierarchy and release gates | `docs/product/features.md`, `docs/product/mvp-backlog.csv`, `docs/product/feature-traceability.csv`, `docs/product/release-gates.md` | **COMPLETE — owner-approved internal planning baseline 2026-11-13; 36 features, 26 UC/49 FR traced; issue #18 closed** |
| P1.06 | Permission and sharing matrix | `docs/security/permission-matrix.md`, `permission-matrix.csv`, `permission-policy-rules.md`, `permission-negative-cases.csv` | **COMPLETE — owner-approved DESIGN REQUIREMENTS 2026-11-13; 286 permission rules / 52 future tests, nothing implemented; issue #19 closed** |
| P1.07 | Domain glossary and synthetic sample records | `docs/product/domain-glossary.md`, `domain-dictionary.csv`, `domain-relationships.md`, `domain-synthetic-records.json`, `domain-validation-cases.csv` | **COMPLETE — OWNER-APPROVED PROVISIONAL DESIGN 2026-11-13; 31 entities / 230 fields / 68 synthetic records / 46 future tests; issue #20 closed** |
| P1.08 | API and event contract specification | `docs/api/api-contracts.md`, `openapi-v1.json`, `api-traceability.csv`, `event-contracts.md`, `event-catalog.csv`, `event-envelope.schema.json`, `api-contract-cases.csv` | **COMPLETE — owner-approved provisional API/event design 2026-11-13; 67 operations, 16 events, 164 future tests; NOT implemented; issue #21 closed** |
| **P1.09** | **Acceptance and traceability map** | `docs/qa/acceptance-traceability.md`, `requirements-coverage.csv`, `feature-coverage.csv`, `test-inventory.csv`, `permission-decision-cases.csv`, `event-acceptance-cases.csv`, `release-acceptance-gates.md`, `coverage-gaps.md` | **IN PROGRESS — 121 requirements and 36 features mapped, 727 planned tests, 14 gaps; owner review pending; issue #22 open** |
| P1.10 | Risk and decision register | `docs/product/p1-risk-register.md` | NOT STARTED |

## P1.01 owner approval checklist

- [x] PRD authored; three proposed releases and out-of-scope specialist tracks.
- [x] All 26 major use cases mapped to an initial release and roadmap phase.
- [x] Synthetic fixture sample for two fictional organizations and five example merchant cases.
- [x] P0.06 approved data exclusions and tenant/privacy obligations referenced.
- [x] P0.04, P0.05, P0.07, P0.08 and P0.09 research shortfalls **not** treated as validated facts.
- [x] Owner approved the R0 platform, R1 CRM and R2 MerchantOps scope as P1.01 baseline on 2026-11-13.
- [x] P1.01 completed, GitHub issue #14 closed, P1.02 Functional SRS started and filed in issue #15.

## P1.02 approval and P1.03 next gate

- [x] Product owner explicitly approved P1.02 Functional SRS on 2026-11-13 (49 requirements, 59 unexecuted acceptance cases).
- [x] P1.03 drafted 46 NFRs with proposed measurement budgets, 52 unexecuted acceptance cases, repeatable synthetic load/test plan.
- [x] Owner approved P1.03 NFR design targets (latency, availability, backup RPO/RTO) and mandatory security/data gates on 2026-11-13; these are NOT measured or certified.
- [x] P1.03 issue #16 closed; P1.04 opened in issue #17.

## P1.04 working artifacts and acceptance

- [x] [Persona profiles](product/personas.md): **12** draft user roles/personas including deferred external users, all marked unvalidated.
- [x] [User journeys](product/journeys.md): **18** workflows covering R0/R1/R2 and deferred capability boundaries.
- [x] [Journey-step map](product/journey-map.csv): **72** synthetic steps, all **26** PRD use cases covered.
- [x] [Journey acceptance cases](product/journey-acceptance-cases.csv): **36** future experience/security scenarios, **not run**.
- [ ] Owner reviews and approves P1.04 persona and journey priorities before P1.05.

## P1.04 approval and P1.05 feature/release gate review

- [x] Product owner approved P1.04 synthetic personas and journeys as a **provisional internal planning baseline** on 2026-11-13; not customer-validated evidence.
- [x] 12 persona profiles, 18 journeys, 72 mapped steps and 36 unexecuted journey acceptance cases delivered; issue #17 closed.
- [x] P1.05 [feature taxonomy](product/features.md), [36-row priority backlog](product/mvp-backlog.csv), [complete UC/FR traceability](product/feature-traceability.csv), [release gates](product/release-gates.md) drafted.
- [ ] Product owner reviews and approves feature priorities, dependencies and **R0/R1/R2 internal vs external release gates**.
- [ ] Following approval close P1.05 and open P1.06 Permission and Sharing Matrix.

## P1.05 owner approval / P1.06 current documentation

- [x] Owner approved P1.05's 36 feature priorities, dependency order and R0/R1/R2 vs external release gates **as internal planning requirements only** on 2026-11-13.
- [x] P1.05 closed (#18). No feature implemented or any external pilot/production access authorized.
- [x] [Permission and Sharing Matrix](security/permission-matrix.md) — 13 actor roles, 22 resource families and default-deny policy.
- [x] [Role/resource policy CSV](security/permission-matrix.csv) — **286** proposed scope/action/field rules.
- [x] [Policy execution rules](security/permission-policy-rules.md) — membership, role, record, field, revocation and worker safety checks.
- [x] [52 future security denial cases](security/permission-negative-cases.csv) — **NOT EXECUTED**.
- [x] Owner approved P1.06 least-privilege roles, default deny, tenant isolation and field/record sharing rules **as design, not implemented controls** on 2026-11-13; issue #19 closed.

## P1.06 approval and P1.07 active data-domain baseline

- [x] P1.06 owner-approved 286 permission rules for 13 actors/22 resources, **52 future security tests NOT RUN**. No RBAC/ABAC/DB isolation implemented.
- [x] [Domain glossary](product/domain-glossary.md): **31 proposed entities**, bounded context terms and internal/external status distinction.
- [x] [Domain dictionary](product/domain-dictionary.csv): **230 candidate field definitions** with classifications and prohibited-field examples.
- [x] [Domain relationships](product/domain-relationships.md): **33 conceptual relation/integrity rules**.
- [x] [Synthetic sample records](product/domain-synthetic-records.json): fictional two-tenant safe sample, not executable database fixtures.
- [x] [Domain validation matrix](product/domain-validation-cases.csv): **46 future cases marked NOT RUN**.
- [x] Owner approved P1.07 entities/fields/status/relationships and synthetic records **as provisional design, not an implemented database schema** on 2026-11-13; issue #20 closed.

## P1.07 sign-off and P1.08 current API/event draft

- [x] P1.07 owner-approved 31 candidate entities, 230 field definitions, 33 relationship rules and 68 fictional records; no real DB/migrations or field-validation tests.
- [x] [REST contract](api/api-contracts.md) and [machine-readable draft OpenAPI](api/openapi-v1.json): **67 proposed operations**, 44 paths, 72 component schemas; **none implemented**.
- [x] [API traceability](api/api-traceability.csv): direct endpoint mapping to 18 of 26 PRD UC and 37 of 49 Functional FR; other scopes are UI/test/deferred, not fake live endpoints.
- [x] [Internal event contracts](api/event-contracts.md), [16-event catalog](api/event-catalog.csv), [event envelope schema](api/event-envelope.schema.json); not emitted or queued.
- [x] [164 future API contract cases](api/api-contract-cases.csv), all **NOT RUN**.
- [x] Owner approved P1.08 API routes, permission/error contracts, event envelope and deferred endpoints as **provisional design requirements, not implemented endpoints or events**, on 2026-11-13; issue #21 closed.

## P1.08 approval and active P1.09 acceptance traceability

- [x] P1.08 approved as provisional design: 67 REST operations, 16 events; no API/event runtime exists; issue #21 closed.
- [x] [Traceability specification](qa/acceptance-traceability.md) and [121-row UC/FR/NFR requirements map](qa/requirements-coverage.csv) authored; all 121 have **planned** tests.
- [x] [36-row feature coverage](qa/feature-coverage.csv) and [727-case test inventory](qa/test-inventory.csv) prepared; **ALL NOT RUN**.
- [x] [286 policy decision cases](qa/permission-decision-cases.csv) and [32 event cases](qa/event-acceptance-cases.csv) registered; NO permission engine or events implemented.
- [x] [Acceptance gates](qa/release-acceptance-gates.md) separate internal synthetic tests from external/paid launch.
- [x] [14-item coverage/evidence gap register](qa/coverage-gaps.md) keeps work open until real implementation and research.
- [ ] Owner reviews and approves P1.09 traceability and evidence rules as planning requirements before P1.10.

## Release gating (separate from documentation)

- **Internal sandbox:** synthetic data and no real processor/billing/merchant data.
- **Private real-customer pilot:** NOT AUTHORIZED until actual auth, tenant and record isolation, prohibited data rejection, security tests, privacy/contract and release conditions pass.
- **Commercial production:** NOT AUTHORIZED; needs measured buyer evidence, approved legal/brand/prices, appropriate independent security work and operational readiness.

## GitHub and implementation status

Public repo: https://github.com/owaisprog/Zoho-Clone  
P0 conditional approval record: `docs/product/p0-07-09-research-waivers.md`  
Open market evidence debt: https://github.com/owaisprog/Zoho-Clone/issues/8  
P1.01 completed issue: https://github.com/owaisprog/Zoho-Clone/issues/14  
P1.02 completed issue: https://github.com/owaisprog/Zoho-Clone/issues/15  
P1.03 completed issue: https://github.com/owaisprog/Zoho-Clone/issues/16  
P1.04 completed issue: https://github.com/owaisprog/Zoho-Clone/issues/17  
P1.05 completed issue: https://github.com/owaisprog/Zoho-Clone/issues/18  
P1.06 completed issue: https://github.com/owaisprog/Zoho-Clone/issues/19  
P1.07 completed issue: https://github.com/owaisprog/Zoho-Clone/issues/20  
P1.08 completed issue: https://github.com/owaisprog/Zoho-Clone/issues/21  
P1.09 active issue: https://github.com/owaisprog/Zoho-Clone/issues/22

**No Next.js or Express application has yet been scaffolded.** The top-level `frontend/` and `backend/` folders contain README placeholders. No P1 code tests were run because the deliverables are specifications.

## Execution rules

1. Respect explicit per-subphase owner approval, and do not infer acceptance from PDF/document generation.
2. Requirements must be testable, versioned, linkable to user roles and release dependencies.
3. Mark future use cases and external integrations as proposals until partners/contracts are available.
4. Do not put real contact details, merchant financial information, credentials or real customer workflows in public GitHub.
5. Build the actual app in P3/P4 and validate any claimed tests with real execution logs; synthetic fixture data is not proof of working software.
