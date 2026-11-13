# P1.04 — User Journeys and End-to-End Task Flows

**Version:** 1.0 — OWNER-APPROVED PROVISIONAL JOURNEY BASELINE (2026-11-13)
**Prepared:** 2026-11-13
**Phase:** P1.04 Personas and Journeys
**Issue:** https://github.com/owaisprog/Zoho-Clone/issues/17
**Inputs:** [Owner-approved PRD](prd.md), [Functional SRS](srs.md), [Nonfunctional SRS](nfr.md), [Persona definitions](personas.md).
**Evidence:** 18 synthetic journey narratives and 72 proposed steps; **0 real customer validation interviews**. These are assumptions for internal synthetic-data-only engineering, NOT real observed ISO/POS/PayFac workflows.

## 1. Shared journey model
Each journey specifies actor/persona, entry trigger, intent, handoff, intended successful end state, step-by-step interaction, system response and failure/exception response. Every step links to **PRD use cases (UC)** and **Functional SRS IDs (FR)**. The companion [journey-map.csv](journey-map.csv) contains machine-readable step details.

**Universal safeguards for every workflow:** server-verified organization context and record policy; reject prohibited raw card/bank/identity/KYC/secrets; accessible keyboard/focus/error states; audit critical privileged mutations; preserve safe state during recoverable errors; do not mistake internal tracking for processor underwriting/activation.

**Data source:** use only [synthetic fixture examples](prd-synthetic-fixtures.json) and fictional merchants, organizations and `example.com` emails. No actual processors, merchant financial records or sign-ins from external customers.

## 2. Journey summary

| Journey | Primary persona | Release | Desired outcome |
|---|---|---|---|
| J-01 Set up a new internal workspace | PER-02 | R0 | Owner can enter only their own new fictional organization |
| J-02 Invite, accept and revoke an internal colleague | PER-02 | R0 | Active colleague can access permitted records; revoked colleague cannot |
| J-03 Understand access, app entitlement and mock billing | PER-08 | R0 | Server denies locked feature, billing uses no card data |
| J-04 Create and qualify lead with contact/account | PER-03 | R1 | Valid lead/contact/account linked in proper org |
| J-05 Progress deal and request onboarding handoff | PER-03 | R1→R2 | Won deal hands off context, onboarding still independent |
| J-06 Review scoped sales pipeline and assignment | PER-04 | R1 | Aggregates reconcile to scoped records and overdue task owners |
| J-07 Import safe CSV and export authorized records | PER-09 | R1 | No prohibited fields or cross-tenant records leak |
| J-08 Recover from validation, offline and session errors | PER-03 | R1 | Safe inputs preserved and retries do not duplicate |
| J-09 Create merchant and associate internal agent | PER-07 | R2 | Correct same-org merchant/agent link with history |
| J-10 Open internal application and assign next action | PER-05 | R2 | Atomic application/history/task creation using fake data |
| J-11 Find and resolve a stalled onboarding application | PER-05 | R2 | The triad is correct for each authorized fictional case |
| J-12 Configure internal stages and correct bad transitions | PER-06 | R2 | Only allowed transitions with clean history |
| J-13 Reassign agent and immediately revoke old portfolio access | PER-07 | R2 | Former agent access denied; new assignment auditable |
| J-14 Separate external processor reference from internal approval | PER-06 | R2/LATER | Distinct unverified/verified status and activation states |
| J-15 Review application bottleneck report securely | PER-01 | R2 | Scoped counts match visible cases and unknown metrics labeled |
| J-16 Verify synthetic tenant and accessibility safety | PER-10 | R0-R2 | Future run produces actual evidence, not a presumed pass |
| J-17 Review audit and denied privileged access | PER-09 | R0-R2 | Denied action and time/source retrievable by an authorized reviewer |
| J-18 Tell external users which features are not yet available | PER-11 / PER-12 | LATER | Deferred products not accessible and hosted provider requirements clearly stated |

## 3. Detailed journeys (18)

### J-01 — Set up a new internal workspace

**Primary persona:** PER-02. **Release:** R0.  
**Trigger:** Authenticated prospective owner starts a demo organization.  
**User goal:** A scoped workspace with correct owner membership.  
**Expected completion:** Owner can enter only their own new fictional organization.  
**Handoff:** Organization owner → identity/membership service.

| Step | Actor/lane | Action | Required system response | Failure / recovery | Requirement trace |
|---|---|---|---|---|---|
| 1 | Owner | Opens create organization page | Safe required fields and accessible errors | Blank, overly long, or prohibited fields rejected | UC-001 / FR-001 |
| 2 | Owner | Submits synthetic org name Orchid Payments Demo | Server verifies identity and atomically creates organization + membership | Database failure rolls back both records | UC-001 / FR-001 |
| 3 | System | Displays newly created scoped workspace | Membership derived from server; organization switcher lists membership only | Never select a tenant solely from client orgId | UC-001 / FR-002 |
| 4 | Owner | Refreshes page / returns from sign-in | Session restores only verified eligible organization | Session expiry triggers reauthentication with no data leak | UC-001 / FR-002 |

**Journey status:** Research-grounded hypothesis; not an observed interaction or a deployed product flow.

### J-02 — Invite, accept and revoke an internal colleague

**Primary persona:** PER-02. **Release:** R0.  
**Trigger:** Admin needs onboarding coordinator access.  
**User goal:** Correct minimum role, invitation lifecycle and immediate removal.  
**Expected completion:** Active colleague can access permitted records; revoked colleague cannot.  
**Handoff:** Org admin → verified identity → onboarded employee.

| Step | Actor/lane | Action | Required system response | Failure / recovery | Requirement trace |
|---|---|---|---|---|---|
| 1 | Admin | Opens members and invites ops@example.com | Invitation limited to permitted roles for current org | Unauthorized admin/unsupported role denied | UC-002 / FR-003 |
| 2 | Invitee | Accepts permitted unexpired invite with matching verified identity | Active membership created atomically | Expired/revoked invite refused | UC-002 / FR-003 |
| 3 | Admin | Changes colleague role and later revokes membership | Policy re-evaluated and audit event written | No last-owner removal or self-elevation | UC-002 / FR-004 |
| 4 | Former member | Tries old URL and API with cached UI | Protected resources are denied on server | No previously opened tenant data reused by client | UC-003 / FR-005 |

**Journey status:** Research-grounded hypothesis; not an observed interaction or a deployed product flow.

### J-03 — Understand access, app entitlement and mock billing

**Primary persona:** PER-08. **Release:** R0.  
**Trigger:** Billing admin checks whether organization can use MerchantOps.  
**User goal:** Understand current allowed apps and limits safely.  
**Expected completion:** Server denies locked feature, billing uses no card data.  
**Handoff:** Billing admin → entitlement service; hosted provider only after authorization.

| Step | Actor/lane | Action | Required system response | Failure / recovery | Requirement trace |
|---|---|---|---|---|---|
| 1 | Billing admin | Opens subscription and entitlement page | Sees authorized organization plan and app grant | Nonbilling member cannot access sensitive billing controls | UC-004 / FR-007 |
| 2 | Billing admin | Clicks unavailable module | Sees truthful locked/not-yet-built state | Direct protected API still denied | UC-004 / FR-008 |
| 3 | Billing admin | Reviews mock hosted billing preview | Page explains provider-hosted collection is future only | Raw PAN/CVV form is never offered | UC-006 / FR-010 |
| 4 | System | Receives simulated unsigned callback | No subscription/entitlement upgraded | Duplicate or forged callback cannot change access | UC-006 / FR-011 |

**Journey status:** Research-grounded hypothesis; not an observed interaction or a deployed product flow.

### J-04 — Create and qualify lead with contact/account

**Primary persona:** PER-03. **Release:** R1.  
**Trigger:** Sales rep receives fictitious inbound lead.  
**User goal:** Save contact context without prohibited information.  
**Expected completion:** Valid lead/contact/account linked in proper org.  
**Handoff:** Sales rep → sales manager if qualification requires review.

| Step | Actor/lane | Action | Required system response | Failure / recovery | Requirement trace |
|---|---|---|---|---|---|
| 1 | Sales rep | Starts new lead form | Validation, required field and keyboard focus visible | Unknown bank/card/ID fields rejected | UC-101 / FR-012 |
| 2 | Sales rep | Enters fake River Retail and email at example.com | Creates org-scoped lead | Network timeout shows uncertain outcome, not false success | UC-101 / FR-012 |
| 3 | Sales rep | Links approved fictional contact/account | Server verifies same org and record policy | Juniper account ID rejected for Orchid lead | UC-102 / FR-016 |
| 4 | Sales rep | Qualifies lead via configured stage | Authorized stage and history saved | Unknown or forbidden stage rejected | UC-101 / FR-014 |

**Journey status:** Research-grounded hypothesis; not an observed interaction or a deployed product flow.

### J-05 — Progress deal and request onboarding handoff

**Primary persona:** PER-03. **Release:** R1→R2.  
**Trigger:** Qualified merchant lead reaches deal stage.  
**User goal:** Link deal, tasks and accountable next team without implying processor approval.  
**Expected completion:** Won deal hands off context, onboarding still independent.  
**Handoff:** Sales representative → onboarding coordinator.

| Step | Actor/lane | Action | Required system response | Failure / recovery | Requirement trace |
|---|---|---|---|---|---|
| 1 | Sales rep | Creates synthetic deal from qualified account | Allowed same-org associations and assigned owner recorded | Foreign agent/account relation rejected | UC-103 / FR-018 |
| 2 | Sales rep | Moves deal to proposal then won | Stage history/audit written with version check | Concurrent stale save returns 409 and requests reload | UC-103 / FR-019 |
| 3 | Sales rep | Creates onboarding follow-up task | Next internal owner and due date assigned | Inactive assignee or unauthorized task denied | UC-103 / FR-020 |
| 4 | Onboarding coordinator | Receives internal handoff case preview | May create separate application draft after policy checks | Won deal never becomes approved/boarded/active merchant | UC-201 / FR-027 |

**Journey status:** Research-grounded hypothesis; not an observed interaction or a deployed product flow.

### J-06 — Review scoped sales pipeline and assignment

**Primary persona:** PER-04. **Release:** R1.  
**Trigger:** Sales manager conducts weekly pipeline review.  
**User goal:** Find permitted overdue deals without exposing other teams.  
**Expected completion:** Aggregates reconcile to scoped records and overdue task owners.  
**Handoff:** Sales manager → responsible sales representative.

| Step | Actor/lane | Action | Required system response | Failure / recovery | Requirement trace |
|---|---|---|---|---|---|
| 1 | Manager | Filters deals by stage, owner and due date | List sorted and bounded with access policy before aggregation | Unbounded query rejected or paginated | UC-104 / FR-021 |
| 2 | Manager | Opens a delayed deal | Allowed current stage, owner and tasks shown | Unrelated team detail remains hidden | UC-104 / FR-022 |
| 3 | Manager | Requests cross-team rollup without grant | Server denies or excludes outside-team figures | No count side-channel for restricted team | UC-104 / FR-022 |
| 4 | Manager | Assigns follow-up to authorized rep | Task change audited, owner notified later if feature exists | Revoked rep cannot be assigned | UC-103 / FR-020 |

**Journey status:** Research-grounded hypothesis; not an observed interaction or a deployed product flow.

### J-07 — Import safe CSV and export authorized records

**Primary persona:** PER-09. **Release:** R1.  
**Trigger:** Authorized tenant admin wants to migrate fake data.  
**User goal:** Import only safe allowlisted columns and export only visible rows.  
**Expected completion:** No prohibited fields or cross-tenant records leak.  
**Handoff:** Ops administrator → import worker → reviewer.

| Step | Actor/lane | Action | Required system response | Failure / recovery | Requirement trace |
|---|---|---|---|---|---|
| 1 | Admin | Maps synthetic CSV column headers | Only approved lead/contact fields allowed | bankAccountNumber and identity doc columns rejected | UC-105 / FR-023 |
| 2 | System | Validates safe staging and relation ownership | Import proceeds only per approved atomic/staged policy | Bad row or scanner outage handled without silent partial import | UC-105 / FR-023 |
| 3 | Admin | Requests export of their permitted deals | Server checks role/record/tenant and audits action | Other tenant and restricted finance fields omitted | UC-105 / FR-024 |
| 4 | Admin | Opens expiring export link (future) | Scoped file served only until expiry | Old signed link expires and cannot bypass policy | UC-105 / FR-024 |

**Journey status:** Research-grounded hypothesis; not an observed interaction or a deployed product flow.

### J-08 — Recover from validation, offline and session errors

**Primary persona:** PER-03. **Release:** R1.  
**Trigger:** Rep edits form on mobile/keyboard and a request fails.  
**User goal:** Understand error and avoid duplicate or lost records.  
**Expected completion:** Safe inputs preserved and retries do not duplicate.  
**Handoff:** User → frontend state → backend validation/error response.

| Step | Actor/lane | Action | Required system response | Failure / recovery | Requirement trace |
|---|---|---|---|---|---|
| 1 | Sales rep | Uses keyboard-only lead form | Controls, focus and required messages accessible | No keyboard trap or color-only instructions | UC-106 / FR-025 |
| 2 | Sales rep | Submits missing/invalid data | Linked field errors and safe input retention displayed | No backend mutation on validation failure | UC-106 / FR-025 |
| 3 | Network | Drops response after create | Client reports uncertain save state and loads canonical result | No success toast without confirmed response | UC-106 / FR-026 |
| 4 | Sales rep | Retries after checking saved record | Logical duplicate prevented by idempotent command | Expired session reauthentication, no leaked tenant records | UC-106 / FR-026 |

**Journey status:** Research-grounded hypothesis; not an observed interaction or a deployed product flow.

### J-09 — Create merchant and associate internal agent

**Primary persona:** PER-07. **Release:** R2.  
**Trigger:** Won deal requires merchant and agent association.  
**User goal:** Keep merchant relationships accurate and scoped.  
**Expected completion:** Correct same-org merchant/agent link with history.  
**Handoff:** Sales representative → agent manager → onboarding coordinator.

| Step | Actor/lane | Action | Required system response | Failure / recovery | Requirement trace |
|---|---|---|---|---|---|
| 1 | Agent manager | Finds the qualified fake sales Account | Only own-tenant account candidates visible | Other-tenant account IDs not enumerated | UC-201 / FR-027 |
| 2 | Agent manager | Creates merchant/location record | Server validates owner org and linked CRM relation | No raw bank, KYC or card data stored | UC-201 / FR-027 |
| 3 | Agent manager | Links approved internal Agent | Tenant- and record-scoped assignment history recorded | Agent outside organization denied | UC-205 / FR-028 |
| 4 | Coordinator | Views merchant detail | Sees agent, allowed safe merchant metadata and case queue | Internal agent record does not create external agent login | UC-205 / FR-036 |

**Journey status:** Research-grounded hypothesis; not an observed interaction or a deployed product flow.

### J-10 — Open internal application and assign next action

**Primary persona:** PER-05. **Release:** R2.  
**Trigger:** Onboarding receives merchant context from sales.  
**User goal:** Create a case with clear stage, owner and task.  
**Expected completion:** Atomic application/history/task creation using fake data.  
**Handoff:** Sales → onboarding coordinator → assigned teammate.

| Step | Actor/lane | Action | Required system response | Failure / recovery | Requirement trace |
|---|---|---|---|---|---|
| 1 | Coordinator | Opens new merchant application | Application belongs to selected verified org and merchant | Cross-org merchant/agent relationship denied | UC-202 / FR-029 |
| 2 | Coordinator | Chooses internal stage draft and assigned member | Allowed membership and stage validated | Inactive assignee rejected | UC-202 / FR-029 |
| 3 | Coordinator | Sets next action and due date | Task and internal stage history persisted consistently | Transaction failure rolls back case/task state | UC-202 / FR-030 |
| 4 | Coordinator | Refreshes application detail | Owner/status/task visible, external state marked unknown | No false processor approval or fake provider payload | UC-202 / FR-030 |

**Journey status:** Research-grounded hypothesis; not an observed interaction or a deployed product flow.

### J-11 — Find and resolve a stalled onboarding application

**Primary persona:** PER-05. **Release:** R2.  
**Trigger:** Operations queue contains a synthetic pending-more-info case.  
**User goal:** Correctly identify current owner, internal status and next action.  
**Expected completion:** The triad is correct for each authorized fictional case.  
**Handoff:** Onboarding coordinator → responsible teammate → ops manager if escalated.

| Step | Actor/lane | Action | Required system response | Failure / recovery | Requirement trace |
|---|---|---|---|---|---|
| 1 | Coordinator | Opens stalled applications queue | Filters by pending stage/age/owner, limited to policy scope | Restricted count and other-org cases never revealed | UC-203 / FR-031 |
| 2 | Coordinator | Opens synthetic APP-DEMO-002 | Shows assigned owner, pending_more_info and safe missing checklist task | Processor state not inferred from internal checklist | UC-203 / FR-032 |
| 3 | Coordinator | Completes permitted follow-up | Task/history and stage update checked; no raw documents accepted | Stale version shows conflict, not silent overwrite | UC-204 / FR-034 |
| 4 | Manager | Reviews updated queue aging metrics | Counts and task owner reconcile to permitted cases | If reporting unavailable, show error not made-up fresh count | UC-207 / FR-040 |

**Journey status:** Research-grounded hypothesis; not an observed interaction or a deployed product flow.

### J-12 — Configure internal stages and correct bad transitions

**Primary persona:** PER-06. **Release:** R2.  
**Trigger:** Ops manager changes a tenant's internal checklist/stages.  
**User goal:** Prevent invalid or conflicting workflow changes.  
**Expected completion:** Only allowed transitions with clean history.  
**Handoff:** Ops manager → onboarding coordinator.

| Step | Actor/lane | Action | Required system response | Failure / recovery | Requirement trace |
|---|---|---|---|---|---|
| 1 | Ops manager | Views internal stage settings | Lists organization-specific stage keys/allowed transitions | Unauthorized role cannot edit | UC-204 / FR-033 |
| 2 | Ops manager | Attempts duplicate stage key | Validation rejects duplicates and version conflicts | Existing stage set unchanged | UC-204 / FR-033 |
| 3 | Coordinator | Attempts invalid transition for fake merchant case | Safe domain error; old stage and history remain intact | No unreviewed jump from draft to active | UC-204 / FR-034 |
| 4 | Coordinator | Checks off safe intake item | Allowed checklist completion recorded | Completing checklist cannot set processor-approved status | UC-204 / FR-035 |

**Journey status:** Research-grounded hypothesis; not an observed interaction or a deployed product flow.

### J-13 — Reassign agent and immediately revoke old portfolio access

**Primary persona:** PER-07. **Release:** R2.  
**Trigger:** Agent ownership dispute resolved by authorized manager.  
**User goal:** Protect history and stop former agent visibility.  
**Expected completion:** Former agent access denied; new assignment auditable.  
**Handoff:** Agent manager → security policy → onboarding team.

| Step | Actor/lane | Action | Required system response | Failure / recovery | Requirement trace |
|---|---|---|---|---|---|
| 1 | Agent manager | Reviews internal agent assignments | Server displays only visible permitted merchant relationships | No other tenant or agent hidden portfolio | UC-205 / FR-036 |
| 2 | Agent manager | Moves merchant to another authorized internal agent | History and authorization relation updated atomically | Stale version or forbidden assignee rejected | UC-205 / FR-037 |
| 3 | Former agent | Attempts access using cached merchant URL | Denied on next request; UI clears unauthorized context | No stale cached data reuse | UC-205 / FR-037 |
| 4 | Reviewer | Inspects safe assignment audit event | Previous/new assignment actor/time visible to authorized reviewer | No raw merchant finance/identity file surfaced | UC-005 / FR-009 |

**Journey status:** Research-grounded hypothesis; not an observed interaction or a deployed product flow.

### J-14 — Separate external processor reference from internal approval

**Primary persona:** PER-06. **Release:** R2/LATER.  
**Trigger:** Synthetic case says approved externally but terminal not activated.  
**User goal:** Avoid a false live/processing conclusion.  
**Expected completion:** Distinct unverified/verified status and activation states.  
**Handoff:** Internal operations → external provider only after approved integration.

| Step | Actor/lane | Action | Required system response | Failure / recovery | Requirement trace |
|---|---|---|---|---|---|
| 1 | Ops manager | Opens fictional approved-not-active case | Internal stage and external proof/reference explicitly distinct | DEMO_ONLY status marked synthetic, not actual processor response | UC-206 / FR-038 |
| 2 | Coordinator | Attempts to mark processor approved manually | External provider field readonly/denied without verified authority | No manual checkbox can enable processing | UC-206 / FR-038 |
| 3 | Test integration | Sends fake invalid or old event | No external state regression; event safely rejected/quarantined | Unsigned or repeated callback cannot cause activation | UC-206 / FR-039 |
| 4 | Ops manager | Routes activation follow-up as internal task | Owner and next action recorded without claim of merchant being live | No charges/payout status inferred | UC-202 / FR-030 |

**Journey status:** Research-grounded hypothesis; not an observed interaction or a deployed product flow.

### J-15 — Review application bottleneck report securely

**Primary persona:** PER-01. **Release:** R2.  
**Trigger:** COO needs an ISO team's pending workload summary.  
**User goal:** Prioritize internally blocked cases without leaking restricted records.  
**Expected completion:** Scoped counts match visible cases and unknown metrics labeled.  
**Handoff:** COO → operations manager.

| Step | Actor/lane | Action | Required system response | Failure / recovery | Requirement trace |
|---|---|---|---|---|---|
| 1 | COO | Opens operations dashboard | Authorized pending and aging filters loaded | Entitlement denied if module not granted | UC-207 / FR-040 |
| 2 | COO | Selects team and range | Aggregates filtered before result, no other-org counts | Invalid date range rejected | UC-207 / FR-041 |
| 3 | COO | Opens oldest stalled case | Allowed owner/status/next action displayed | Unauthorized merchant detail concealed | UC-203 / FR-031 |
| 4 | COO | Requests follow-up from responsible manager | Task/escalation uses approved internal process | Does not imply automatic underwriting or payments | UC-207 / FR-040 |

**Journey status:** Research-grounded hypothesis; not an observed interaction or a deployed product flow.

### J-16 — Verify synthetic tenant and accessibility safety

**Primary persona:** PER-10. **Release:** R0-R2.  
**Trigger:** QA reviews release candidate in future staging.  
**User goal:** Demonstrate tenant isolation and safe user experience with fake data.  
**Expected completion:** Future run produces actual evidence, not a presumed pass.  
**Handoff:** QA → engineering/security reviewer → product owner.

| Step | Actor/lane | Action | Required system response | Failure / recovery | Requirement trace |
|---|---|---|---|---|---|
| 1 | QA | Loads Orchid and Juniper fictional organizations | Two separated tenant fixtures and five merchant cases prepared | No real contacts, IDs, bank/card or processor secrets | UC-208 / FR-042 |
| 2 | QA | Attempts Orchid access to Juniper merchant and reports | Protected endpoints reject foreign references/counts | Failure blocks external release; must be fixed | UC-003 / FR-005 |
| 3 | QA | Runs synthetic forbidden-field and duplicate event tests | Fields rejected, events handled safely when implemented | No false successful test claim while code absent | UC-208 / FR-043 |
| 4 | QA | Runs keyboard/screen-reader and mobile error checks | WCAG AA design target evaluated with actual run evidence | Failures logged; no unsupported accessibility certification | UC-106 / FR-025 |

**Journey status:** Research-grounded hypothesis; not an observed interaction or a deployed product flow.

### J-17 — Review audit and denied privileged access

**Primary persona:** PER-09. **Release:** R0-R2.  
**Trigger:** Security reviewer examines a mock unauthorized attempt.  
**User goal:** Find safe actionable evidence while preserving privacy.  
**Expected completion:** Denied action and time/source retrievable by an authorized reviewer.  
**Handoff:** Security reviewer → incident owner (future).

| Step | Actor/lane | Action | Required system response | Failure / recovery | Requirement trace |
|---|---|---|---|---|---|
| 1 | Reviewer | Selects own-org audit report | Policy returns only allowed event metadata | Non-reviewer access denied | UC-005 / FR-009 |
| 2 | Mock platform support | Tries direct merchant record without tenant grant | Server denies even if support title says privileged | No implicit platform support impersonation | UC-003 / FR-006 |
| 3 | Reviewer | Examines synthetic denied event | Actor, action, timestamp, outcome, safe target ref present | No secret, raw body or ID/bank/card values logged | UC-005 / FR-009 |
| 4 | Reviewer | Escalates high-risk test defect | Release blocker recorded for later P12 verification | No external pilot opened from checklist alone | UC-208 / FR-043 |

**Journey status:** Research-grounded hypothesis; not an observed interaction or a deployed product flow.

### J-18 — Tell external users which features are not yet available

**Primary persona:** PER-11 / PER-12. **Release:** LATER.  
**Trigger:** External agent or merchant asks to log in / submit verification.  
**User goal:** Avoid false promises and unsafe self-service before separate approval.  
**Expected completion:** Deferred products not accessible and hosted provider requirements clearly stated.  
**Handoff:** Future partner sales team → scope/legal/security gate.

| Step | Actor/lane | Action | Required system response | Failure / recovery | Requirement trace |
|---|---|---|---|---|---|
| 1 | External agent | Requests a reseller self-service portal | Product identifies future-only state; no account created automatically | Internal Agent record is not an external login | UC-303 / FR-046 |
| 2 | Merchant | Requests processor underwriting or KYC upload | No ordinary CRM upload or direct approval feature offered | Raw verification, bank/card and IDs never captured | UC-301 / UC-305 / FR-044 / FR-048 |
| 3 | POS reseller | Asks for terminal fulfillment and residual payouts | Explains separate future hardware and finance tracks | No device shipping, payout or money movement implied | UC-302 / UC-304 / FR-045 / FR-047 |
| 4 | Platform buyer | Requests full suite product parity | Shows future roadmap versus active application entitlements honestly | Unbuilt apps remain disabled, no false claims | UC-306 / FR-049 |

**Journey status:** Research-grounded hypothesis; not an observed interaction or a deployed product flow.


## 4. Cross-journey design and acceptance observations

### R0 — Organization and permissions
- A user must not accidentally browse another tenant after switching orgs, expiring a session or losing membership.
- Billing-admin entitlement UI may show **mock** payment context, but not a live hosted provider flow without owner/partner authorization.
- Administrative deletion/revocation needs confirmation, correct audit and safe handling of last-owner cases.

### R1 — Sales CRM
- Lead, contact and deal transitions must be reversible only where tenant policy allows and must never silently merge unrelated customer data.
- Form errors preserve permitted inputs, show clear keyboard-accessible guidance and do not falsely display "saved".
- Import/export is not assumed to be available until upload scanning, allowlist, privacy and per-record security controls are implemented and tested.

### R2 — Merchant operations
- Success is clear **internal owner / stage / next action**, not an invented processor approval.
- Potential state terms remain provisional because P0.05's three real workflows were NOT verified; later P1.07 and P8 must keep stage models adaptable.
- Former agents must lose record access after reassignment even while history stays auditable.
- All bottleneck counts and filtered reports must be tenant- and record-scoped.

### Deferred external products
- Direct underwriting, KYC, settlement/bank, residual payouts, external agent portal, native POS deployment and full application suite are not MVP capabilities and must not show functional actions in production/development UI.
- A public-facing name, real prices and processor integration authorization are unresolved; no marketing or real customers are authorized in this design pass.

## 5. Handoff into upcoming requirements/design phases
- **P1.05 Feature Hierarchy:** Organize R0/R1/R2 features by journeys and flag must/should/deferred.
- **P1.06 Permission Matrix:** Formalize actor-to-record/field/tenant authority for every branch and denial.
- **P1.07 Domain Glossary:** Validate synthetic record fields, stage terms and expected data associations.
- **P1.08 API Contracts:** Define request/response events for handoff, error, retry, audit and state changes.
- **P1.09 Acceptance Matrix:** Map all journey steps and scenarios into real future tests and record results, never invented passes.
- **P2 UX:** Wireframe primary and accessible alternate/error journeys for desktop/mobile.
- **P3 onward:** Build/test runnable software only when implementation sub-phases start.

## 6. Evidence status / owner acceptance

- [x] 18 journeys and 72 synthetic steps documented.
- [x] All 26 approved P1.01 use cases have at least one journey reference (some deferred as explicit non-availability paths).
- [x] Handoffs, unsafe data collection, role denial, session expiration, processor-boundary and recovery paths covered.
- [x] [Synthetic future acceptance cases](journey-acceptance-cases.csv) prepared; none run.
- [x] Product owner approved chosen personas, journey priorities and limits **as provisional planning assumptions** on 2026-11-13.
- [ ] Actual qualified ISO/POS/PayFac research remains an unresolved independent task in issue #8.
- [x] P1.04 closed after owner approval; P1.05 Feature Hierarchy and Release Gates opened as issue #18.

**P1.04 status: COMPLETE AS A PROVISIONAL PLANNING BASELINE.** Not a completed UX implementation or customer-validated research report.
