# P1.04 — User Personas and Jobs-to-be-Done

**Version:** 0.1 — OWNER-REVIEW DRAFT
**Prepared:** 2026-11-13
**Phase:** P1.04 User Personas and Journeys
**Issue:** https://github.com/owaisprog/Zoho-Clone/issues/17
**Prerequisite:** [P1.01 PRD](prd.md), [P1.02 Functional SRS](srs.md), [P1.03 NFR](nfr.md) owner-approved as requirements on 2026-11-13.
**Research evidence:** **0 buyer interviews, 0 real-world merchant workflows validated.** The roles and pains below are **hypothesis-based synthetic personas**, not actual interviewed people. Real research debt is open in issue #8.

## 1. Persona design rules
- The **ISO / merchant-services company** is the direct SaaS buyer. The end merchant does not contract/pay for the initial platform.
- Distinguish job roles from permission assignments: one person may wear two hats; authorization remains explicit server-side tenant + role + record/agent/entitlement policy.
- Primary experiences: R0 organization setup, R1 sales CRM and R2 internal merchant operations. External agent portal, merchant-facing KYC, PayFac/POS processing and full suite modules are **deferred**.
- No screen currently exists. P2 will turn these role/job models into wireframes and accessibility states; P3/P4 onward will build and test the app.
- For internal documentation use invented generic roles only, never real respondent identities or confidential customer screenshots.

## 2. Persona overview

| Persona | Tier | Release | Distinct job | Permission boundary |
|---|---|---|---|---|
| PER-01 ISO CEO / COO (economic buyer) | Primary buyer | R0/R2 | Understand stalled merchant cases and accountability before deciding whether to fund a tool | Authorized cross-team summaries in own tenant, not unrestricted merchant files |
| PER-02 Organization owner / admin | Primary operational role | R0 | Create organization, invite staff and safely control who can access work | Own organization's identity, memberships and safe audit metadata; no platform-wide permission |
| PER-03 ISO sales representative | Primary daily user | R1 | Capture a lead, qualify it, manage a deal and hand it to onboarding | Assigned leads, contacts, deals and tasks under org/team policy |
| PER-04 Sales manager | Primary oversight user | R1 | Distribute workload and review deals/tasks within allowed teams | Authorized team scope only; no hidden cross-team counts |
| PER-05 Merchant onboarding coordinator | Primary daily user | R2 | Turn a won deal into a tracked merchant case and resolve the next blocker | Assigned merchants, safe case metadata, internal checklist/tasks; no raw onboarding identity/financial documents |
| PER-06 Operations manager / onboarding team lead | Primary decision user | R2 | Prioritize blocked applications, reassign internal work and report bottlenecks | Team/tenant-authorized application summaries and stage history |
| PER-07 Agent / reseller relationship manager | Primary secondary workflow | R2 | Associate merchant cases with the appropriate agent and handle reassignment disputes | Authorized agent roster and linked merchant records only |
| PER-08 Billing administrator | Supporting internal role | R0 | Understand organization plan and subscription state without handling card secrets | Organization subscription metadata and opaque billing references only |
| PER-09 Security / compliance reviewer | Supporting internal role | R0-R2 | Verify access boundaries and inspect sanitized audit evidence | Approved audit metadata; restricted access, no blanket full merchant data |
| PER-10 QA / platform test operator | Implementation supporting role | R0-R2 | Test two isolated fictional tenant accounts and ensure requirements work before release | Synthetic only; no imported live records or provider credentials |
| PER-11 External reseller / field agent | Deferred future persona | LATER | Safely view only own permitted merchant referral/application summaries | Only explicitly granted merchant refs; no processor identity docs, finance unless separately approved |
| PER-12 Merchant employee / applicant | Deferred future persona | LATER | Submit permitted processor-hosted verification information through approved partner channel | No raw ID/KYC/bank/card data in general CRM; provider-hosted only if contractually approved |

## 3. Detailed user personas (12)

### PER-01 — ISO CEO / COO (economic buyer)

- **Classification/release:** Primary buyer; R0/R2
- **Job story:** When this user needs to act, they must: Understand stalled merchant cases and accountability before deciding whether to fund a tool.
- **Goal:** See pipeline risk, responsible team and clear limits of processor integrations.
- **Usage context:** Reviews weekly operations via laptop; may delegate day-to-day workflow.
- **Likely pain to validate (NOT confirmed):** Fragmented agent, deal and application visibility (hypothesis).
- **Data and authority boundary:** Authorized cross-team summaries in own tenant, not unrestricted merchant files.
- **Proposed screens:** Home/dashboard, bottleneck overview, subscription and audit summary.
- **Observable success (once app is built):** Can identify high-priority blocked applications without accessing restricted records; measured task time later.
- **Misuse/edge risk:** A CEO title does not override tenant record policies; must not be shown false external approvals.
- **PRD trace:** UC-004, UC-207, UC-001. **Functional SRS trace:** FR-007, FR-040, FR-001.

### PER-02 — Organization owner / admin

- **Classification/release:** Primary operational role; R0
- **Job story:** When this user needs to act, they must: Create organization, invite staff and safely control who can access work.
- **Goal:** Fast workspace setup, correct membership and plan visibility.
- **Usage context:** Configures organization and roles on desktop with keyboard or pointer.
- **Likely pain to validate (NOT confirmed):** Manual role setups, accidental over-sharing and inaccessible settings (hypotheses).
- **Data and authority boundary:** Own organization's identity, memberships and safe audit metadata; no platform-wide permission.
- **Proposed screens:** Organization setup, user invitations, roles, app catalog, organization switcher.
- **Observable success (once app is built):** Correct invite/accept/revoke and no access after revocation.
- **Misuse/edge risk:** Cannot self-elevate to platform administrator or invite into another tenant.
- **PRD trace:** UC-001, UC-002, UC-003, UC-005. **Functional SRS trace:** FR-001, FR-003, FR-004, FR-005, FR-009.

### PER-03 — ISO sales representative

- **Classification/release:** Primary daily user; R1
- **Job story:** When this user needs to act, they must: Capture a lead, qualify it, manage a deal and hand it to onboarding.
- **Goal:** Preserve lead context and clear next action, avoid duplicate entry.
- **Usage context:** Daily CRM list/forms on laptop or mobile browser.
- **Likely pain to validate (NOT confirmed):** Lead notes scattered across chat and spreadsheets (hypothesis).
- **Data and authority boundary:** Assigned leads, contacts, deals and tasks under org/team policy.
- **Proposed screens:** Lead list/detail, account/contact forms, deal board, task inbox.
- **Observable success (once app is built):** Correct synthetic lead-to-deal task flow with no unauthorized records.
- **Misuse/edge risk:** Cannot bypass team records, enter card/bank/ID fields or treat deal won as processor approval.
- **PRD trace:** UC-101, UC-102, UC-103, UC-106. **Functional SRS trace:** FR-012, FR-016, FR-018, FR-020, FR-025.

### PER-04 — Sales manager

- **Classification/release:** Primary oversight user; R1
- **Job story:** When this user needs to act, they must: Distribute workload and review deals/tasks within allowed teams.
- **Goal:** Spot late tasks, identify ownership without disclosing other teams.
- **Usage context:** Frequent table filters and team dashboards.
- **Likely pain to validate (NOT confirmed):** Manual report reconciliation and stale pipeline notes (hypothesis).
- **Data and authority boundary:** Authorized team scope only; no hidden cross-team counts.
- **Proposed screens:** Pipeline report, deal board, owner filters, workload views.
- **Observable success (once app is built):** Reports reconcile with permitted rows and preserve least privilege.
- **Misuse/edge risk:** Manager role does not imply platform-wide records or financial KYC access.
- **PRD trace:** UC-103, UC-104. **Functional SRS trace:** FR-019, FR-021, FR-022.

### PER-05 — Merchant onboarding coordinator

- **Classification/release:** Primary daily user; R2
- **Job story:** When this user needs to act, they must: Turn a won deal into a tracked merchant case and resolve the next blocker.
- **Goal:** Know owner, internal stage, missing safe checklist item and handoff.
- **Usage context:** Works high-volume merchant application queue with interruptions.
- **Likely pain to validate (NOT confirmed):** Unclear who is waiting for whom and inconsistent status handoffs (unvalidated).
- **Data and authority boundary:** Assigned merchants, safe case metadata, internal checklist/tasks; no raw onboarding identity/financial documents.
- **Proposed screens:** Merchant/application queue and detail, checklist, next-action task, stage history.
- **Observable success (once app is built):** Correct owner/internal stage/next step for every synthetic stalled case.
- **Misuse/edge risk:** Cannot self-approve external underwriting, store bank/ID docs or mark active based on local checkbox.
- **PRD trace:** UC-201, UC-202, UC-203, UC-204, UC-208. **Functional SRS trace:** FR-027, FR-029, FR-030, FR-031, FR-034, FR-042.

### PER-06 — Operations manager / onboarding team lead

- **Classification/release:** Primary decision user; R2
- **Job story:** When this user needs to act, they must: Prioritize blocked applications, reassign internal work and report bottlenecks.
- **Goal:** Accurate aging, team accountability and exception resolution.
- **Usage context:** Morning queue review, weekly handoff reports.
- **Likely pain to validate (NOT confirmed):** Delayed follow-up without assigned responsibility (hypothesis).
- **Data and authority boundary:** Team/tenant-authorized application summaries and stage history.
- **Proposed screens:** Stalled dashboard, application queue, internal stage config, audit trail.
- **Observable success (once app is built):** Accurate counts, correct permitted handoff, no lost updates.
- **Misuse/edge risk:** No access to all merchants merely by manager title; external processor states remain separate.
- **PRD trace:** UC-203, UC-204, UC-207. **Functional SRS trace:** FR-031, FR-033, FR-034, FR-040.

### PER-07 — Agent / reseller relationship manager

- **Classification/release:** Primary secondary workflow; R2
- **Job story:** When this user needs to act, they must: Associate merchant cases with the appropriate agent and handle reassignment disputes.
- **Goal:** Correct portfolio assignment and history without unauthorized visibility.
- **Usage context:** Maintains internal agent directory and reassignment approvals.
- **Likely pain to validate (NOT confirmed):** Unclear agent ownership and former agents retaining access (hypothesis).
- **Data and authority boundary:** Authorized agent roster and linked merchant records only.
- **Proposed screens:** Agent directory, merchant association, assignment history.
- **Observable success (once app is built):** Immediate revocation of former agent access and consistent assignment audit.
- **Misuse/edge risk:** Internal agent records do not create an external agent portal.
- **PRD trace:** UC-201, UC-205. **Functional SRS trace:** FR-028, FR-036, FR-037.

### PER-08 — Billing administrator

- **Classification/release:** Supporting internal role; R0
- **Job story:** When this user needs to act, they must: Understand organization plan and subscription state without handling card secrets.
- **Goal:** Know feature eligibility and use hosted billing if owner approves provider.
- **Usage context:** Occasional account/plan checks.
- **Likely pain to validate (NOT confirmed):** Unclear seat allowances and plan restrictions (hypothesis).
- **Data and authority boundary:** Organization subscription metadata and opaque billing references only.
- **Proposed screens:** Subscription overview, entitlements, hosted billing link.
- **Observable success (once app is built):** Server rejects unentitled actions even when client UI is bypassed.
- **Misuse/edge risk:** Raw PAN/CVV/bank payment details prohibited; live payment integration not authorized.
- **PRD trace:** UC-004, UC-006. **Functional SRS trace:** FR-007, FR-010, FR-011.

### PER-09 — Security / compliance reviewer

- **Classification/release:** Supporting internal role; R0-R2
- **Job story:** When this user needs to act, they must: Verify access boundaries and inspect sanitized audit evidence.
- **Goal:** Reproduce denial, risk and retention findings without exposing raw secrets.
- **Usage context:** Review before future external pilot; not a current certification.
- **Likely pain to validate (NOT confirmed):** Missing audit trails, implicit support privileges (hypotheses).
- **Data and authority boundary:** Approved audit metadata; restricted access, no blanket full merchant data.
- **Proposed screens:** Audit event view, role policy view, authorized test report.
- **Observable success (once app is built):** Cross-tenant denial, absence of high-risk fields in logs, reproducible security checks.
- **Misuse/edge risk:** Security policy documents do not mean tested compliance.
- **PRD trace:** UC-003, UC-005, UC-208. **Functional SRS trace:** FR-005, FR-006, FR-009, FR-043.

### PER-10 — QA / platform test operator

- **Classification/release:** Implementation supporting role; R0-R2
- **Job story:** When this user needs to act, they must: Test two isolated fictional tenant accounts and ensure requirements work before release.
- **Goal:** Deterministic fixtures, negative tests and true pass/fail evidence.
- **Usage context:** CI and browser automation using Orchid and Juniper fake organizations.
- **Likely pain to validate (NOT confirmed):** Flaky fixtures, hidden errors and over-optimistic demo claims (risk).
- **Data and authority boundary:** Synthetic only; no imported live records or provider credentials.
- **Proposed screens:** Future test app, test status and redacted CI logs.
- **Observable success (once app is built):** All required negative tests executed with actual evidence once code exists.
- **Misuse/edge risk:** Specification test matrix must remain NOT_RUN until actual execution.
- **PRD trace:** UC-208, UC-106, UC-003. **Functional SRS trace:** FR-042, FR-043, FR-025.

### PER-11 — External reseller / field agent

- **Classification/release:** Deferred future persona; LATER
- **Job story:** When this user needs to act, they must: Safely view only own permitted merchant referral/application summaries.
- **Goal:** Self-service status with least privilege.
- **Usage context:** Future external portal, not part of first MVP.
- **Likely pain to validate (NOT confirmed):** Frequent requests for referral updates (unverified).
- **Data and authority boundary:** Only explicitly granted merchant refs; no processor identity docs, finance unless separately approved.
- **Proposed screens:** Deferred agent portal; NO current external login.
- **Observable success (once app is built):** No cross-agent portfolio disclosure in eventual separate track.
- **Misuse/edge risk:** Must not be invited into internal workspace by assuming internal agent record is an account.
- **PRD trace:** UC-303. **Functional SRS trace:** FR-046.

### PER-12 — Merchant employee / applicant

- **Classification/release:** Deferred future persona; LATER
- **Job story:** When this user needs to act, they must: Submit permitted processor-hosted verification information through approved partner channel.
- **Goal:** Clear requests and privacy expectations.
- **Usage context:** Future external regulated or hosted onboarding integration.
- **Likely pain to validate (NOT confirmed):** Unclear application document requests (unverified).
- **Data and authority boundary:** No raw ID/KYC/bank/card data in general CRM; provider-hosted only if contractually approved.
- **Proposed screens:** Deferred secure hosted partner portal; not an MVP screen.
- **Observable success (once app is built):** Correct privacy notices, only approved hosted collection (future).
- **Misuse/edge risk:** No direct underwriting, funds, POS/device fulfillment or uploads in current app.
- **PRD trace:** UC-301, UC-305. **Functional SRS trace:** FR-044, FR-048.


## 4. Role and accessibility implications
- Keyboard, focus indicators, non-color-only statuses, error recovery and responsive forms are part of every primary persona journey; WCAG 2.2 AA is an **approved design target, not demonstrated conformance**.
- High-volume operations users need concise status/ownership summaries and safe resume-after-interruption behavior; **exact performance goals remain NFR targets only**.
- Low-frequency administrators need clear consequences and confirmation for role revocation, billing/entitlement changes and organization switching.
- Agents and managers must never infer broad visibility from a title. Do not show full application records or financial metadata absent record-level authorization.
- Operators must distinguish **internal application progress** from an independently verified external processor decision. No “Approved/Live” UI badge based solely on a manual checkbox.
- Error/empty/loading/expired/session-revoked/billing-locked states must be user-visible and understandable for each journey.
- P2 should support desktop and mobile web, not assume a native mobile app exists.

## 5. Pending validation and product decisions

| Question | Responsible evidence / future gate | Current state |
|---|---|---|
| Are these the real users/buyers inside ISOs and which roles overlap? | Independent qualified ISO operations interviews, issue #8 | UNVALIDATED |
| Is stalled-application ownership a paid problem? | Neutral buyer tasks / willingness-to-pay tests | UNVALIDATED |
| What exact statuses/handoffs do specific ISO/POS/PayFac operators use? | At least 3 real-world workflow observations | 0/3; P0.05 waived for internal sequencing |
| Which agent/user records are visible in a hierarchy? | P1.06 permission matrix + owner policy review | TBD |
| Which stage labels and sample record fields are valid? | P1.07 domain glossary + real operational evidence | TBD |
| Will a team demand provider boarding/residual reporting in the initial version? | Buyer interviews and actual partner requirements | UNKNOWN; not promised MVP |
| Can real documents be uploaded? | Legal/privacy and file security design + tests | NOT PERMITTED IN MVP |
| What should an org owner pay for an active seat? | P0.08 qualified price research | 0/5; no approved prices |

## 6. P1.04 acceptance (documentation, not validation)
- [x] Primary buyer and major internal operator roles represented.
- [x] Roles describe goal, context, pain hypothesis, data restrictions, future metrics and relevant PRD/SRS traces.
- [x] Deferred personas are explicitly separate from initial R0-R2 external-access assumptions.
- [x] User journeys contain critical path, error, recovery and no-sensitive-data checkpoints.
- [ ] Owner reviews and **approves personas and journey assumptions as a planning baseline**.
- [ ] Actual customer interview validation remains outstanding and cannot be claimed from approval.

**P1.04 remains OPEN. No customer interviews, production usage or functional accessibility tests have occurred.**
