# P1.10 — Risk Register and Decision Governance

**Project:** Zoho Clone — internal working name  
**Version:** 0.1 — owner-review DRAFT  
**Prepared:** 2026-11-13  
**Phase issue:** [P1.10 #23](https://github.com/owaisprog/Zoho-Clone/issues/23)  
**Prerequisite:** P1.09 explicitly owner-approved as **planning requirements, not executed/passed tests**. All **14 gaps G-001–G-014 must remain OPEN**.  
**Status:** P1.10 **IN PROGRESS**; this risk ranking/assignment proposal awaits separate owner approval. No mitigation has been implemented by writing this file.

## 1. Executive risk snapshot

| Evidence | Current state |
|---|---|
| P1.09 requirements (26 UC + 49 FR + 46 NFR) | **121 requirement rows**, all with future planned test links, **0 executed** |
| Features | **36** documented, **none implemented** |
| API / events | **67 proposed REST operations**, **16 internal event types**, **no running services** |
| Test inventory | **727 cases**, all `NOT_RUN_DOCUMENT_ONLY`, **0 passes recorded** |
| Mandatory authorization design | **286 role/resource rules** (69 proposed allowed, 217 denied); **no runtime enforcement** |
| Gaps carried from [P1.09 coverage-gaps.md](../qa/coverage-gaps.md) | **14/14 OPEN**, mapped exactly to RISK-001 through RISK-014 |
| Provisional planning severity | **11 critical, 2 high, 1 medium**, **not measured probabilities or certifications** |
| Internal engineering authorization | P0.10 **conditional GO** for **synthetic-data-only internal work**, not release |
| External pilot, production, payments, data collection | **G-EXT / G-COM BLOCKED** pending actual evidence and explicit owner GO |

The current artifact is *not* a statement that a functioning system is safe or ready. The documentation-phase signoffs authorize the next planning step, not automatic feature delivery or data use.

## 2. Scoring and status policy

Each risk has a **proposed** likelihood 1–5 and consequence impact 1–5. The **planning score** is their product (1–25): **Critical 20–25**, **High 12–19**, **Medium 6–11**, **Low 1–5**. These are *internal prioritization guesses*, not observed operational probabilities, financial estimates, independent risk ratings or a license to waive mandatory controls. Owner review can adjust scores. Severity **never** overrides the hard safety boundaries.

- **OPEN:** mitigation/evidence missing; this applies to **all 14 carried gaps**.
- **MITIGATING:** work in progress; never assume risk resolved.
- **EVIDENCE_READY:** required real proof attached and reviewed; status still not closed until approval.
- **CLOSED:** individually reviewed, traceable mitigation evidence and owner signoff. A phase approval alone cannot close any gap.
- **ACCEPTED_RISK:** documented, scoped, time-bounded owner choice for **non-safety** residual risk only. This does *not* authorize violating tenant isolation, exposing real financial/identity data, skipping legal review, inventing test passes or external customer onboarding.
- **BLOCKED:** dependency/safety requirement stops a requested activity. BLOCKED can coexist with a risk being OPEN.

### Proposed ownership

The `proposed_mitigation_owner` column is a *responsibility role*, not a confirmed person. **Engineering (ChatGPT-led)** means the user’s desired ChatGPT-first development workflow for code/tests/docs; the product owner directs the scope and approves stage gates. External domain operator and legal/security review roles are **not staffed or completed**; their involvement is a future gate dependency, not a commitment to hire developers.

## 3. Complete gap-to-risk register (all currently OPEN)

| Risk | Gap | Proposed priority | Impacted gate | Proposed accountable role |
|---|---|---|---|---|
| `RISK-001` | [G-001](../qa/coverage-gaps.md) — Executable app absent | **CRITICAL** (25/25 design score) | G-INT | Product owner |
| `RISK-002` | [G-002](../qa/coverage-gaps.md) — No tests executed | **CRITICAL** (25/25 design score) | G-INT | Product owner |
| `RISK-003` | [G-003](../qa/coverage-gaps.md) — No runtime tenant/record/field enforcement | **CRITICAL** (25/25 design score) | G-INT/G-EXT | Security reviewer (not appointed) |
| `RISK-004` | [G-004](../qa/coverage-gaps.md) — No API or event implementation | **CRITICAL** (20/25 design score) | G-INT scoped | Product owner |
| `RISK-005` | [G-005](../qa/coverage-gaps.md) — UI-only and deferred PRD coverage | **MEDIUM** (9/25 design score) | P2/G-INT | Engineering (ChatGPT-led) |
| `RISK-006` | [G-006](../qa/coverage-gaps.md) — No independent feature-level test execution | **HIGH** (16/25 design score) | G-INT feature signoff | Product owner |
| `RISK-007` | [G-007](../qa/coverage-gaps.md) — Unvalidated external processor semantics | **CRITICAL** (25/25 design score) | G-EXT provider | Domain operator (not engaged) |
| `RISK-008` | [G-008](../qa/coverage-gaps.md) — Unvalidated customer value/pricing/pilot | **CRITICAL** (25/25 design score) | G-EXT/G-COM | Product owner |
| `RISK-009` | [G-009](../qa/coverage-gaps.md) — Missing privacy/security/legal readiness | **CRITICAL** (25/25 design score) | G-EXT/G-COM | Legal/security reviewer (not appointed) |
| `RISK-010` | [G-010](../qa/coverage-gaps.md) — No measured NFR/backups/accessibility | **CRITICAL** (20/25 design score) | G-EXT/G-COM | Product owner |
| `RISK-011` | [G-011](../qa/coverage-gaps.md) — Provisional entity/API/domain semantics | **HIGH** (16/25 design score) | P3/G-INT | Product owner |
| `RISK-012` | [G-012](../qa/coverage-gaps.md) — Mock billing and no commercial contracts | **CRITICAL** (20/25 design score) | G-COM | Product owner |
| `RISK-013` | [G-013](../qa/coverage-gaps.md) — No tested tenant-safe aggregates/exports | **CRITICAL** (25/25 design score) | G-INT R1/R2 | Product owner |
| `RISK-014` | [G-014](../qa/coverage-gaps.md) — No reproducible audit/CI evidence | **CRITICAL** (20/25 design score) | G-INT/G-EXT | Product owner |

The [machine-readable risk register](p1-risk-register.csv) is authoritative for the 14 item IDs, OPEN status, links, proposed owners, mitigation actions and exact closure evidence. The original [P1.09 gap register](../qa/coverage-gaps.md) **also remains open and unchanged**; this document is a linked follow-up, not a replacement that deletes previous evidence debt.

## 4. Blockers by release decision

**P1.10 approval (documentation only):** Can proceed while all 14 remain OPEN **if** each has a proposed owner, future evidence, trigger/checkpoint and correct blocker scope. No implementation acceptance follows automatically.

**P2 user experience design:** Can proceed using fictional data and provisional statuses. UI must label mock processor states clearly and must not assume unverified user/merchant flows or full-suite functionality.

**P3/P4 internal foundation:** Allowed to begin only under existing **synthetic-only** P0.10 conditional internal GO and required P2 design/phase sequencing. G-001/G-011 are especially relevant. Actual source code, migrations and runtime validation are future deliverables.

**R0/R1/R2 internal G-INT:** Requires actual working code and real test evidence for required features/denials. G-001, G-002, G-003, G-004, G-006, G-013 and G-014 are particularly important; they are not waived by planning approvals.

**External G-EXT:** Continues **BLOCKED** until real field/record authorization tests, privacy/security/legal readiness, viable buyer/pilot evidence, confirmed relevant operator workflows, reliable infrastructure, explicit pilot scope and separate owner approval. No current authorization to upload actual customer/merchant data.

**Paid/commercial G-COM:** Continues **BLOCKED**; additionally requires approved pricing, tax/contract/privacy terms, authorized billing provider integration, actual uptime/backup/support evidence, owner commercial GO and independent reviews as appropriate.

**Live processor/KYC/payments:** Explicitly **NOT AUTHORIZED**. No raw PAN/CVV, bank/routing, government IDs/KYC/KYB files, passwords or processing credentials in ordinary CRM. No real boarding/approval/activation inference from the `DEMO_ONLY_*` or internal stage labels.

## 5. Critical action order (proposed)

1. **Before implementation:** P1.10 owner accepts this register as *tracking*, resolves schema/release vocabulary decisions where possible, and P2 defines screens/workflows without false market or security claims.
2. **P3/P4 foundation:** Build actual source, test runner/CI, managed auth, verified active tenant and record/field authorization; execute two-tenant cross-org and privilege-denial tests; collect real run IDs.
3. **R1 build:** Implement sales workflows and tenant-scoped report/export restrictions, version/idempotency and accessible error states; gather executed evidence for G-006/G-013.
4. **R2 internal operations:** Implement safe merchant/internal application/agent links with explicit unverified processor provenance; protect current assignment and transition history.
5. **Before any external use:** Owner coordinates real ISO/POS/PayFac workflow validation and buyer/pilot proof, legal/privacy/security reviews, NFR/restore/accessibility verification and provider contracts where relevant. **Owner must explicitly reauthorize** external pilot/commercial stage.

The checkpoints are roadmap dependencies, **not dates or delivery promises**.

## 6. Evidence and review discipline

- Updates should reference the specific gap/risk ID, affected branch/commit, test/run ID or actual customer-research source, evidence artifact, review decision and timestamp.
- Do not close `RISK-00x` and `G-00x` merely because a document was written or P1.10 completed; require mitigation and **independent owner confirmation per item**.
- If the user wishes to postpone a nonblocking item for synthetic internal work, mark **OPEN / internal sequencing exception**, not "closed" or "passed".
- A test claim requires actual execution, assertions and redacted CI evidence. `727 planned` never means `727 passed`.
- Real customer/operator evidence must be anonymized, permissioned and not pushed as identifiable sensitive data to public GitHub.
- Review risks on each phase/gate transition and on material architecture, pricing, security, domain or vendor changes.

## 7. P1.10 owner review checklist

- [x] Every original **G-001–G-014** preserved one-to-one in [CSV](p1-risk-register.csv), all status `OPEN`.
- [x] Provisional likelihood/impact, mitigation owner, gate impact and closure evidence specified for all 14.
- [x] Nonwaivable tenant isolation, privacy, secret, security and external legal/provider controls explicitly retained.
- [x] [P1.10 decision register](p1-decision-register.md) separates approved baselines from unresolved choices.
- [x] [Risk mitigation sequencing plan](p1-risk-mitigation-plan.md) identifies proposed work by actual roadmap phase.
- [ ] Product owner approves the risk ranking, responsibility roles and open decisions as an **internal planning register**.
- [ ] Only then close P1.10 and proceed to **P2 user experience and interface design**, with all evidence gaps still open.

**P1.10 remains OPEN for separate owner review. Approval will not implement or validate software.**
