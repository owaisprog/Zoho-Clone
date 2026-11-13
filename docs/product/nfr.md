# P1.03 — Nonfunctional Software Requirements Specification (NFR)

**Project:** Zoho Clone (internal working name)
**Version:** 1.0 — OWNER-APPROVED P1.03 DESIGN BASELINE (2026-11-13)
**Prepared:** 2026-11-13
**Phase:** P1.03 Nonfunctional SRS
**Issue:** https://github.com/owaisprog/Zoho-Clone/issues/16
**Input:** [P1.01 Owner-Approved PRD](prd.md), [P1.02 Owner-Approved Functional SRS](srs.md) (2026-11-13)
**Status:** **P1.03 COMPLETE — owner-approved 2026-11-13 as DESIGN REQUIREMENTS ONLY.** No targets have been measured, no controls deployed, no compliance certification exists.
**Authorization:** P0.10 conditional internal GO; no real merchant/customer data, public customers, paid pilots or live payment/processor integrations.

## 1. How to read these targets

This document proposes **46 testable nonfunctional requirements** (NFR-001 through NFR-046) for initial releases R0 platform, R1 sales CRM and R2 merchant operations. Targets such as p95 latency, uptime, RPO, RTO and storage limits are **engineering objectives awaiting product-owner approval, budget/provider selection and later running-system measurement**. They are not current performance results, service level agreements, regulatory attestations or compliance guarantees.

`HARD_GATE` is a planned release restriction: **failure or absence of evidence must block the relevant external use**, especially cross-tenant isolation, authentication, prohibited data ingestion, encryption and secrets. Internal synthetic-only work may implement/test these iteratively but must never be presented as production-safe prematurely.

## 2. Benchmark definition and target environment

**Proposed synthetic workload for repeatability:**
- Ten fictional tenant organizations, including Orchid and Juniper, with at least 25 total concurrent virtual users.
- Two large fictional organizations seeded with approximately **10,000 leads and 1,000 merchant applications each**, plus linked users, contacts, agents, tasks and history.
- Use `example.com` addresses and invented merchant/agent identifiers; fake provider statuses clearly labeled **DEMO_ONLY**, never real processor approval.
- Model realistic operation mix (proposal): **60% list/detail reads, 25% updates/creation, 10% search/report filters, 5% administrative activity**; server/client/DB environments fixed and recorded.
- Run warm and cold traces separately, over at least **15 minutes** nominal load after a clear warmup, with measured error/latency and CPU/DB pool metrics.
- Measure API **edge/server** latency separately from frontend page/browser latency and external network/provider time; use p50/p95/p99, request counts, failure/timeout categories and 95% confidence only if data and method justify it.
- Record exact hardware, hosting region, browser/device simulation, app revision, seed size, test scripts, run date and estimated service cost. The physical instance size and external cloud provider are **not yet chosen**, so the 25-user workload is a *test profile*, not a proven capacity statement.

**R0/R1/R2 target set:** typical read p95 <=500 ms; write p95 <=800 ms; filtered list/report p95 <=900 ms under the scoped test profile. Subject to cost and measured baselines, not a contracted SLA.

## 3. Requirements by quality domain

### Performance

**NFR-001 — API normal reads** · R0-R2 · PROPOSED

- **Shall / proposed threshold:** Under agreed synthetic load, p95 server response <=500 ms and p99 <=1200 ms for representative paginated list/detail GET calls.
- **Verification protocol:** 25 concurrent virtual users; warm app; 10 demo orgs; 10k leads and 1k applications per large demo org; measure at API edge.
- **Planned implementation/testing phases:** P3/P12. **Evidence today:** NOT MEASURED.

**NFR-002 — API normal writes** · R0-R2 · PROPOSED

- **Shall / proposed threshold:** p95 <=800 ms and p99 <=1800 ms for authorized single-record create/update excluding external provider time.
- **Verification protocol:** 25 virtual users; same dataset; durable DB write and audit included.
- **Planned implementation/testing phases:** P3/P12. **Evidence today:** NOT MEASURED.

**NFR-003 — Filtered list/report** · R1-R2 · PROPOSED

- **Shall / proposed threshold:** p95 <=900 ms and no unbounded full-tenant scans for indexed filtered lead/app views.
- **Verification protocol:** 25 VU; 10k leads + 1k applications per large test org; EXPLAIN and trace.
- **Planned implementation/testing phases:** P5/P8/P12. **Evidence today:** NOT MEASURED.

**NFR-004 — Core Web Vitals** · R0-R2 · PROPOSED

- **Shall / proposed threshold:** At least 75% of tested user experiences target LCP <=2.5 s, INP <=200 ms and CLS <=0.1 for key production-like pages.
- **Verification protocol:** Mobile/desktop synthetic lab plus genuine RUM only when legitimately launched; no real customer tracking now.
- **Planned implementation/testing phases:** P2/P3/P12. **Evidence today:** NOT MEASURED.

**NFR-005 — Interactive navigation** · R1-R2 · PROPOSED

- **Shall / proposed threshold:** Common authenticated navigation or list filter produces visible progress within 200 ms and useful result <=2 s p95 in test profile.
- **Verification protocol:** End-to-end browser timings over representative demo seeded routes.
- **Planned implementation/testing phases:** P2/P12. **Evidence today:** NOT MEASURED.

**NFR-006 — Payload and pagination** · R0-R2 · PROPOSED

- **Shall / proposed threshold:** Default page <=25 records, max page <=100 and bounded projection/sorting; block unlimited page exports.
- **Verification protocol:** API request/response tests and network payload review.
- **Planned implementation/testing phases:** P5/P8. **Evidence today:** NOT MEASURED.

**NFR-007 — Import job target** · R1 · PROPOSED

- **Shall / proposed threshold:** After secure import implementation, 1000 synthetically safe CSV rows process within 120 s p95; report row-level outcomes and safe retry.
- **Verification protocol:** Staged/sanitized CSV import, no raw bank/card/ID fields; quarantine/scanner present if files allowed.
- **Planned implementation/testing phases:** P7/P12. **Evidence today:** NOT MEASURED.

### Capacity

**NFR-008 — Initial synthetic benchmark** · R0-R2 · PROPOSED

- **Shall / proposed threshold:** Demonstrate 25 concurrent active virtual users across >=10 fictional tenant organizations at selected dataset density.
- **Verification protocol:** Repeatable load tool, fixed revision/hardware/cloud profile recorded.
- **Planned implementation/testing phases:** P3/P12. **Evidence today:** NOT MEASURED.

**NFR-009 — Horizontal growth path** · R0-R2 · PROPOSED

- **Shall / proposed threshold:** API processes are stateless between requests; session/token state managed separately; no per-process tenant session cache is sole source of truth.
- **Verification protocol:** Architecture review and simulated process restart while synthetic workload continues.
- **Planned implementation/testing phases:** P3/P4. **Evidence today:** NOT MEASURED.

**NFR-010 — Resource and cost guardrail** · R0-R2 · OPEN_BUDGET

- **Shall / proposed threshold:** Record CPU, memory, DB pool, query count, storage and estimated provider bill at benchmark; alert on user-approved budget threshold.
- **Verification protocol:** CI/prelaunch benchmark with provider price inputs; cloud spending controlled by owner.
- **Planned implementation/testing phases:** P3/P12. **Evidence today:** NOT MEASURED.

### Reliability

**NFR-011 — Steady-state operation** · R0-R2 · PROPOSED

- **Shall / proposed threshold:** Nominal synthetic workload produces <1% unexpected 5xx responses excluding deliberate negative tests and dependency fault injections.
- **Verification protocol:** >=15 minute baseline, reproducible 25 VU test, categorize 4xx/5xx.
- **Planned implementation/testing phases:** P12. **Evidence today:** NOT MEASURED.

**NFR-012 — Future availability SLO** · R0-R2 · PROPOSED_NOT_SLA

- **Shall / proposed threshold:** Candidate production SLO >=99.9% monthly for externally accessible app/API, subject to realistic hosting, budget and contracts.
- **Verification protocol:** Only once launched; uptime monitors and agreed valid request definition; NOT current guarantee.
- **Planned implementation/testing phases:** P12/P14. **Evidence today:** NOT MEASURED.

**NFR-013 — Atomic operations** · R0-R2 · REQUIRED

- **Shall / proposed threshold:** Organization creation, stage transition/assignment and audit/outbox writes are atomic or recover with documented consistency compensation.
- **Verification protocol:** Transaction failure injection and database state validation.
- **Planned implementation/testing phases:** P4/P8/P12. **Evidence today:** NOT MEASURED.

**NFR-014 — Idempotent retries** · R0-R2 · REQUIRED

- **Shall / proposed threshold:** Repeated command using same scoped idempotency key never duplicates critical logical action or audit/state history.
- **Verification protocol:** Concurrency/replay tests with simulated timeouts and retries.
- **Planned implementation/testing phases:** P7/P12. **Evidence today:** NOT MEASURED.

**NFR-015 — Graceful partial failures** · R0-R2 · REQUIRED

- **Shall / proposed threshold:** External dependency outage/timeout cannot falsely mark processor approval, billing paid or user action completed; errors have safe retry paths.
- **Verification protocol:** Dependency injection tests, fake processor/provider endpoints only.
- **Planned implementation/testing phases:** P7/P12. **Evidence today:** NOT MEASURED.

**NFR-016 — Conflict correctness** · R0-R2 · REQUIRED

- **Shall / proposed threshold:** Concurrent authorized edits to the same versioned record do not silently overwrite the first writer.
- **Verification protocol:** Optimistic version / transaction race tests.
- **Planned implementation/testing phases:** P5/P8/P12. **Evidence today:** NOT MEASURED.

### Resilience

**NFR-017 — Backup cadence** · R0-R2 · PROPOSED

- **Shall / proposed threshold:** Before authorized customer deployment, encrypted automated DB backups at least daily; backup failure alarm within 1 h of missed schedule.
- **Verification protocol:** Managed DB backup monitoring; synthetic restore test in isolated target.
- **Planned implementation/testing phases:** P12/P14. **Evidence today:** NOT MEASURED.

**NFR-018 — Recovery point objective** · R0-R2 · PROPOSED

- **Shall / proposed threshold:** Candidate RPO <=24 h for initial production design, subject to provider/owner risk acceptance; not a current service guarantee.
- **Verification protocol:** Disaster-recovery drill with synthetic records and recorded last committed event.
- **Planned implementation/testing phases:** P12/P14. **Evidence today:** NOT MEASURED.

**NFR-019 — Recovery time objective** · R0-R2 · PROPOSED

- **Shall / proposed threshold:** Candidate RTO <=4 h for scoped single-region restored app after recoverable DB loss; subject to provider capability and owner approval.
- **Verification protocol:** Timed isolated full restore including auth/config and tenant test data.
- **Planned implementation/testing phases:** P12/P14. **Evidence today:** NOT MEASURED.

**NFR-020 — Restore verification** · R0-R2 · PROPOSED

- **Shall / proposed threshold:** Perform automated restore validity checks and a quarterly timed disaster-recovery rehearsal once operating production data.
- **Verification protocol:** Restore to isolated safe environment, smoke tests and retained evidence.
- **Planned implementation/testing phases:** P12/P14. **Evidence today:** NOT MEASURED.

### Security

**NFR-021 — Tenant isolation** · R0-R2 · HARD_GATE

- **Shall / proposed threshold:** Zero successful unauthorized cross-tenant or cross-record reads/writes/search/aggregates/exports under predefined negative test suite.
- **Verification protocol:** Two fictional orgs; IDOR, join, report, batch, background job and export probes.
- **Planned implementation/testing phases:** P4/P12. **Evidence today:** NOT MEASURED.

**NFR-022 — Role/record authorization** · R0-R2 · HARD_GATE

- **Shall / proposed threshold:** Every protected operation server-authorizes active membership, entitlement, role AND record policy; deny default.
- **Verification protocol:** Route/controller inventory and automated permission matrix tests.
- **Planned implementation/testing phases:** P4/P12. **Evidence today:** NOT MEASURED.

**NFR-023 — Session safety** · R0-R2 · HARD_GATE

- **Shall / proposed threshold:** Managed OIDC, secure cookie/session rules, CSRF mitigation where relevant, logout/revocation and token non-exposure.
- **Verification protocol:** Threat model and security tests; no raw secrets in dev fixtures.
- **Planned implementation/testing phases:** P4/P12. **Evidence today:** NOT MEASURED.

**NFR-024 — Sensitive input rejection** · R0-R2 · HARD_GATE

- **Shall / proposed threshold:** Zero accepted raw PAN/CVV/track, bank-account/routing, government-ID/KYC payloads or provider secrets in ordinary CRM fields/imports/logs.
- **Verification protocol:** Negative allowlist tests with fake marker strings and safe simulated secrets.
- **Planned implementation/testing phases:** P4/P7/P12. **Evidence today:** NOT MEASURED.

**NFR-025 — Transport and storage encryption** · R0-R2 · HARD_GATE

- **Shall / proposed threshold:** Use HTTPS/TLS for externally reachable traffic; provider-managed encryption at rest; keys never hardcoded.
- **Verification protocol:** Infra configuration inspection, secure endpoint verification and at-rest settings review.
- **Planned implementation/testing phases:** P3/P12. **Evidence today:** NOT MEASURED.

**NFR-026 — Secret and dependency hygiene** · R0-R2 · HARD_GATE_BEFORE_PRODUCTION

- **Shall / proposed threshold:** CI runs secret detection, dependency vulnerability check, lockfile integrity and SBOM output; block defined critical findings.
- **Verification protocol:** GitHub Actions with configured scanners, triage procedure and synthetic canary secret tests.
- **Planned implementation/testing phases:** P3/P12. **Evidence today:** NOT MEASURED.

**NFR-027 — Security baseline review** · R0-R2 · REVIEW_TARGET

- **Shall / proposed threshold:** Map applicable requirements to OWASP ASVS 5.0.0 Level 2 as a review target; prioritize API auth/access controls; no certification implied.
- **Verification protocol:** Document requirement mapping, test evidence and exceptions after architecture and security implementation.
- **Planned implementation/testing phases:** P12. **Evidence today:** NOT MEASURED.

**NFR-028 — Abuse resistance** · R0-R2 · REQUIRED

- **Shall / proposed threshold:** Per-identity/org/IP rate limits, request body size ceilings and safe pagination protect sensitive and expensive endpoints.
- **Verification protocol:** Synthetic abuse load and throttling tests; preserve fairness and avoid shared-office IP lockout.
- **Planned implementation/testing phases:** P3/P12. **Evidence today:** NOT MEASURED.

**NFR-029 — Audit and telemetry hygiene** · R0-R2 · HARD_GATE

- **Shall / proposed threshold:** Security and entity audit events include actor/tenant/action/time/outcome; no raw credentials, card, bank, identity or private request bodies.
- **Verification protocol:** Automated log scanning and negative error-path tests.
- **Planned implementation/testing phases:** P4/P12. **Evidence today:** NOT MEASURED.

**NFR-030 — Incident handling** · R0-R2 · HARD_GATE_BEFORE_PRODUCTION

- **Shall / proposed threshold:** Maintain severity definitions, security contact, incident runbook, credential rotation and evidence capture before external access.
- **Verification protocol:** Documented tabletop exercise and owner signoff.
- **Planned implementation/testing phases:** P12/P14. **Evidence today:** NOT MEASURED.

### Privacy

**NFR-031 — Data minimization** · R0-R2 · HARD_GATE

- **Shall / proposed threshold:** Collect only fields required by allowed workflow, with explicit purpose and P0.06 class; deny generic high-risk uploads at MVP.
- **Verification protocol:** Schema review, permissions and request/AI/log tests with synthetic data.
- **Planned implementation/testing phases:** P4/P12. **Evidence today:** NOT MEASURED.

**NFR-032 — Retention and deletion** · R0-R2 · OPEN_JURISDICTION

- **Shall / proposed threshold:** Every nonpublic category has approved retention trigger, deletion/export procedure, legal-hold handling and backup expiry design before live data.
- **Verification protocol:** Privacy/legal owner decisions; test deletion with synthetic records; not a universal legal period.
- **Planned implementation/testing phases:** P12/P14. **Evidence today:** NOT MEASURED.

**NFR-033 — Third-party boundary** · R0-R2 · HARD_GATE_BEFORE_PRODUCTION

- **Shall / proposed threshold:** No customer data goes to model/analytics/processor vendors unless legitimate purpose, approved contract, scope and minimization exist.
- **Verification protocol:** Integration inventory and outbound request review.
- **Planned implementation/testing phases:** P7/P10/P12. **Evidence today:** NOT MEASURED.

**NFR-034 — Private file pipeline** · R0-R2 · HARD_GATE_IF_FEATURE

- **Shall / proposed threshold:** If uploads later permitted, private quarantine, scanner fail-closed, strict purpose/ACL and signed URL expiry precede release.
- **Verification protocol:** Fake malware/timeout, cross-tenant file and expiring URL tests.
- **Planned implementation/testing phases:** P7/P12. **Evidence today:** NOT MEASURED.

### Accessibility

**NFR-035 — WCAG target** · R0-R2 · PROPOSED

- **Shall / proposed threshold:** All in-scope user workflows and pages target WCAG 2.2 Level AA, including keyboard use, contrast, labels, errors and focus.
- **Verification protocol:** Automated accessibility checks plus manual keyboard and assistive-tech review; not current compliance claim.
- **Planned implementation/testing phases:** P2/P12. **Evidence today:** NOT MEASURED.

**NFR-036 — Keyboard and focus** · R0-R2 · REQUIRED

- **Shall / proposed threshold:** No keyboard traps; all controls reachable/operable without mouse; visible focus and restored focus after dialogs.
- **Verification protocol:** Manual and Playwright keyboard tests on auth, list, form, modal and board.
- **Planned implementation/testing phases:** P2/P12. **Evidence today:** NOT MEASURED.

**NFR-037 — Responsive content** · R0-R2 · PROPOSED

- **Shall / proposed threshold:** Primary forms, tables and navigation usable at 320 CSS px content width without two-dimensional scrolling for ordinary text UI, except necessary complex data table views.
- **Verification protocol:** Desktop/mobile cross-browser viewport matrix and manual checks.
- **Planned implementation/testing phases:** P2/P12. **Evidence today:** NOT MEASURED.

**NFR-038 — Error comprehension** · R0-R2 · REQUIRED

- **Shall / proposed threshold:** Form validation gives programmatically associated messages, recovery guidance and preserved permitted input; not color-only.
- **Verification protocol:** Axe/assistive-tech/manual form review.
- **Planned implementation/testing phases:** P2/P12. **Evidence today:** NOT MEASURED.

### Observability

**NFR-039 — Structured traces and logs** · R0-R2 · REQUIRED

- **Shall / proposed threshold:** Each API request gets a correlation ID, safe structured error context and timing; service/dashboard separates auth denied vs app errors.
- **Verification protocol:** Synthetic error/fault injection and sampled OTel trace checks.
- **Planned implementation/testing phases:** P3/P12. **Evidence today:** NOT MEASURED.

**NFR-040 — Operational alerts** · R0-R2 · PROPOSED

- **Shall / proposed threshold:** High 5xx ratio, latency budget breach, backup failure and queue backlog raise actionable alerts to approved operator channel in test.
- **Verification protocol:** Run alert simulation and confirm runbook link/owner.
- **Planned implementation/testing phases:** P12/P14. **Evidence today:** NOT MEASURED.

### Maintainability

**NFR-041 — Automated quality gate** · R0-R2 · HARD_GATE

- **Shall / proposed threshold:** GitHub CI builds frontend/API, typechecks, lints, runs unit/integration tests and fails on critical tests before merge.
- **Verification protocol:** Real CI runs on code once P3 exists; no fictitious pass.
- **Planned implementation/testing phases:** P3/P12. **Evidence today:** NOT MEASURED.

**NFR-042 — Contract stability** · R0-R2 · REQUIRED

- **Shall / proposed threshold:** Version REST APIs and consumer-facing events; breaking change requires explicit migration/backward compatibility or version increment.
- **Verification protocol:** OpenAPI diff and contract test in CI.
- **Planned implementation/testing phases:** P3/P7/P12. **Evidence today:** NOT MEASURED.

**NFR-043 — Deterministic testing** · R0-R2 · REQUIRED

- **Shall / proposed threshold:** Tests use generated synthetic tenant fixtures, isolated DB, fixed clocks/IDs when needed; reruns independent of remote payment providers.
- **Verification protocol:** CI reruns and fixture isolation checks after scaffold.
- **Planned implementation/testing phases:** P3/P12. **Evidence today:** NOT MEASURED.

### Operations

**NFR-044 — Environment separation** · R0-R2 · HARD_GATE_BEFORE_PRODUCTION

- **Shall / proposed threshold:** Separate local/test/staging/sandbox/prod configs and secrets; no production data copied to test; deploy requires owner controls.
- **Verification protocol:** Config/permissions review and mock cross-env secret leak test.
- **Planned implementation/testing phases:** P3/P12. **Evidence today:** NOT MEASURED.

**NFR-045 — Release and rollback** · R0-R2 · REQUIRED

- **Shall / proposed threshold:** Version releases, DB migrations, rollback/forward-fix plan, approval and smoke tests before external delivery.
- **Verification protocol:** Staging deploy/rollback drill and migration rehearsal using synthetic DB.
- **Planned implementation/testing phases:** P3/P14. **Evidence today:** NOT MEASURED.

**NFR-046 — Budget and vendor governance** · R0-R2 · HARD_GATE_BEFORE_PAID_SERVICES

- **Shall / proposed threshold:** Owner approves provider accounts, spend cap, external billing and service terms; no live payments or chargeable services switched on silently.
- **Verification protocol:** Owner approval record and cloud budget alarm verification.
- **Planned implementation/testing phases:** P3/P14. **Evidence today:** NOT MEASURED.


## 4. Measurement interpretation: percentiles, availability and recovery

- **API latency:** record each completed request duration in milliseconds; report p95/p99 only when sample size and load class are disclosed. Intentionally rejected 401/403 and bad-input tests must be reported separately from successful business requests; do not conceal true unexpected errors.
- **Core Web Vitals:** LCP, INP and CLS are user-experience metrics; distinguish lab benchmarks from representative real-user measurements. No real-user analytics is authorized in the current synthetic-only phase.
- **Uptime:** candidate **99.9% monthly** target after launch and monitoring setup. No uptime SLA currently exists, and maintenance windows/provider scope need a later signed SLO.
- **RPO:** maximum acceptable age of restored data. Candidate <=24 hours; **daily backups alone do not prove RPO** without a successful restore/verified backup and relevant job schedules.
- **RTO:** total time to restore use of the defined service after an incident. Candidate <=4 hours; full DB, auth/config and authorization smoke tests required, not just a database download.
- **Zero-critical security expectation:** a zero finding count is meaningful only for clearly inventoried attack paths and repeatable tests; do not call that a universal security guarantee.
- **Release gates:** A proposed performance target can be re-baselined with recorded owner acceptance and provider constraints; unresolved cross-tenant exposure or prohibited-data handling cannot be waived for an external data-processing launch.

## 5. Accessibility and security reference baselines

We propose **WCAG 2.2 Level AA** as the web-product acceptance target for supported user workflows. Conformance, if later claimed, requires evidence for *whole pages*, responsive variants and relevant flows; automated checks alone are not sufficient. W3C reference: https://www.w3.org/TR/wcag/ .

OWASP **ASVS 5.0.0** is a security review reference for a reasonable **Level 2 target where applicable**, augmented with tenant/record policy and API threat checks. ASVS references do not imply an external assessment or certification. Official source: https://github.com/OWASP/ASVS ; https://asvs.owasp.org/ .

Other implementation guidance: OWASP API Security Top 10 https://owasp.org/API-Security/editions/2023/en/0x11-t10/ ; OWASP Logging Cheat Sheet https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet .

Payment/identity data must stay outside ordinary CRM records and synthetic fixtures as required by [P0.06 Data Classification](data_classification.md) and [Prohibited Fields](prohibited-fields.md). PCI/privacy laws and security certifications require separate actual system and jurisdiction-specific review. No jurisdiction is approved yet.

## 6. Release gate matrix

| Gate | Internal P3 sandbox (synthetic only) | Closed external pilot (real customers/data) | Public commercial production |
|---|---|---|---|
| PRD/SRS/NFR specification | Approved working baseline | Versioned and reviewed | Change-controlled current release |
| No raw card, bank, ID/KYC or secrets | Required even in demo | Hard block / hosted external provider only | Hard block unless separate specialist compliance scope |
| Tenant + record authorization | Implement/test iteratively | **Must pass actual negative access tests** | Must pass plus monitored evidence |
| Secrets, encryption, safe logging | Demo keys and secrets only, no production | Real infra and controls audited as appropriate | Verified and monitored |
| Backup, restore, recovery | Synthetic restore plan/test | Timed restore and documented recovery threshold | Verified production-capable DR and ownership |
| Accessibility & UX | Test incrementally | WCAG 2.2 AA target checked | Full launch-specific review and remediation |
| Service/cost/latency | Synthetic benchmark + budget estimate | Measured adequate pilot workload and guardrails | Owner-approved SLO/capacity/cost and monitoring |
| Privacy/legal/terms/jurisdiction | Track decisions; no live customer data | **Required and signed** | **Required and operationalized** |
| Processor and subscription integrations | Fake/mocked only | Real only with separate authorization/contracts | Fully tested, supported agreements |
| Market proof/pilot commitments | Not required due conditional GO | Real qualified scope and buyer consent | Commercial readiness review |

**No external access gate is granted by writing this document.** The owner must separately approve any live customer pilot or production launch after tests and review.

## 7. Verification evidence and ownership

- **P1.03:** Proposed, non-executed targets, measurement conditions and security hard gates are authored.
- **P1.06/P1.08:** Link role/matrix, API contract, response semantics and state-machine rules.
- **P2:** Accessible UX details and responsive behavior specifications.
- **P3:** CI, lint/typecheck/test/build, synthetic DB fixture setup and initial telemetry scaffolding.
- **P4–P8:** Actual multi-tenant authorization, data validations, merchant workflow, billing/mock provider behavior.
- **P12/P14:** Actual load tests, security regression, backup/restore drill, incident exercises and production release gates.

The [verification plan](nfr-verification-plan.md) contains test profile, evidence template and owner decision points; [NFR matrix](nfr-matrix.csv) and [acceptance cases](nfr-acceptance-cases.csv) support future traceability.

## 8. Proposed P1.03 acceptance checklist

- [x] Measurable budgets across latency, capacity, reliability, backups, accessibility, security, privacy and ops documented.
- [x] Every NFR has a target/policy, verification method, release scope and responsible implementation phase.
- [x] Explicit synthetic workload and environment assumptions; no invented benchmarks, certifications or real customers.
- [x] Performance tradeoffs and cost/availability/RPO/RTO are clearly proposed, not contractual.
- [x] Hard production gates distinguish internal test from external pilot and production use.
- [x] Future acceptance cases and measurement evidence template prepared.
- [x] **Product owner explicitly approved P1.03 proposed NFR targets and mandatory security/privacy release gates as design requirements, not verified results, on 2026-11-13.**
- [x] P1.03 was approved and closed; P1.04 User Personas and Journeys opened as issue #17.

**Status: P1.03 COMPLETE — owner-approved design specification; NFR measurements executed: 0.** Implementation and release gates remain mandatory.
