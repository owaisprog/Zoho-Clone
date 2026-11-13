# P1.03 — Nonfunctional Verification, Baseline and Evidence Plan

**Version:** v1.0 — Owner-approved P1.03 test/measurement design on 2026-11-13 · **NOT EXECUTED**
**Source:** [P1.03 NFR](nfr.md) and [46-item matrix](nfr-matrix.csv)
**Owner approval:** Product owner approved the proposed NFR targets and release gates as DESIGN REQUIREMENTS on 2026-11-13. All numeric thresholds are approved for later verification, **not observed or contractual**.

## 1. Synthetic benchmark profile (initial draft)
- Environment: document Node/Express build hash, Next.js build, Node runtime, Prisma/Postgres versions, server sizing, hosting region, worker count, DB index/connection pool and cache status.
- Ten fictional organizations, including Orchid and Juniper; 25 concurrent virtual users. Include at least two large fictional organizations with 10,000 leads and 1,000 merchant applications each; smaller orgs with randomized but **fake** records.
- Work mix: 60% reads/list/detail, 25% create/update, 10% filtered reporting/search, 5% permission/admin actions, using only allowed synthetic fields.
- At least 15 minutes of stable sustained load after warm-up, with independent cold-start run. Record throughput requests/s, p50/p95/p99, 5xx and timeout rates, CPU/memory/DB connections, response bytes, query plan and infrastructure cost.
- No public or real customer personal data, card/bank/ID/KYC, external processor tokens or real subscription payments.

**Targets proposed:** normal read p95 <=500ms; write p95 <=800ms; filtered report p95 <=900ms; unexpected 5xx <1%. A “pass” is impossible to assert until testing against a reproducible implementation.

## 2. Perf and capacity test procedure
1. Record commit SHA, benchmark runner configuration, OS/Node/DB versions, exact synthetic dataset seed and host limits.
2. Confirm tenant-to-user distribution and realistic row counts; do not benchmark empty tables as production load.
3. Run baseline GET list/detail, authorized POST/PATCH, filtered dashboard and route navigation; include pagination/cold caches.
4. Repeat at target 25 VUs and at least one stress run above the target to identify where response quality degrades. Stress failure is evidence, not a false success.
5. Compare observed p95/p99 to proposed acceptance numbers with numerator/sample size, error definitions and run dates visible.
6. Capture EXPLAIN plan for expensive tenant-filtered queries and prevent unbounded scans. Include permission enforcement time in latency results.
7. Review cloud/test cost against owner-approved spend cap; revise target or infrastructure only through decision log with reason.

**Frontend:** Use supported lab Lighthouse/Web Vitals/Playwright-style measurements; test page variations at desktop/mobile. LCP <=2.5s, INP <=200ms and CLS <=0.1 are **targets**, not measurements or compliance.

## 3. Security and tenant isolation verification (hard future gate)

| Family | Scenarios | What must be proved |
| --- | --- | --- |
| Tenant | User A probes org B IDs, list search, joins, reports, exports, background jobs | No B records/data/count/metadata exposed |
| Role/record | Revoked member, former agent, unauthorized admin/worker | Server denies access after revocation, including direct APIs |
| Sensitive fields | Fake markers in `cardNumber`, `cvv`, `bankAccountNumber`, ID attachments, import CSV and logs | Rejected or safely handled without persistence/leaking |
| Auth/session | Expired, forged/malformed, CSRF relevant, scope-switch, replay | Correct denial, no leaked secrets |
| Concurrency | Two users transition case concurrently, duplicate network retry | Exactly one valid history/outbox logical effect |
| Provider callback | Mock unsigned/duplicate/out-of-order events | Cannot spoof externally approved/active status |
| Files (only if implemented) | Nonmember access, public bucket, malicious test file, scan timeout, expired URL | Fail closed, policy and quarantine enforced |
| CI dependency | Synthetic canary secret, known vulnerable test package in safe isolated run | Scanner correctly alerts or gates merge |
| Logs/trace | Synthetic fake sensitive strings in error paths | No forbidden sensitive field appears in telemetry |

Use a review baseline mapped to OWASP ASVS 5.0.0 Level 2 **where applicable**, and OWASP API Security Top 10; document exceptions. A passed automated scanner alone never certifies a system.

## 4. Reliability, backups and recovery tests
- Run transaction fault injection and duplicate request tests; inspect DB stage and audit consistency.
- Simulate downstream provider timeout with **mock** endpoint and verify no false processor/billing success and clear user recovery instructions.
- Before external deployment, configure daily encrypted backups, confirm missed-backup alert and perform restore to separate isolated environment.
- Time the *complete* restoration to usable service including configuration/auth, data authorization checks and smoke tests; compare proposed RTO <=4h.
- Calculate age of the newest usable restored data against incident cutoff; compare proposed RPO <=24h. Avoid claiming RPO from backup job configuration alone.
- Exercise incident runbook and owner contact. Record blocked/unrecovered errors as failures, not edited screenshots.

## 5. Accessibility and UX checks
- Target W3C **WCAG 2.2 Level AA** for all approved pages/flows (not an existing conformance claim).
- Test keyboard-only navigation and focus recovery, form labels/error associations, contrast, reflow at 320 CSS px, mobile/desktop, screen reader flows and accessible dynamic content.
- Automated axe/Playwright/Lighthouse checks **plus** manual review are required; record WCAG criterion, page, user route and actual defect. Partial pages do not justify a full conformance claim.

## 6. Evidence table template

| Field | Required entry |
| --- | --- |
| NFR ID / acceptance case ID | Traceable `NFR-001` etc |
| Version, commit and exact environment | SHA, configuration, region, DB size, date |
| Target and unit | Provisional approved threshold or boolean hard gate |
| Actual result | Real observed number or PASS/FAIL with log evidence |
| Sample, duration and load | N/percentile formula/virtual users |
| Test type | Synthetic lab / integration / security / manual accessibility |
| Artifact/evidence location | CI run/log/benchmark report without secrets |
| Defect and severity | Issue link and whether release blocking |
| Outcome | PASS / FAIL / BLOCKED / NOT RUN |
| Reviewer / date | Owner and relevant engineer/security reviewer |
| Remediation/retest | Verified result or explicit outstanding risk |

**Current record:** No run exists. Every NFR acceptance case is marked `NOT_RUN_DOCUMENT_ONLY`.

## 7. Owner decisions to close during engineering
- Host/API/DB provider, region, size and estimated monthly budget for 25 VUs; product owner controls any external spending.
- Confirm target latency and capacity in context of actual benchmark hardware and costs.
- Approve availability measurement/SLO ownership and support coverage if ever offered externally.
- Choose backup/restore provider and test RPO/RTO feasibility; classify affected data with retention law.
- Formal security review responsibility, access/audit scope, privacy entity/controller role and target jurisdiction.
- Prioritize accessibility remediation, assistive-tech test coverage and browser support matrix.

These decisions are **not required to prepare the NFR draft**, but they are required to make numerical targets and release claims enforceable.

## 8. Exit and release distinctions

**P1.03 documentation exit:** owner approves the proposed thresholds, hard safety gates and measurement plan, while explicitly acknowledging they remain untested.

**Internal sandbox:** no real customer data, no external merchant processor transactions, no security compliance representation.

**Live external pilot/commercial:** requires actual implemented safeguards, test evidence, legal/contract readiness, authorized merchant data policies and separate owner approval. **An NFR document does not grant it.**

**Next sub-phase after approval:** P1.04 User Personas and Journeys.
