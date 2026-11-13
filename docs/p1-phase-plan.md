# P1 — Requirements and Acceptance Contracts: Phase Plan

**Initiated:** 2026-11-13
**Status:** P1 active. P1.01 Master PRD OWNER-APPROVED and closed; P1.02 Functional SRS drafted, owner review pending.
**Authorization:** P0.10 owner-signed conditional GO for P1/P2 and future P3 **synthetic-data-only** internal development. Real customer data and external launch **not** authorized.
**P1 exit:** Versioned owner-approved PRD/SRS, a traceability matrix, domain glossary and approved bounded MVP backlog.

## Master Roadmap v2.0 P1 sub-phases

| ID | Sub-phase / required output | Working artifact path | Status / owner gate |
|---|---|---|---|
| **P1.01** | **Master PRD** — users, success metrics, scope, prioritized releases | `docs/product/prd.md`, `prd-release-matrix.csv`, `prd-synthetic-fixtures.json` | **COMPLETE — owner-approved 2026-11-13; issue #14 closed** |
| **P1.02** | **Functional SRS — validations, states, errors and recovery** | `docs/product/srs.md`, `srs-requirements.csv`, `srs-state-transitions.md`, `srs-acceptance-cases.csv` | **IN PROGRESS: 49 requirements, 59 future acceptance cases drafted; owner review pending; issue #15 open** |
| P1.03 | Nonfunctional SRS — latency, reliability, backups, accessibility, security | `docs/product/nfr.md` | NOT STARTED; needs P1.02 |
| P1.04 | User personas and journeys | `docs/product/personas.md`, `docs/product/journeys.md` | NOT STARTED |
| P1.05 | Feature hierarchy and release gates | `docs/product/features.md`, MVP backlog | NOT STARTED |
| P1.06 | Permission and sharing matrix | `docs/security/permission-matrix.md` | NOT STARTED |
| P1.07 | Domain glossary and synthetic sample records | `docs/product/domain-glossary.md`, synthetic examples | NOT STARTED |
| P1.08 | API and event contract specification | `docs/api/api-contracts.md`, versioned OpenAPI after design | NOT STARTED |
| P1.09 | Acceptance and traceability map | `docs/qa/acceptance-traceability.md` | NOT STARTED |
| P1.10 | Risk and decision register | `docs/product/p1-risk-register.md` | NOT STARTED |

## P1.01 owner approval checklist

- [x] PRD authored; three proposed releases and out-of-scope specialist tracks.
- [x] All 26 major use cases mapped to an initial release and roadmap phase.
- [x] Synthetic fixture sample for two fictional organizations and five example merchant cases.
- [x] P0.06 approved data exclusions and tenant/privacy obligations referenced.
- [x] P0.04, P0.05, P0.07, P0.08 and P0.09 research shortfalls **not** treated as validated facts.
- [x] Owner approved the R0 platform, R1 CRM and R2 MerchantOps scope as P1.01 baseline on 2026-11-13.
- [x] P1.01 completed, GitHub issue #14 closed, P1.02 Functional SRS started and filed in issue #15.

## Release gating (separate from documentation)

- **Internal sandbox:** synthetic data and no real processor/billing/merchant data.
- **Private real-customer pilot:** NOT AUTHORIZED until actual auth, tenant and record isolation, prohibited data rejection, security tests, privacy/contract and release conditions pass.
- **Commercial production:** NOT AUTHORIZED; needs measured buyer evidence, approved legal/brand/prices, appropriate independent security work and operational readiness.

## GitHub and implementation status

Public repo: https://github.com/owaisprog/Zoho-Clone  
P0 conditional approval record: `docs/product/p0-07-09-research-waivers.md`  
Open market evidence debt: https://github.com/owaisprog/Zoho-Clone/issues/8  
P1.01 completed issue: https://github.com/owaisprog/Zoho-Clone/issues/14  
P1.02 active issue: https://github.com/owaisprog/Zoho-Clone/issues/15

**No Next.js or Express application has yet been scaffolded.** The top-level `frontend/` and `backend/` folders contain README placeholders. No P1 code tests were run because the deliverables are specifications.

## Execution rules

1. Respect explicit per-subphase owner approval, and do not infer acceptance from PDF/document generation.
2. Requirements must be testable, versioned, linkable to user roles and release dependencies.
3. Mark future use cases and external integrations as proposals until partners/contracts are available.
4. Do not put real contact details, merchant financial information, credentials or real customer workflows in public GitHub.
5. Build the actual app in P3/P4 and validate any claimed tests with real execution logs; synthetic fixture data is not proof of working software.
