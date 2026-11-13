# P1.02 — Functional Software Requirements Specification (SRS)

**Project:** Zoho Clone (internal working name only)
**Version:** v0.1 — **owner-review draft**
**Prepared:** 2026-11-13
**Status:** IN PROGRESS — written specification, **no application functionality implemented or tested**
**GitHub issue:** https://github.com/owaisprog/Zoho-Clone/issues/15
**Approved input:** [P1.01 Master PRD](prd.md), owner-approved on 2026-11-13.
**Release order:** R0 Shared SaaS, R1 Sales CRM, R2 Merchant Operations, all later specialist + suite apps separately scoped.
**Authorization:** P0.10 conditional GO for internal synthetic-data-only development; no live customer data or external pilot.

## 1. Purpose and scope

This SRS translates the approved 26 PRD use cases into **49 numbered, verifiable proposed functional requirements**. It covers who may invoke an operation, what must be validated, expected state changes, error and recovery behavior, and which requirements are deferred. These **are specifications**, not backend API endpoints implemented today.

Companion documents:
- [Machine-readable requirements](srs-requirements.csv) — FR -> UC -> release traceability.
- [State transitions and invariants](srs-state-transitions.md) — candidate internal flows, non-equivalence to external processor decisions.
- [Future acceptance test matrix](srs-acceptance-cases.csv) — positive/negative test scenarios, **not yet executed**.
- [P1.01 use-case/release map](prd-release-matrix.csv) — input traceability.

P0.05 real workflows were explicitly skipped (0/3 validated). Therefore status names, merchant-application processes and processor state mapping below are **provisional** until actual qualified operator evidence is available. Do not freeze a regulated processor-specific schema based on hypothetical diagrams.

## 2. Actors and authentication boundary

| Actor | Allowed conceptual responsibility | Prohibited assumption |
|---|---|---|
| Unauthenticated visitor | Public product information; begin managed sign-in | Cannot access tenant data, CRM or membership |
| Authenticated member | View/select only own eligible organizations | Client-chosen `orgId` never confers access |
| Organization owner/admin | Organization membership, role invitation, plan visibility | Cannot bypass privacy/tenant boundaries or secretly self-grant platform admin |
| Sales representative | Leads, contacts, own/authorized accounts, deals and tasks | No blanket access to all orgs, underwriter status or finance |
| Sales manager | Authorized team pipelines and reporting | Team management does not imply all platform tenant access |
| Onboarding coordinator | Assigned merchants, internal applications, checklists and follow-ups | Does **not** authorize processor underwriting or external approval |
| Operations manager | Authorized bottleneck queues and staff assignments | Cannot fabricate external payment/merchant activation |
| Agent manager | Agent/merchant relationships and assignments | Internal agent record is not an external agent portal |
| Billing administrator | Organization entitlements and hosted billing links | Never raw PAN, CVV, bank or customer identity data |
| Platform administrator | Platform operations with audited exceptional access policy only | Never unrestricted cross-tenant business record read |
| Integration worker (later) | Verified provider callbacks, idempotent status references | No live external API integration assumed |

Final role names and inheritance belong to **P1.06 Permission and Sharing Matrix**. No code should assume a role string alone bypasses record-specific grants.

## 3. Cross-cutting functional business rules

**FBR-01 Authentication:** Protected operations require a valid, active server-verified identity/session. Session refresh/logout/revocation must be safe. Credential/token values do not belong in business records or logs.

**FBR-02 Tenant selection:** Every protected request resolves the selected organization from verified membership, checks active membership, and rejects cross-organization ID references. Tenant context is **not** trusted merely because a client sends an ID.

**FBR-03 Record policy:** A tenant match is necessary but not sufficient; role, team, owner, agent assignment, purpose and entitlement are checked for all reads/writes/exports/aggregations. Denials must avoid leaking target record existence.

**FBR-04 Input safety:** Exact allowed fields are validated (Zod planned); reject unknown keys, oversized payloads, invalid enums, illegal relation IDs and prohibited raw banking/card/identity/KYC/secret fields. Free text cannot be assumed safe by a regex; add input policy and operational escalation.

**FBR-05 Atomicity:** Create/deactivate/assign/transition operations either persist all related records and audit/outbox effects together or leave previous state unchanged; database constraints enforce referential/tenant safety.

**FBR-06 Audit:** Audit critical/privileged state changes and denials with actor, org, target ref, action, time and outcome without dumping sensitive values. Application stage history is not mutable by ordinary users.

**FBR-07 Concurrency:** Mutating status/pipeline/assignment supports optimistic version checks or equivalent safe serialization. Clients receive a conflict/reload response rather than overwriting another user's successful change.

**FBR-08 Idempotency:** Retry of a logical action (especially invites, imports, case creation, status transitions and future provider events) cannot silently duplicate entities or history. Specify retention and idempotency key policy later.

**FBR-09 Search/reports:** Query authorization happens before row matching, pagination, sorting, aggregation or export. Counts cannot reveal other tenants/teams. Search must be bounded, canonicalized and resilient to hostile input.

**FBR-10 Recovery:** Validation errors preserve editable client input where safe. Timeouts distinguish unknown action outcome from a confirmed failure; client checks status before non-idempotent retries. No false "saved" toast after a failed response.

**FBR-11 Data classification:** PUBLIC, INTERNAL, CONFIDENTIAL, RESTRICTED and SPECIAL_REGULATED are P0.06-approved design classes. No ordinary CRM raw PAN/CVV/track, bank account/routing, ID/KYC/KYB document or secret collection, storage, attachment or logging. Sensitive raw customer data remains excluded from internal sandbox too.

**FBR-12 Synthetic-only:** All examples and future internal demos use fictional organizations/merchants and `example.com` email domains; no live processor API credentials or customer data. `DEMO_ONLY_*` statuses must never be mistaken for real provider outcomes.

**FBR-13 Feature state:** If an application module is outside the authorized release or plan, deny the protected API action server-side; a hidden UI control is not an entitlement check.

**FBR-14 Internal vs provider authority:** Staff may change permitted internal workflow state; only an independently authorized and verified provider operation may establish external processor state. `approved`, `boarded`, `active`, `charges_enabled` or `payouts_enabled` are not interchangeable.

**FBR-15 Evidence gate:** Actual workflow stage policies, retention, processor fields, pricing and operational targets are proposals pending P1.06/P1.07/P1.08, real customer validation and applicable legal/security review.

## 4. Requirements by release

### R0 — Shared Platform

**FR-001** · UC-001 · Actor: Org owner

- **System shall:** Create an organization using an allowlisted display name; derive the initial owner membership from the authenticated actor.
- **Validation/security:** Name trimmed 2–120 characters; reject empty, controls, forbidden fields.
- **Acceptance behavior:** Create org and owner membership atomically; return scoped org id.

**FR-002** · UC-001 · Actor: Member

- **System shall:** List only organizations in which caller has an active verified membership; switch active org through server-verified membership.
- **Validation/security:** No trust in client-supplied orgId; suspended/deleted membership not selectable.
- **Acceptance behavior:** Another tenant is never revealed or selected.

**FR-003** · UC-002 · Actor: Org admin

- **System shall:** Invite an email to a bounded allowed role and track pending/accepted/expired/revoked invitations.
- **Validation/security:** Email syntactically valid; invitation TTL and resend policy configurable.
- **Acceptance behavior:** Unapproved role or cross-org invite rejected; invitee accepts with verified identity.

**FR-004** · UC-002 · Actor: Org admin

- **System shall:** Revoke or change a member role and invalidate authorization immediately on subsequent requests.
- **Validation/security:** Cannot leave active organization without an authorized owner; no arbitrary super-admin grant.
- **Acceptance behavior:** Revoked member can neither list nor mutate tenant records.

**FR-005** · UC-003 · Actor: All users

- **System shall:** Enforce organization membership and record-policy checks for every entity read, write, relation lookup, aggregate and export.
- **Validation/security:** Org from verified session; resource org must match; check record owner/team policy.
- **Acceptance behavior:** Cross-tenant ID probes and list queries do not leak records.

**FR-006** · UC-003 · Actor: Platform admin

- **System shall:** Deny blanket platform support access to customer records unless a separately reviewed just-in-time support flow exists.
- **Validation/security:** No implicit support impersonation; elevated actions are audited.
- **Acceptance behavior:** Internal platform user without org authorization sees no tenant records.

**FR-007** · UC-004 · Actor: Org owner

- **System shall:** Expose purchased/enabled application grants and organization plan limits to an authorized role.
- **Validation/security:** Entitlement comes from server-side status, not UI flags.
- **Acceptance behavior:** Disabled/expired/over-quota feature cannot be invoked by API.

**FR-008** · UC-004 · Actor: API service

- **System shall:** Apply app entitlements, usage ceilings and relevant role checks on protected writes, batch operations and jobs.
- **Validation/security:** Consistent atomic reservation/check on quotas when applicable.
- **Acceptance behavior:** Concurrent requests cannot bypass plan limit by racing.

**FR-009** · UC-005 · Actor: Authorized user

- **System shall:** Record immutable-meaning audit of critical actions and denied privileged attempts, scoped by org and actor.
- **Validation/security:** Fields: actor, target ref, action, timestamp, outcome; redact secret values.
- **Acceptance behavior:** Who/what/when trace is retrievable by authorized reviewers only.

**FR-010** · UC-006 · Actor: Billing admin

- **System shall:** Provide a hosted payment-provider checkout/portal handoff after provider/legal terms are approved.
- **Validation/security:** Never accept raw card or bank details in business API.
- **Acceptance behavior:** Sandbox may use mock billing status; no actual charge authorized.

**FR-011** · UC-006 · Actor: Billing service

- **System shall:** Handle later approved billing-provider callbacks via verified signatures and idempotent state mapping.
- **Validation/security:** Do not trust browser-reported payment success or unverified webhook.
- **Acceptance behavior:** Duplicate/out-of-order events do not activate unearned entitlements.

### R1 — Sales CRM

**FR-012** · UC-101 · Actor: Sales rep

- **System shall:** Create and edit a lead with name, company context, contact channel, source, assigned owner and allowed status.
- **Validation/security:** Trim length, validate contact formats if present, validate owner membership.
- **Acceptance behavior:** Invalid lead is rejected without partial persistence.

**FR-013** · UC-101 · Actor: Sales user

- **System shall:** List/search/filter leads within organization and assigned/team scope, with pagination and deterministic sort.
- **Validation/security:** Bound page size; no public global search; escape search output.
- **Acceptance behavior:** Other org leads and private fields are absent from results.

**FR-014** · UC-101 · Actor: Sales user

- **System shall:** Progress lead stage according to configured pipeline rules with tracked actor/time.
- **Validation/security:** No arbitrary unsupported state value or out-of-scope edit.
- **Acceptance behavior:** Lead stage history records authorized change.

**FR-015** · UC-102 · Actor: Sales user

- **System shall:** Create/update an Account with required name and optional permitted business metadata.
- **Validation/security:** Account name 2–160 characters; no bank/identity/card fields.
- **Acceptance behavior:** Organization-scoped Account created and accessible only by allowed roles.

**FR-016** · UC-102 · Actor: Sales user

- **System shall:** Create/update Contacts and associate them with same-organization Accounts, if permitted.
- **Validation/security:** At least one usable contact field; bound lengths; relation org validation.
- **Acceptance behavior:** Cross-org account association rejected.

**FR-017** · UC-102 · Actor: Sales user

- **System shall:** Warn on potential duplicate Account/Contact candidates within a tenant rather than silently merging.
- **Validation/security:** Candidate match rules configurable; avoid global email uniqueness claims.
- **Acceptance behavior:** No automatic cross-tenant merge or disclosure.

**FR-018** · UC-103 · Actor: Sales user

- **System shall:** Create a Deal linked to same-org Account/Contact, pipeline, stage, owner and optional Agent reference.
- **Validation/security:** Validated existing relation IDs; required deal title and state.
- **Acceptance behavior:** Foreign/cross-tenant reference rejected.

**FR-019** · UC-103 · Actor: Sales user

- **System shall:** Change deal stage only via authorized/valid transition and preserve activity history.
- **Validation/security:** Optimistic version check on concurrent edits.
- **Acceptance behavior:** Conflicting writes return conflict/reload signal, not lost update.

**FR-020** · UC-103 · Actor: Sales user

- **System shall:** Create, assign, reschedule and complete a task linked to authorized lead/account/deal.
- **Validation/security:** Owner must be active allowed member; dates valid; audit actor.
- **Acceptance behavior:** Unauthorized task assignment or completion rejected.

**FR-021** · UC-104 · Actor: Sales manager

- **System shall:** Filter deals/tasks by owner, stage, age and due status with team-scoped counts.
- **Validation/security:** Apply policy before aggregate/filter, not after.
- **Acceptance behavior:** Team lead totals reconcile to authorized underlying records.

**FR-022** · UC-104 · Actor: Sales manager

- **System shall:** Show individual workload without exposing a different team's restricted records.
- **Validation/security:** Teams/permissions from server-side membership.
- **Acceptance behavior:** No cross-team side-channel from totals.

**FR-023** · UC-105 · Actor: Authorized importer

- **System shall:** Accept only approved CSV column mappings and synthetically safe test datasets in sandbox.
- **Validation/security:** Strict allowlist, known limit, scan/quarantine before real upload workflow.
- **Acceptance behavior:** Forbidden column or cross-org relation causes safe abort; no hidden partial import.

**FR-024** · UC-105 · Actor: Authorized exporter

- **System shall:** Export only permitted tenant/record fields after authorization with auditable request and expiring link if file delivery used.
- **Validation/security:** PII/redacted fields policy; no unrestricted download path.
- **Acceptance behavior:** Another org's data never appears in a generated export.

**FR-025** · UC-106 · Actor: All users

- **System shall:** Provide consistent loading/empty/validation/error/forbidden/expired UI states across CRUD/list forms.
- **Validation/security:** Keyboard nav, accessible names, inline errors and focus placement.
- **Acceptance behavior:** Form failure does not silently drop unsaved user work.

**FR-026** · UC-106 · Actor: All users

- **System shall:** Prevent accidental duplicate submissions and represent server outcomes consistently in desktop/mobile clients.
- **Validation/security:** Disable/indicate pending; handle network timeout and conflict.
- **Acceptance behavior:** Retry does not unintentionally duplicate logical records.

### R2 — Merchant Operations

**FR-027** · UC-201 · Actor: Onboarding coordinator

- **System shall:** Create merchant organization record plus optional location and link to same-org CRM lead/account/deal and assigned Agent.
- **Validation/security:** Merchant name and tenant links validated; no raw KYC upload.
- **Acceptance behavior:** Merchant record tracks relationships without entering prohibited sensitive data.

**FR-028** · UC-201 · Actor: Agent manager

- **System shall:** Associate merchant with an internal Agent and retain assignment history after reassignment.
- **Validation/security:** Agent belongs to org and current operator authorized.
- **Acceptance behavior:** Former agent scope is revoked immediately after reassignment.

**FR-029** · UC-202 · Actor: Onboarding coordinator

- **System shall:** Open an internal merchant application, assign operations owner, stage and next permissible action.
- **Validation/security:** Unique opaque application ID; linked merchant required; no fabricated provider approval.
- **Acceptance behavior:** Application and initial stage history are atomic.

**FR-030** · UC-202 · Actor: Onboarding coordinator

- **System shall:** Create required next-action task and due date for a blocked/internal pending application.
- **Validation/security:** Task owner authorized, date sensible, text length bounded.
- **Acceptance behavior:** Owner/action visible with case; no orphan task.

**FR-031** · UC-203 · Actor: Onboarding operator

- **System shall:** View stalled queue filtering status, age, assigned owner and next action.
- **Validation/security:** Organization + record policy before filtering and counts.
- **Acceptance behavior:** Correct owner/internal stage/next action on seeded synthetic cases.

**FR-032** · UC-203 · Actor: Onboarding operator

- **System shall:** Show reason a case awaits further input and avoid claiming it is externally approved.
- **Validation/security:** Only internal state may be edited in internal UI.
- **Acceptance behavior:** Blocked case and external unknown state not visually conflated.

**FR-033** · UC-204 · Actor: Operations admin

- **System shall:** Define organization-specific internal stages and valid transitions in configurable schema.
- **Validation/security:** Reject invalid duplicate stage keys; changes versioned.
- **Acceptance behavior:** Unrecognized transitions return policy error and history unchanged.

**FR-034** · UC-204 · Actor: Authorized operator

- **System shall:** Apply a validated stage transition with transactionally consistent history and future outbox event.
- **Validation/security:** Actor authorized; current version matches expected; transition allowed.
- **Acceptance behavior:** Duplicate/retried transition does not duplicate history.

**FR-035** · UC-204 · Actor: Operations coordinator

- **System shall:** Maintain bounded non-sensitive application checklist status and timestamped actor trail.
- **Validation/security:** Checklist item key, completion actor and permitted category.
- **Acceptance behavior:** Checklist completion never changes external processor status.

**FR-036** · UC-205 · Actor: Agent manager

- **System shall:** Create/disable Agent and agent-to-merchant relationships with tenant boundaries.
- **Validation/security:** Do not accept external agent data without policy; prevent self-privilege.
- **Acceptance behavior:** Agent-scoped views cannot enumerate unrelated merchants.

**FR-037** · UC-205 · Actor: Security/operations

- **System shall:** Ensure agent reassignment and membership revocation invalidate old portfolio access and are audited.
- **Validation/security:** Re-evaluate authorization on each relevant access.
- **Acceptance behavior:** Old relation/history preserved but old access denied.

**FR-040** · UC-207 · Actor: Ops manager

- **System shall:** Provide tenant-scoped counts for awaiting info, internal review, pending external and activation follow-up.
- **Validation/security:** Counts derive from currently accessible rows; refresh semantics documented.
- **Acceptance behavior:** Dashboard matches authorized list filters.

**FR-041** · UC-207 · Actor: Ops manager

- **System shall:** Present date-range, owner and stage filters with consistent empty and unavailable states.
- **Validation/security:** Timezone and range semantics specified later; no cross-tenant rollup.
- **Acceptance behavior:** Invalid range rejected safely.

**FR-042** · UC-208 · Actor: QA

- **System shall:** Load approved fictional tenant data for two organizations and at least five distinct merchant cases.
- **Validation/security:** Only synthetic example.com records; no genuine provider credentials.
- **Acceptance behavior:** Stalled, declined and approved-not-active samples behave as expected.

**FR-043** · UC-208 · Actor: QA

- **System shall:** Run negative scenarios for cross-tenant read, denied stage changes and prohibited fields once code exists.
- **Validation/security:** Tests execute in CI against running services.
- **Acceptance behavior:** Zero unexpected access or secret logging in negative tests.

### R2 boundary / later authorized processor integration

**FR-038** · UC-206 · Actor: Approved integration service

- **System shall:** Maintain a separate external processor status reference with source, observedAt and verification state.
- **Validation/security:** No unverified callback may claim approved/boarded/active.
- **Acceptance behavior:** Internal 'approved' does not auto-enable charges or merchant activation.

**FR-039** · UC-206 · Actor: Approved integration service

- **System shall:** Reject unsigned, invalid, replayed or out-of-order external event updates in later connector.
- **Validation/security:** Require provider agreement and testable replay semantics.
- **Acceptance behavior:** A stale duplicate cannot overwrite verified newer state.

### Later specialist and full-suite products — excluded from the first release

**FR-044** · UC-301 · Actor: Approved provider

- **System shall:** Direct processor onboarding connector deferred until contracts, API rights and security design are authorized.
- **Validation/security:** No external provider secrets or webhook URLs in synthetic MVP.
- **Acceptance behavior:** Not marketed or exposed as live capability.

**FR-045** · UC-302 · Actor: Finance team

- **System shall:** Residual statement import, commission calculation and payouts deferred pending real sample formats, reconciliation and approval.
- **Validation/security:** No internal pseudo-payout flow presented as real.
- **Acceptance behavior:** No payout/finance endpoints in MVP.

**FR-046** · UC-303 · Actor: External agent

- **System shall:** Agent self-service portal deferred until external identity and record-scope review.
- **Validation/security:** Internal agent association is not portal login.
- **Acceptance behavior:** No unaudited external agent invitation.

**FR-047** · UC-304 · Actor: POS reseller

- **System shall:** Hardware, serial numbers, technician dispatch and terminal provisioning deferred.
- **Validation/security:** POS case tracking not presented as field-service execution.
- **Acceptance behavior:** No terminal provisioning in MVP.

**FR-048** · UC-305 · Actor: Processor/compliance

- **System shall:** Underwriting, full KYC/KYB and money movement deferred to separately scoped regulated systems.
- **Validation/security:** Raw regulated fields prohibited in generic CRM.
- **Acceptance behavior:** No fake compliance approval.

**FR-049** · UC-306 · Actor: Future suite buyer

- **System shall:** Future major Zoho-like app families each require their own PRD, permissions, entitlements and release acceptance.
- **Validation/security:** No claim all suite products are available.
- **Acceptance behavior:** Unreleased app remains disabled with honest roadmap state.


## 5. Proposed input constraints and relation rules (not yet DB/API schemas)

| Field / group | Initial rule proposal | Negative path |
|---|---|---|
| Organization display name | Trim; 2–120 visible characters; appropriate Unicode rules decided in P1.07 | Blank, controls and unsupported attributes rejected |
| Lead/deal title or account name | Trim; bounded length, required context-specific fields | Empty, too long, unauthorized owner |
| Email contact | Valid email format if supplied; canonicalization only with documented identity rules | Malformed email; duplicate warning without global uniqueness leakage |
| Phone / postal address | Optional, international normalized format when relevant | Invalid syntax; do not infer country or verify identity |
| IDs and relations | Server-generated opaque IDs; every referenced entity belongs to same verified organization | Cross-tenant reference rejects without existence disclosure |
| Pipeline/stage | Selected from allowed per-organization active set and permitted transition | Unknown or forbidden stage; version conflict |
| Task due date and assignment | Valid timestamp/timezone and authorized active owner | Revoked member or impossible range |
| Merchant application metadata | Merchant required, internal stage, authorized owner, next-action text bounded | Raw ID/bank/card field, invalid processor state, unsupported upload |
| Checklist item | Known non-sensitive allowed template/key and completion state | Direct external underwriter approval attempt |
| CSV import (future) | Approved column map, maximum file/row limits, quarantined safe workflow | Unknown prohibited column; oversized/malicious file |
| External status reference (later) | Verified provider mapping, source, timestamp, immutable correlation ID | Unverified/unsigned/out-of-order update rejected |

Do not specify hard production lengths for sensitive legal names/identifiers until P1.07 data glossary and jurisdiction review. **All numbers above are draft design defaults requiring P1.02 owner review and future product-specific refinements.**

## 6. Failure handling and response contracts to refine in P1.08

Proposed REST-friendly classes (not deployed routes): `400` malformed/unknown input, `401` no valid session, `403` unauthorized action, privacy-preserving `404` for inaccessible records when avoiding enumeration, `409` stale version/duplicate conflict, `422` rejected domain transition, `429` throttled, and `503` temporarily unavailable dependency.

Proposed error envelope: stable `error.code`, human-safe `error.message`, optional validated `fieldErrors`, `requestId` and retryable hint; **never** output private record data, stack traces, bank/card/identity content, provider secrets or raw body. Actual HTTP conventions, per-endpoint shape and error codes will be frozen in **P1.08**, not invented as live API documentation.

Key failure/recovery scenarios:
- **Session expired:** Hide protected resource; offer reauthentication and preserve safe unsent local form state, never cached secret content.
- **Membership revoked:** Server rejects next request; stale UI removes tenant data and prompts organization selection.
- **Reference race:** If agent/owner/deal removed between form load and save, reject as conflict/invalid relation; refresh rather than creating dangling records.
- **Offline/timeout:** Indicate uncertain save status; refresh canonical record before retrying create.
- **Duplicate submission:** Same idempotent business command resolves to same outcome; does not create second merchant app/task.
- **Transition conflict:** Show actual current stage/history, do not overwrite remote changes or claim action completed.
- **Invalid provider status:** Quarantine/reject unverified provider event without updating live external status; no logging of raw identity payload.
- **Import error:** Return row/column-safe error report, commit only per documented all-or-nothing or staged strategy (decision pending); no silent partial import.
- **Export forbidden:** Deny before query; no reusable public file link or leakage in dashboard counts.
- **Unexpected server exception:** Safe error ID and operator log with redaction; no partial stage change or exposed exception stack.

## 7. State/transition design is intentionally provisional

See [state-transition specification](srs-state-transitions.md) for stage diagram candidates, ownership rules and forbidden actions. **P0.05 customer process validation was waived (0/3)**, so any status enum remains editable during P1.07 and must not be frozen in a Prisma schema before user/research confirmation.

## 8. Future acceptance and traceability

- Every functional requirement links to an approved PRD use case (`UC-001` … `UC-306`) and a release.
- At least one acceptance scenario per major use case, positive or negative; security-sensitive areas must include explicit denial cases.
- Functional tests, integration tests and browser tests belong to implementation/QA phases; these documents alone **do not** mean tests passed.
- P1.09 will turn these into a full requirement-to-test traceability matrix with run evidence.

## 9. Open decisions / named later owners

| Unknown | Planned resolution | Status |
|---|---|---|
| Merchant application stages, actor handoffs, processor semantics | P1.07 domain glossary and real workflow interviews (#8), then P8 implementation | UNVALIDATED |
| Exact role matrix incl. agent/team visibility | P1.06 permission/share matrix and denial tests | OPEN |
| Retention, region, entity, contracts, provider data rights | Product owner plus qualified legal/security review | OPEN |
| Real billing provider and money collection | Owner commercial choice and future P6 integration | NOT AUTHORIZED |
| Seat count, usage-limit semantics and pricing | Future P6 with no public plans until buying research | NO VALIDATED PRICE |
| External agent portal and processor boarding APIs | Specialist later tracks + processor agreements | DEFERRED |
| HTTP endpoint schemas and event structures | P1.08 contract spec | OPEN |
| Accessibility/latency/reliability numbers | P1.03 NFR owner acceptance | OPEN |
| Real customer value hypothesis | Qualified operators and measured baseline, issue #8 | NO EVIDENCE |

## 10. P1.02 exit checklist

- [x] Functional requirements mapped to approved R0/R1/R2 PRD use cases.
- [x] Input and relation validation, permissions, tenant boundaries, errors and recovery paths documented.
- [x] Proposed internal case/CRM state machines and excluded external processor operations documented.
- [x] Acceptance scenario cases created for future automated tests, **not run**.
- [x] Deferred specialist/suite app functionality separated from the initial MVP.
- [ ] **Product owner reviews and approves P1.02 SRS and proposed validation/state rules.**
- [ ] After approval: mark P1.02 complete and open **P1.03 Nonfunctional SRS**.

**Current state:** P1.02 DRAFT READY FOR OWNER REVIEW. No application code, schemas, API implementation or tests have been created by this phase.
