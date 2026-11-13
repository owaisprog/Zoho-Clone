# P1.05 — Release Gates, Acceptance Contracts and Deployment Boundaries

**Project:** Zoho Clone (internal working name)
**Version:** 1.0 — OWNER-APPROVED INTERNAL RELEASE GATE DESIGN (2026-11-13)
**Prepared:** 2026-11-13
**Phase:** P1.05 Feature Hierarchy and Release Gates
**Issue:** https://github.com/owaisprog/Zoho-Clone/issues/18
**Status:** P1.05 OWNER-APPROVED as internal release gate PLANNING on 2026-11-13. **No R0/R1/R2 feature has shipped, been deployed or passed runtime tests.** External pilot/production gates are NOT authorized.

## 1. Two different dimensions: implementation slice vs permission to release

**Product slices:** `R0` shared platform → `R1` sales CRM → `R2` merchant operations. These are *functional slices* inside future engineering phases P3–P12, not master roadmap phases P0/P1/P2.

**Distribution/operating permission gates:**

1. **G-INT** = internal sandbox with fictional synthetic data and mocks only. P0.10 conditional GO authorizes preparing this; tests still need to run.
2. **G-EXT** = controlled external pilot where real employees/merchant information might be processed. **NOT AUTHORIZED** by P0.10 or P1.05.
3. **G-COM** = paid/public production SaaS. **NOT AUTHORIZED**; requires separate business, legal, billing, security, reliability and owner decision.

An R0/R1/R2 feature marked “done in a developer branch” does NOT automatically make it safe for G-EXT or G-COM.

## 2. Gate status snapshot

| Gate | Requirements package | Implementation | Test evidence | Owner authorization |
|---|---|---|---|---|
| P1.05 feature taxonomy | 36 planned features, priority/UC/FR traceability approved as design | N/A | Documentation mapping only | **OWNER-APPROVED internal planning 2026-11-13** |
| R0 G-INT | Planned | **NOT BUILT** | **NOT RUN** | Synthetic-only internal path authorized in principle |
| R1 G-INT | Planned | **NOT BUILT** | **NOT RUN** | Synthetic-only internal path authorized in principle |
| R2 G-INT | Planned (merchant process still hypothetical) | **NOT BUILT** | **NOT RUN** | Synthetic-only internal path authorized in principle |
| G-EXT external pilot | Incomplete actual proof and contracts | **NOT BUILT** | **NOT RUN** | **NOT AUTHORIZED** |
| G-COM public/paid production | Commercial assumptions/unverified price; operational readiness absent | **NOT BUILT** | **NOT RUN** | **NOT AUTHORIZED** |

## 3. R0 — Shared SaaS Platform internal acceptance

**Entry / dependencies:** P1 PRD/SRS/NFR/personas and approved P1.05 features; P1.06 permissions, P1.07 domains, P1.08 API contracts, P1.09 traceability and P2 UX design must be completed before binding app contracts in implementation. P3 scaffolding and CI must exist.

**Expected internal behaviors (future implementation):**
- Organization creation and membership are atomic and tied to a verified authenticated actor; a member may select only a permitted organization.
- Approved roles, invitation acceptance, revocation, record policy and server-side app entitlements are enforced.
- A **synthetic mocked billing state** may demonstrate locked/eligible apps but never collect card/bank details or real money.
- Audit records have actor/action/target/time without secrets; error/expired session states recover accessibly.
- Two fictional tenants can execute positive and negative access scenarios (Orchid/Juniper), with no leakage by resource ID or aggregate.

**R0 G-INT proposed pass gate:**
- [ ] Actual Next.js/Express/Postgres/Prisma scaffold with CI builds; live local demo works.
- [ ] At least one real test for each relevant R0 `UC`/`FR` and a documented test run; no synthetic expected result masquerades as actual.
- [ ] Tenant/role denial, revocation, entitlements, forbidden fields and audit-negative tests pass on running code.
- [ ] Failed invite, expired auth, locked app and duplicate request behavior verified.
- [ ] Owner reviews real test evidence, residual defects and budget before marking R0 implemented.

**External safety:** Passing G-INT alone does not pass G-EXT; additional independent security/privacy/legal release requirements apply.

## 4. R1 — Sales CRM internal acceptance

**Entry:** R0 has a functioning and **tested** auth/tenant/record foundation, and P1.06 permissions/REST contracts are approved.

**Expected internal behaviors:**
- Leads, contacts, accounts, deals/pipelines, tasks and activities with validated same-org relationships, scoped search and audit.
- Loading/empty/validation/error/timeout/offline/conflict/retry/keyboard states.
- Pipeline reports reconcile to authorized deals and do not reveal other teams or tenant counts.
- CSV import/export remain disabled until allowlist, private file workflow/scan if required, safe exports and real negative tests pass.

**R1 G-INT proposed pass gate:**
- [ ] Functional CRUD, lifecycle/history, task assignment and authorized report flows pass with real synthetic tests.
- [ ] Denied cross-tenant/cross-team queries, exports, invalid relation IDs, stale versions and duplicate submissions tested.
- [ ] Form/keyboard/mobile accessibility tested against P1.03 WCAG 2.2 AA design target; failures logged.
- [ ] Prohibited raw card/bank/ID/KYC/secret markers not persisted or leaked to logs.
- [ ] API latency tests on available test environment collected honestly; NFR targets evaluated, not assumed.
- [ ] Owner signs off implementation evidence and known missing SHOULD items.

**Absent result** means **NOT DONE**, even if specification text says “acceptance expected”.

## 5. R2 — Internal Merchant Operations internal acceptance

**Entry:** R0/R1 foundation works and permissions, record entities, state-transition schema and test fixtures are approved.

**Expected internal behaviors:**
- Internal agent directory, merchant links, application stage/checklist history, owner and next action, stalled queue and scoped dashboard.
- Internal progress is visibly **separate** from a verified processor's actual decision; provider state remains unknown/synthetic absent a contracted integration.
- At least five fictional merchant cases spanning draft, blocked, externally pending, declined and provider-approved-not-active demo cases.
- Reassign agent and revoke old access immediately while retaining safe audit/history.
- No raw identity/KYC/bank/card info, direct payment processing, live merchant boarding, residual payout or merchant self-service portal.

**R2 G-INT proposed pass gate:**
- [ ] Each included R2 requirement has actual passing test evidence in future runtime.
- [ ] An authorized user correctly identifies owner/internal stage/next action on all five synthetic cases.
- [ ] Invalid stage, double submission, stale version and transaction failure do not corrupt history or duplicate case.
- [ ] Reassigned/former agent cannot access records via lists, IDs, reports or cached entitlement.
- [ ] Verified processor approval is not fabricated by an internal checkbox and cannot be spoofed by unsigned mock provider events.
- [ ] Dashboard aggregates reconcile with accessible record set.
- [ ] Product owner approves R2 demo *as an internal testable prototype only*; not as a market-ready merchant product.

**Important research caveat:** P0.05 has **0/3** actual merchant process validations; domain state labels remain provisional. Record this risk at each stage.

## 6. G-EXT — Separate authorization for a real external pilot

**CURRENT STATUS: BLOCKED.** The product owner has **not** authorized external pilots or real customer/merchant information.

Before considering G-EXT, **all** appropriate controls require real evidence (not just doc checkboxes):
- [ ] Qualified operator/buyer confirms pilot problem and the relevant merchant lifecycle/record semantics; record alternatives and incorrect assumptions.
- [ ] Organization and record-policy tests pass including indirect references, reports, exports, background jobs, revoked users and role changes; no unresolved critical/high security findings.
- [ ] Authentication, secrets, encryption, safe telemetry, forbidden raw data fields, billing/processor boundary and file protections (if uploads exist) are implemented and tested.
- [ ] Privacy notice, data retention/export/deletion, hosting region, controller/processor contracts, supplier DPAs and acceptable customer data types approved for actual selling jurisdiction.
- [ ] Private pilot terms, named permitted customer sponsor, support/incident escalation, data handling and offboarding process agreed.
- [ ] Backup restore, incident runbook, recovery objectives and appropriate accessibility/performance baseline tested with real deployment resources.
- [ ] External integrations are disabled unless contractually authorized, authenticated and security tested; no fake processor outcomes.
- [ ] New, explicit product-owner G-EXT approval after independent review as appropriate.

**Cannot waive critical privacy/security obligations via a documentation-phase approval.**

## 7. G-COM — Separate authorization for commercial/paid production

**CURRENT STATUS: BLOCKED.** G-COM additionally requires:
- [ ] Real evidence of demand, willingness to pay and feature fit; no false customer, ROI or performance claims.
- [ ] Owner-approved publishable pricing, taxes, refund/subscription terms, legal entity, brand/trademark review and approved billing-provider contract.
- [ ] Verified production infrastructure, monitoring/on-call coverage, backup restore, SLAs/SLOs and cost viability.
- [ ] Product functionality, invoices, entitlements and support workflows actually implemented and tested.
- [ ] Accessibility/security reviews, data-minimization restrictions and appropriate independent legal/compliance work.
- [ ] Data migration/exit procedure and contractual breach/incident terms.
- [ ] New, explicit owner GO for public release; P0.10 internal GO is insufficient.

## 8. Gate state machine and authority

| State | Meaning | Permitted transition |
|---|---|---|
| PLANNED | PRD, feature design and acceptance written; no implementation | Development starts under existing internal sandbox approval |
| IN_IMPLEMENTATION | Code, fixtures and tests being authored on controlled branch | To READY_FOR_TEST after build compiles |
| READY_FOR_TEST | Actual running app and repeatable test environment available | To TESTED only after executed tests and evidence |
| TESTED_INTERNAL | G-INT conditions met; unresolved defects documented | To INTERNAL_ACCEPTED after explicit owner approval |
| INTERNAL_ACCEPTED | Internal synthetic prototype accepted | May **request** G-EXT review, not auto-release |
| EXTERNAL_REVIEW | Security/privacy/legal/customer pilot conditions being evaluated | To EXTERNAL_APPROVED only with formal owner authorization |
| EXTERNAL_APPROVED | Controlled authorized external pilot scope only | Does not auto authorize paid/public production |
| COMMERCIAL_REVIEW | Market + production readiness evaluated | To COMMERCIAL_APPROVED only after separate owner sign-off |
| COMMERCIAL_APPROVED | Allowed scoped production launch with current release conditions | Change-controlled new launches and new apps still require re-review |
| BLOCKED | Missing mandatory evidence, failed test, unsafe data or no authority | Return to review after actual mitigation and retest |

Do not use GitHub issue labels as a substitute for explicit recorded evidence and sign-off.

## 9. Non-negotiable critical requirement references

- [P0.06 prohibited fields](prohibited-fields.md): no raw PAN/CVV, bank details, government IDs/KYC files or secrets in generic CRM.
- [P1.02 Functional SRS](srs.md): tenant-scoped server authorization, audit, stage history, idempotency and internal/external status separation.
- [P1.03 NFR](nfr.md): target read p95 <=500ms, 99.9% future uptime, 24h RPO, 4h RTO, WCAG 2.2 AA and security controls are **design requirements, not test results**.
- [P1.04 Journeys](journeys.md): 12 provisional personas and 18 synthetic workflow narratives, not real interviews.
- [Research debt issue #8](https://github.com/owaisprog/Zoho-Clone/issues/8): required customer evidence remains absent.

## 10. P1.05 owner acceptance and next phase

- [x] R0/R1/R2 feature boundaries, dependency and backlog priority prepared.
- [x] Differentiated G-INT, G-EXT and G-COM safety, product, legal and market gates.
- [x] Explicit no-live-data/no-processor/no-payment boundaries.
- [x] Fully traceable backlog to 26 UC/49 FR.
- [x] Product owner approved P1.05 feature hierarchy, priorities and internal-vs-production gate design as an internal planning baseline on 2026-11-13.
- [x] P1.05 issue #18 closed and P1.06 Permission and Sharing Matrix started in issue #19.

**P1.05 COMPLETE as an owner-approved planning design.** No actual product release gate, test, app, external launch or certification has been passed.
