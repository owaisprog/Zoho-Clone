# P1.10 — Design Decision Register (Approved Baselines vs Open Choices)

**Version:** 0.1 · Owner-review DRAFT · 2026-11-13  
**Linked phase:** [P1.10 #23](https://github.com/owaisprog/Zoho-Clone/issues/23)  
**Status:** Historical approvals are recorded accurately; **12 new decisions remain OPEN**. P1.10 has *not* received owner signoff. No production/data use authorized.

## 1. Existing owner-approved baselines (not new approvals)

| Reference | Subject | Exact status | Decision boundary |
|---|---|---|---|
| BASE-001 (P0.10) | P0.10 conditional internal GO | **APPROVED_INTERNAL_ONLY** | Proceed with synthetic-only internal sequencing despite unresolved buyer/pilot proof. Does not grant G-EXT/G-COM; G-007/G-008/G-009 stay OPEN |
| BASE-002 (P1 architectural decisions) | Stack selection | **APPROVED_DESIGN** | Next.js React TypeScript Tailwind frontend, Express TypeScript backend, PostgreSQL/Prisma, modular monolith. No code or infrastructure exists just because stack chosen |
| BASE-003 (P1.05) | R0/R1/R2 release slices | **APPROVED_PLANNING** | Shared platform, sales CRM, internal merchant operations; full suite and sensitive integrations deferred. Functional slices are not actual release gates |
| BASE-004 (P1.06) | Permission and sharing | **APPROVED_DESIGN** | Least privilege/default-deny, tenant+record+field authorization; owner/admin not universal business-data readers. No server-side RBAC/ABAC or DB row-level control implemented |
| BASE-005 (P0.06/P1.07) | Sensitive data exclusions | **APPROVED_DESIGN** | No raw card/bank/government ID/KYC/KYB/credential capture in ordinary CRM. Regulatory/legal compliance not certified |
| BASE-006 (P1.07) | Domain glossary | **APPROVED_PROVISIONAL_DESIGN** | 31 entities/230 proposed field definitions; synthetic 68 examples; processor states explicitly unverified. No migrations; real ISO/POS/PayFac state validation 0/3 |
| BASE-007 (P1.08) | REST API/event contracts | **APPROVED_PROVISIONAL_DESIGN** | 67 REST operations, 16 internal events, scoped auth/error/outbox design. No Express routes, event services or processors running |
| BASE-008 (P1.09) | Acceptance/traceability | **APPROVED_PLANNING** | 121 requirements, 36 features linked to 727 planned tests; real-run evidence required. 0 tests executed/passed; do not misstate as completed QA |
| BASE-009 (P0.10) | P0 evidence waiver | **APPROVED_INTERNAL_SEQUENCING_ONLY** | Unvalidated P0.07 prospect value, P0.08 5 pricing interviews and P0.09 2 pilot commitments carried as open debt. Never described as actual prospect, customer or pilot evidence |
| BASE-010 (P0.10/P1.05) | External/paid release | **NOT_AUTHORIZED** | G-EXT/G-COM blocked until actual proof, privacy/security/legal and owner GO. No external pilot, live merchant processing or paid launch |

Approved *design requirements* are not evidence of implemented software, legal review, security certification, or user/research validation. The P0.10 owner waiver only allows **internal synthetic engineering sequencing**.

## 2. Choices requiring future decisions (no fake owner approvals)

| Decision ID | Pending decision | Safe current default | Owner / next checkpoint | Gaps |
|---|---|---|---|---|
| `OPEN-001` | Managed identity provider and invite acceptance | Do not implement custom password storage by default | Engineering (ChatGPT-led) proposes; owner selects; P3/P4 | G-003;G-004 |
| `OPEN-002` | Opaque identifiers and tenant relational keys | Keep P1.07 fake IDs illustrative; never migrate actual data now | Engineering proposes; owner approves; P3/P4 | G-011 |
| `OPEN-003` | Fine-grained record permissions | Default deny; no blanket owner/admin reads | Engineering proposes; owner approves; P2/P4 | G-003;G-011;G-013 |
| `OPEN-004` | Merchant application states | Retain provisional demo-only stages; no processor authority | Product owner with domain operator evidence; Before any live processor feature | G-007;G-011 |
| `OPEN-005` | Event delivery runtime | No worker/principal wildcard; internal only | Engineering proposes; owner approves; P3/P7 | G-004;G-014 |
| `OPEN-006` | CSV import/export storage and security | Disable file endpoints until controls exist | Engineering proposes; owner approves; P5/P7/P12 | G-003;G-013 |
| `OPEN-007` | NFR benchmarks and deployment environment | Design targets not attained SLA | Engineering proposes; owner approves; P3/P12 | G-002;G-010;G-014 |
| `OPEN-008` | Market validation and partner evidence | Internal waiver is not commercialization validation | Product owner; Before G-EXT/G-COM | G-007;G-008 |
| `OPEN-009` | Real billing/legal/tax vendor selection | Mock only; no real charges or subscription setup | Product owner and legal reviewer if needed; Before G-COM | G-009;G-012 |
| `OPEN-010` | Hosting region, retention and privacy policies | No real-data G-EXT authorization | Product owner; independent reviewer if appropriate; Before G-EXT | G-009;G-010 |
| `OPEN-011` | Feature-specific executable QA allocation | 727 planning cases do not imply execution | Engineering proposes; owner approves; P3/P4/P12 | G-001;G-002;G-006;G-014 |
| `OPEN-012` | R0/R1/R2 pilot scope and product branding | No Zoho-brand copying/parity claims or public launch without approval | Product owner; Before G-EXT/G-COM | G-008;G-012 |

The machine-readable [open decision log](p1-decision-backlog.csv) contains all 12 decisions, options/context, checkpoints and `OPEN_NEEDS_DECISION_NOT_APPROVED` status. The original [master decision log](decisions.md) remains the source of already-recorded owner choices; this list is a scoped P1.10 continuation and must not silently overwrite those baselines.

## 3. Decision-making rules

1. The **product owner approves** scopes, costs, providers, policies and release transitions. Engineering (ChatGPT-led) can research, write code, run tests and propose options using available tools, but cannot automatically bind the owner's external accounts or authorize live customer data.
2. Keep tenant isolation, field minimization, data classification and privacy/security controls as mandatory design/release constraints. There is no unilateral waiver for real-data external use.
3. Architecture selections should include a short rationale, alternatives, reversible path, impact on PRD/FR/NFR/feature/API/permission/test records, and exact issue/change ref.
4. Decisions can stay OPEN at P1.10 closure if the owner accepts **the tracking plan only**, provided the decisions are not prerequisites for the next synthetic-only phase.
5. External operator, billing, real customer, legal and provider decisions remain prerequisites for G-EXT/G-COM even when P2/P3 continue.
6. No claimed "pass", "secure", "ready", "pilot", "customer approved", "processor live", "regulatory compliant" without independent actual evidence.

## 4. P1.10 acceptance

- [x] Ten existing accepted/prohibited design baselines distinguished from unapproved choices.
- [x] Twelve future decisions with owner/checkpoint and linked gap(s) registered as OPEN.
- [x] Every P1.09 G-001 through G-014 remains open in the [risk register](p1-risk-register.csv).
- [ ] Product owner reviews and approves P1.10 risk/decision governance, **not the individual open selections**.
- [ ] After owner approval, close issue #23 and move to P2 UX design; open choices remain tracked.

**No new architectural, legal, commercial or security certification decision is claimed as already signed by the owner.**
