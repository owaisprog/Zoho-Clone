# P1.10 — Risk Mitigation Plan and Decision Checkpoints

**Version:** 0.1 — OWNER REVIEW DRAFT · 2026-11-13  
**Issue:** [P1.10 #23](https://github.com/owaisprog/Zoho-Clone/issues/23)  
**Inputs:** [14-open risk register](p1-risk-register.csv), [12 open decisions](p1-decision-backlog.csv), [P1.09 QA gaps](../qa/coverage-gaps.md), [R0/R1/R2 and G-EXT/G-COM gates](release-gates.md).  
**Operating limit:** Synthetic-data-only internal sequencing under P0.10. **No real customer/merchant records, provider boarding, financial data, paid pilot or public production authorized.** All 14 risk statuses stay OPEN.

## 1. Risk-first development sequencing

These are *dependency checkpoints*, not delivery dates. Owner-approved architecture/permission/acceptance documents inform design, but do not mean any code has been shipped.

| Checkpoint | Core action (ChatGPT-led engineering unless specified) | Open gaps to actively mitigate | Evidence to collect before claiming outcome | Gate |
|---|---|---|---|---|
| **P1.10 close / P2 entry** | Owner approves risk tracking, not the risk resolutions; classify deferred UX and stage assumptions | G-005, G-007, G-011 | Owner sign-off on tracking; recorded decisions still open; P1.09 727 NOT_RUN | P1/P2 planning only |
| **P2 UX** | Model authenticated org switch, lead/deal flows, merchant owner-stage-next action and failure/revoked states in synthetic screens | G-005, G-006, G-011 | Design files and interaction/accessibility checklists; *not runtime UI proof* | P2 design |
| **P3 project foundation** | Scaffold actual Next.js/Express TS/Prisma, CI, validation harness and fixture loader; no live data | G-001, G-002, G-004, G-014 | Clean clone reproducible build + actual CI URLs/commits + test runner execution | Early G-INT |
| **P4 organization/authorization foundation** | OIDC/session selection, tenant membership, role/record/field guards, audit; cross-tenant related IDs | G-003, G-011, G-014 | Executed default-deny, revoked membership, last-owner, IDOR and field-denial tests, actual schema and migrations | R0 G-INT HARD |
| **P5 sales CRM / P6 entitlements** | CRM/task/transition lifecycle, plan/server entitlement and mock billing only | G-004, G-006, G-013 | Validated synthetic CRUD + idempotency/aggregates/report visibility, no payment capture | R1 G-INT |
| **P7 safe jobs / P8 internal merchant ops** | Bounded safe import/export, outbox/worker scoping, agent-to-merchant cases and read-only demo external status | G-004, G-006, G-007, G-013 | Contract/outbox tests, prior agent revocation, 5 synthetic cases, no fabricated external verification | R2 G-INT |
| **P9–P11 other product capabilities** | Follow approved master roadmap; deferred apps need separately scoped feature/permissions/QA plans | G-005, G-006, G-012 | Approved additional-scope decision and actual feature tests when built | Independent app gates |
| **P12–P14 security/reliability** | Execute security/tenant tests, measured synthetic NFR load, restore drill, accessible keyboard/screen-reader checks, privacy lifecycle work | G-002, G-003, G-009, G-010, G-013, G-014 | Redacted CI artifacts, actual environments, true pass/fail results and reviewed defects | Required before G-EXT |
| **Operator/customer validation** (parallel; product owner) | Collect ISO/POS/PayFac process confirmation, buyer/pricing interviews and pilot interest | G-007, G-008 | Anonymized real evidence, gaps/false assumptions, owner decision to pivot/continue | Prerequisite G-EXT/G-COM |
| **Commercial/legal/vendor approval** (owner, qualified reviewers if applicable) | Legal entity/terms, DPAs, real-data region, provider/billing agreement, pricing, operational support | G-008, G-009, G-010, G-012 | Signed/approved contracts and privacy/security/production readiness evidence | G-EXT/G-COM CLOSED until new GO |

## 2. Nonwaivable guardrails

**Design:** P1.06 owner-approved least privilege and P0.06 data exclusions remain design requirements; they must become *actual tested code* before any external access. Do not store real PAN/CVV, bank/routing, government identity/KYC files, provider credentials or similar regulated data in ordinary CRM. Internal application stage and `DEMO_ONLY_*` fields cannot enable processor activity.

**Implementation:** G-INT requires real application functionality; successful execution and evidence for permissions, record scopes, transaction semantics and forbidden field handling. P1 design signoffs and planned QA links do not count as test passes.

**External:** G-EXT and G-COM remain blocked. No waiver/ChatGPT-generated document can substitute for owner authorization, real operator/customer input, contracts, legal/privacy work and independent technical validation where appropriate.

## 3. Evidence collection and risk update protocol

At each checkpoint, update the [CSV risk rows](p1-risk-register.csv) without changing the immutable `source_gap_id`. Attach:
1. Actual evidence type and redacted link: test run, commit, code path, migration/restore log, anonymized operator note or signed contract/reference.
2. Who evaluated evidence and exactly what was accepted; who is still accountable.
3. New likelihood/impact score **with dated explanation**, then state OPEN / MITIGATING / EVIDENCE_READY / CLOSED as warranted.
4. Whether the requirement blocks R0/R1/R2 internal, external pilot, commercial launch or a deferred integration.
5. If a risk is still OPEN, next checkpoint or blocking dependency and outstanding actions.
6. Update the original [G-00x source register](../qa/coverage-gaps.md) and relevant GitHub issues only when its actual evidence/closure requirement is met.

**Do not** reset or falsify `NOT_RUN_DOCUMENT_ONLY`; P3+ actual test execution logs need commit, environment, test ID, real outcome and reviewer. Planning could complete even while every implementation item remains OPEN, as explicitly directed.

## 4. Decisions that should happen before irreversible changes

- **P3/P4:** Decide managed auth/session, org membership/bootstrap, opaque identifier and tenant FK patterns, field policy projection and CI test runner.
- **P5/P7:** Decide safe import/export and authenticated/scope-limited jobs; avoid enabling general uploads or external-facing processor callbacks.
- **P8:** Leave process stage names and processor outcome mapping provisional until **3 real operator workflows** are confirmed.
- **G-EXT:** Product owner decides real customer pilot, acceptable data categories, privacy/contracting, security/NFR evidence and support escalation; no automatic promotion from G-INT.
- **G-COM:** Product owner decides publishable prices, billing vendor/taxes, seller/legal terms and production operations using real evidence.

All 12 unresolved items are in [P1.10 open decision backlog](p1-decision-backlog.csv); each remains OPEN until a distinct owner decision. Approving P1.10 does **not** silently approve those choices.

## 5. P1.10 planning acceptance vs release readiness

| Question | P1.10 may claim | P1.10 must NOT claim |
|---|---|---|
| Have risks been enumerated? | Yes, 14/14 gap-mapped OPEN risks | Risks mitigated or closed |
| Have mitigations been assigned? | Proposed engineering/product/review roles and future evidence | That missing reviewers/interviewees have been hired/engaged |
| Is product functionality verified? | No; 0/727 test executions | Running SaaS, passing security tests, real customer results |
| Can internal planning proceed? | Yes under existing P0.10 synthetic-only conditional GO | Real data, paid production or processor integration |
| Can P2 UX planning start after P1.10 approval? | Yes, with provisional synthetic requirements | That P2 screens or P3 app were automatically implemented |

## 6. Owner-review gate

- [x] All 14 G-001–G-014 remain OPEN with risk rank/owner/action/evidence.
- [x] P2/P3/P4/P5/P7/P8/P12-P14 risk mitigation checkpoints and external business validation separated.
- [x] 12 unresolved decisions tracked without fabricating signoffs.
- [x] Nonwaivable security/privacy and external approval boundaries explicitly preserved.
- [ ] Product owner separately approves P1.10 *planning register only* and next move to P2 UX Design.
- [ ] **No requirement/evidence gaps closed by P1.10 approval.**

**P1.10 remains IN PROGRESS awaiting owner approval.**
