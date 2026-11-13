# P1.09 — Acceptance Gates and Real Test Evidence Requirements

**Version:** 0.1 · Owner-review draft · 2026-11-13  
**Companion:** [Acceptance traceability](acceptance-traceability.md), [Master inventory](test-inventory.csv), [G-INT/G-EXT/G-COM policy from P1.05](../product/release-gates.md).  
**Status:** DOCUMENTATION ONLY. **0 of 727 future cases executed.** Nothing in this file is proof of a running or secure product.

## 1. Separate three concepts

1. **Planning gate:** Requirements, owners, acceptance criteria and future test IDs documented and product-owner-approved. This is what P1.09 can complete.
2. **Internal implementation gate (G-INT):** Running local/staging synthetic-data-only app exists; scoped tests run with real evidence; owner can accept a prototype within approved scope.
3. **External permission gates (G-EXT, G-COM):** Additional legal/privacy, real-world process validation, contracts, security and production readiness reviews. A passing internal demo is NOT authorization to use customer data, work with real processors, or charge users.

## 2. Release readiness matrix

| Product slice | Intended function | Documentary P1 evidence | Runtime G-INT hard evidence required later | External gate |
|---|---|---|---|---|
| **R0 Shared SaaS** | Identity, orgs, membership/roles, entitlements, safe audit | UC/FR/NFR, role matrix, API, planned test cases | Real build, running session/tenant policy, fail-closed IDOR/privilege/role revocation tests, synthetic 2-org fixture, audited mock billing | G-EXT BLOCKED pending real security/privacy review and approval |
| **R1 Sales CRM** | Leads/Accounts/Contacts/Deals/Tasks, pipeline, reports, authorized transfer jobs | PRD/FR, stage/field design, OpenAPI, expected cases | CRUD/stage/ownership tests, accessible form errors, idempotency/conflicts, scoped aggregate/CSV authorization, forbidden raw fields rejected and logs safe | G-EXT BLOCKED pending data handling, buyer and legal terms |
| **R2 Merchant Operations** | Internal agent, merchant and application owners/stages/next actions, history/checklists and scoped reports | Provisional domain states, role matrix, internal-only events and planned test cases | 5 fictional merchant scenarios, owner/stage/next-action triad tested, assignment revocation, internal history correctness, no real external status effects | G-EXT BLOCKED pending real operator stages, processor/privacy/legal evidence |
| **Cross-cutting NFR** | Reliability, performance, backups, a11y, observability, secure delivery | 46 NFR targets / 52 planned cases | Measured future synthetic load with environment details, tested restore, accessibility review and security scans | Independent real customer/production safety approval |
| **Deferred capabilities** | Provider boarding, finance/residuals, KYC, POS, portals, other applications | Explicit out-of-scope tags and denial tests | No real integration permitted under current P0.10 | Requires entirely separate approved scope and provider contracts |

### Proposed R0 internal gate
- [ ] Commit-specific CI build and real local/staging Express+Next+Prisma app exists.
- [ ] Identity/bootstrap active membership, tenant isolation, least-privilege role tests and direct-ID denials actually PASS with retained run IDs.
- [ ] Revoked user, missing org membership, forged role and client-selected org ID fail closed on actual server.
- [ ] Secret/sensitive-field data rejected and never included in logs.
- [ ] Appropriate R0 performance/security/accessibility tests executed; fail/block reasons disclosed.
- [ ] Owner approves internal synthetic-only R0 acceptance and documents open defects.

### Proposed R1 internal gate
- [ ] R0 authorization is verified and has not regressed.
- [ ] Core CRUD and deal transition/task results actually pass, including permissions, duplicate create and version conflict.
- [ ] Field allowlist, cross-org relational ID, report/count and export/import denial tests pass before enabling risky features.
- [ ] Keyboard/mobile, error/focus/loading/retry scenarios actually exercised and documented.
- [ ] Owner accepts known skipped SHOULD features and remaining risks explicitly.

### Proposed R2 internal gate
- [ ] R0/R1 regression suite and R2 merchant/agent/application tests have run, not just been described.
- [ ] All 5 fake merchant onboarding cases have correct permitted owner / internal stage / next action.
- [ ] Agent reassignment denies old access on next request; audit history remains.
- [ ] Invalid internal stage, stale version, forged provider events and non-sensitive checklist checks pass.
- [ ] Tenant-filtered bottleneck counts reconcile and no fake processor/activation/financial outcomes are presented.
- [ ] Owner accepts **internal demo only**, not validated processor software.

## 3. Required test run record template (for future actual runs)

| Field | Future value | Why |
|---|---|---|
| `run_id` | CI pipeline job URL or deterministic local run ID | Evidence origin |
| `test_id` | Original stable ID from master test inventory | No ambiguous case renaming |
| `commit_sha` | Exact built commit | Replayable code identity |
| `fixture_ref` | Synthetic dataset version and isolated tenant count | No real data/secret use |
| `environment` | OS, browser, Node, DB, hosting, memory/CPU and tool versions | Result relevance |
| `executed_at` | UTC time, not a made-up date | Actual execution |
| `actual_status` | PASS / FAIL / BLOCKED / SKIPPED | Distinguishes observed outcome from expected |
| `assertion` | Actual observed result, redacted evidence/artifact reference | Auditability |
| `defect_link` | GitHub issue or documented exception where required | Remediation |
| `reviewer` | Assigned reviewer and owner approval for gate decisions | Accountability |

Do **not** write `PASS`, `100% secure`, `WCAG certified`, `99.9% uptime achieved`, `backup restored`, `PCI compliant`, `processor approved` or `pilot launched` based on test design/ChatGPT-generated scripts alone.

## 4. Policy for failures, waivers and risk acceptance

- **Planning waiver:** P0.10 permits progressing *internal synthetic engineering* despite unvalidated market evidence and no pilots; it does not waive actual tenant isolation or external legal/privacy/processor obligations.
- **Failed hard security test:** Block affected use and external release; record defect and retest; never convert to success via waiver language.
- **Blocked/untested test:** Keep `NOT_RUN`/BLOCKED in real run tracker with explanation. No silent green rollup.
- **Deferred module:** Mark NOT_IN_SCOPE / DEFERRED; test *absence* of unauthorized paths rather than claim fully functional integration.
- **Changing requirement:** Update FR, UC, NFR, feature, API, event, policy, test inventory and releases; rerun affected tests when code exists.
- **Commercial release:** Requires new explicit G-COM decision with real evidence, approved provider/legal scope, monitored production operation and appropriate security/privacy review.

## 5. P1.09 planning acceptance

- [x] All 121 UC/FR/NFR requirements have planned tests.
- [x] All 36 planned features have linked acceptance criteria, though specific runtime feature tests may need refinement before implementation.
- [x] All 286 permission-matrix decisions, 67 API operations and 16 events have proposed coverage.
- [x] A unified 727-case inventory has unique IDs; **none executed**.
- [ ] Product owner explicitly signs off P1.09 acceptance/traceability planning.
- [ ] After signoff move to P1.10 Risk and Decision Register, **not automatically to production**.

**Current status: OWNER APPROVAL PENDING.**
