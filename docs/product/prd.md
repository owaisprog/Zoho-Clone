# P1.01 — Master Product Requirements Document (PRD)

**Project:** Zoho Clone — internal code name only; public brand TBD  
**Version:** 1.0 — OWNER-APPROVED P1.01 RELEASE BASELINE (2026-11-13)  
**Prepared:** 2026-11-13  
**Roadmap:** P1 Requirements, Specifications and Acceptance Contracts → **P1.01 Master PRD**  
**Tracking:** https://github.com/owaisprog/Zoho-Clone/issues/14  
**Approval:** Product owner explicitly approved P1.01 Master PRD, its R0 Shared Platform / R1 Sales CRM / R2 Merchant Operations order, and the scoped/deferred feature boundaries in project conversation on 2026-11-13. This is an **internal synthetic-only requirements baseline**, not commercial validation or external software release.

## 1. Decision and evidence context

The owner approved the P0.10 **conditional internal GO**, explicitly waiving unfinished P0.07 value-proposition testing, P0.08 five-buyer price interviews and P0.09 two design-partner commitments **for sequencing only**. P0.05's three-customer-workflow gate was previously waived; its real-world validation remains **0/3**.

**Verified market evidence:** 0 completed customer interviews; 0 measured value comparisons; 0/5 pricing-buyer interviews; 0/2 committed design partners; 0/3 actual merchant workflows independently validated. **Unvalidated research remains tracked in issue #8.**

The P0 conditional GO **does not** authorize a live customer pilot, regulated data handling, live processor integrations, accepting payments or public commercial launch. This PRD is a *requirements baseline for internal engineering*, not evidence of product-market fit.

## 2. Vision and product strategy

Build an **original, independent, multi-tenant SaaS Business OS** covering the breadth of the Zoho-like application categories in the long-term master roadmap. Start with a bounded, useful **Merchant Operations CRM** for independent ISOs and merchant-services companies, then reuse common platform capabilities across later applications.

The eventual suite may cover CRM, marketing, sales, help desk, projects, collaboration, finance, HR, commerce/POS, documents/eSign, analytics, automation, developer/low-code, IT/operations and sector-specific products. Each planned application remains an **independent later release track**. Neither identical feature parity with Zoho nor an existing/live suite is claimed.

### First product thesis (not validated)
“When an application stalls, operations personnel need to identify its internal owner, current stage and next action without searching multiple systems.”

**Proposed measurable outcome:** median seconds for an authorized user to correctly identify owner + internal stage + next action for a stalled synthetic merchant application; **target** >=30% reduction compared with a *measured* baseline in a future fair prototype study, with zero critical status/ownership errors. This is **not a measured benefit or marketing claim**.

## 3. Target customers and personas

| Priority | Customer / role | Problems / jobs | Release |
| --- | --- | --- | --- |
| 1 | **Independent ISO / merchant-services company** | Lead/agent/merchant onboarding, ownership and follow-up visibility | First focused MVP |
| 1 | CEO, COO, VP Operations (**economic buyer**) | Team accountability, workload and bottleneck visibility | MVP dashboard / reports |
| 1 | Onboarding manager (**champion**) | Assign and resolve delayed merchant-application tasks | MVP |
| 1 | Sales rep / agent manager (**operator**) | Move qualified lead to onboarding; track assigned agent | MVP |
| 2 | POS reseller/provider | Merchant + equipment deployment handoff | Core CRM initially; hardware module later |
| 3 | PayFac / embedded payments business | Submerchant onboarding coordination | Later specialist product after security/contracts |
| Deferred | General SMBs, agencies, enterprises | Broad suite | Subsequent product tracks |

**Direct SaaS customer and payer:** The ISO/POS/payment company, **not** the end merchant buying a POS or processing account.

## 4. Scope by release / required user use cases

### R0 — Shared SaaS platform foundation (roadmap P4, P6)
- **UC-001** Organization owner can create or join one organization, select active workspace and see tenant identity.
- **UC-002** Organization admin invites internal teammates, assigns approved roles and revokes access.
- **UC-003** Memberships, record ownership, RBAC and record-level ABAC restrict every read/write/export. Platform support has no automatic blanket tenant-data access.
- **UC-004** Organization can see granted applications/plan limits; the backend enforces entitlements.
- **UC-005** Important changes create auditable records free of raw secrets. API failures include correct forbidden/unauthorized/expired/quota states.
- **UC-006** Owner can manage a subscription via a **hosted** authorized provider only when chosen; no card details stored by CRM.

### R1 — First sales CRM (roadmap P5)
- **UC-101** Staff can create/list/search/update leads and move leads through a configurable sales pipeline.
- **UC-102** Authorized members manage contacts and company accounts; distinguish a business account from a merchant processing application.
- **UC-103** Reps can create deals, associate contacts/accounts/agent, assign next task and see activity history.
- **UC-104** Sales manager can filter work by owner, stage, age, and relevant team; no cross-tenant access.
- **UC-105** Authorized import/export applies allowlisted columns, permissions, sanitation and audit; exports include only accessible records.
- **UC-106** List, detail, create, edit, empty, error, loading, forbidden, mobile and keyboard states are testable.

### R2 — Initial Merchant Operations CRM (roadmap P8 with P7 support)
- **UC-201** Onboarding coordinator links an existing or new merchant to organization, location(s), agent and CRM lead/deal.
- **UC-202** Coordinator creates a merchant **internal tracking** application, assigns responsible teammate, sets internal stage and due/next action.
- **UC-203** Authorized staff can see a stalled queue, open an application and correctly identify owner, internal status and next pending task.
- **UC-204** Admin defines allowable internal stage transitions/checklists; invalid moves fail and every approved move is auditable.
- **UC-205** Agent/reseller relationships preserve reassignment history; an agent never automatically gains unauthorized records.
- **UC-206** External processor statuses—if later contractually available—are recorded in **separate verified-source fields** and never equated with a staff checkbox, MID existence or activation.
- **UC-207** Team dashboard shows organization-scoped pending counts, aging, tasks and bottlenecks; displayed numbers reconcile to filtered records.
- **UC-208** MVP demonstrates at least five synthetic merchant applications and at least two exception paths (missing info and approved-but-not-activated).

### R3 — After validated evidence / specialist features (NOT MVP commitments)
- Agent and merchant self-service portals, workflow automation, processor connectors, reconciled residual imports, commissions, payouts, native POS inventory/field deployment, underwriting/KYC/KYB, advanced AI, white labeling.
- Each requires an owner-approved separate requirements gate, legal/security review and actual feature proof.
- Other Zoho-like suite applications are built in their individual **later product-track phases**, not all in R0–R2.

For the full use-case/release map, see [P1.01 release requirements CSV](prd-release-matrix.csv).

## 5. Proposed essential UX/screens

| Screen/route concept | Primary user | Required states | Proposed release |
| --- | --- | --- | --- |
| Auth, recovery and organization selector | Members | pending, invalid, expired, unauthorized | R0 |
| Organization members/roles | Org admin | invite, revoke, forbidden, empty | R0 |
| Application catalog and billing/entitlements | Owner/admin | eligible, locked, loading, failed | R0 |
| CRM lead/contact/account/deal lists and details | Reps/managers | table, filter, pagination, edit, validation | R1 |
| Deal board/activity and task inbox | Sales/onboarding | drag/change, forbidden, conflict, empty | R1 |
| Agent directory and merchant records | Agent manager/onboarding | list/detail, assignment, no access | R2 |
| Application list, detail, checklist, history | Onboarding team | new, pending, blocked, stale, refused | R2 |
| Stalled applications/bottleneck overview | COO/ops manager | counts, filters, permission-limited data | R2 |
| Settings/audit | Admin/security roles | entitlements, export and denial | R0–R2 |

Final routes, component behavior and responsive/a11y designs require P2 specifications; these are not implemented UI claims.

## 6. Data domains (conceptual, not a migration)

- **Platform:** User/identity reference, Organization, Membership, Role, Permission, RoleGrant, AppGrant, Plan, Subscription, Entitlement, UsageCounter, AuditEvent.
- **Sales:** Lead, Contact, Account, Deal, Pipeline, Stage, Task, Activity.
- **Merchant operations:** Agent, AgentAssignment, Merchant, MerchantLocation, MerchantApplication, ApplicationStageHistory, ChecklistItem, ExternalStatusReference.
- **Integration/future:** OutboxEvent, WebhookDelivery/Inbox, SecretReference (never plaintext secret), FileReference only for approved future private-file system.

Each tenant-specific business record must carry an organization/tenant boundary and enforce authorization on read, search, edit, relation lookup, export, background job and aggregate report. Avoid a globally readable merchant lookup. Security/retention and final schema decisions belong to P1.02/P1.06/P1.07/P3/P4.

**Important unvalidated domain facts:** Application stages, processor semantics, MID field shape and agent hierarchy rules are derived from hypothetical P0.05 workflows; real customer proof remains open. Treat the domain as changeable.

## 7. MVP prohibitions and data handling

The owner approved five classification labels—**PUBLIC, INTERNAL, CONFIDENTIAL, RESTRICTED, SPECIAL_REGULATED**—as *design requirements* in P0.06.

The first CRM must **not collect or store raw** card/PAN/CVV/PIN/track data, full bank account or routing details, identity and KYC/KYB verification documents, private provider credentials, or full underwriting bundles in normal CRM records, attachments, logs, imports or AI prompts. Use an approved third-party hosted workflow and minimal authorized opaque references if required.

No free-form merchant document-upload product until specific file purposes, scanning, private object storage, access grants, deletion and legal obligations pass independent review. No production data is permitted during P1/P2/P3 internal prototyping.

Source requirements: [data classification](data_classification.md), [prohibited fields](prohibited-fields.md), [file handling](file-handling-policy.md), [P0.06 security review](p0-06-security-review.md).

## 8. Security and nonfunctional requirements (to specify precisely in P1.03)

- Managed identity/OIDC with safe server-side token/session handling; support multiple organizations securely.
- Organization isolation, server-side RBAC + record ABAC, audited privileged reads, scoped export/report access.
- Input schema validation with unknown-field rejection, secret/regulated field minimization and safe errors.
- PostgreSQL integrity constraints and tenant-safe transactions; RLS only with proven query/role/transaction design.
- Strict request/error/event log redaction, idempotent actions and replay-safe provider event handling when introduced.
- WCAG/accessibility and responsive UX targets, API response/performance budgets, backups, recovery goals and observability to be specified in P1.03.
- Versioned REST/OpenAPI; integration credentials owned by a managed secret system; never write keys to repo or example fixtures.
- No false “PCI compliant,” “GDPR certified,” “SOC 2,” “integrated with NMI/Clover/Stripe” claims without appropriate evidence.

## 9. Confirmed implementation direction

| Component | Direction |
| --- | --- |
| Frontend | Next.js + React + TypeScript + Tailwind CSS + shadcn/ui |
| Backend | Node.js + **Express.js + TypeScript** (NOT NestJS) |
| Data | PostgreSQL + Prisma |
| Jobs | Redis/BullMQ when justified |
| Architecture | Modular monolith with clearly separated app domains, versioned REST/OpenAPI and domain events |
| Testing | Unit/contract/integration/E2E with tenant and role isolation; execute tests rather than claim unrun passes |
| Hosting | Vercel frontend later, managed Node API/data providers subject to owner accounts/budget/approval |

**Current repo:** `frontend/` and `backend/` contain README placeholders, not scaffolds. P3 is where application initialization belongs unless the owner explicitly changes sequencing.

## 10. Synthetic-only datasets and test narratives

Prepare synthetic fixture tenant **Orchid Payments Demo** and **Juniper Merchant Services Demo** (invented). Each must have users/roles, leads, agents, merchants, deals and applications. Example case types: new, waiting for application documents, processor pending, declined, provider approved but not activated, active.

Examples of safely synthetic input:
- `org_demo_orchid` / `org_demo_juniper`
- Agent `AG-DEMO-01`, merchant `Demo River Retail`, application `APP-DEMO-001`
- Emails with `example.com`; no real names, phone numbers, IDs, bank/card data or provider API tokens.
- Never claim fabricated application status is a real processor response.

Required negative tests: tenant A cannot access tenant B's lead/merchant/application by ID or list; unauthorized role cannot change status/export; forbidden fields are rejected and not logged; agent reassignment invalidates old access; internal approval does not mark external authorization/activation.

The separate `docs/product/prd-synthetic-fixtures.json` is a **schema/acceptance sample**, not seed data in a running database.

## 11. Acceptance criteria and value measurements

P1.01's documentary acceptance:
1. Every major user use case is mapped to a release in the traceability table.
2. Functional requirements distinguish must/should/later from non-goals.
3. Owner, operator and admin actors are defined.
4. Each high-risk area has clear security/privacy boundaries.
5. No market-facing effectiveness, price, partner integration, compliance or production availability is misrepresented.
6. Owner confirms the bounded first product **and** long-term suite remains in later tracks.
7. Implementation details are delegated to P1.02–P1.10, P2 and P3/P4 as the roadmap requires.
8. Product owner **approved P1.01 PRD/release priorities on 2026-11-13**; P1.02 Functional SRS is now active.

### Future measured business/quality outcomes (NOT verified)
- Correct owner/status/next action lookup; candidate >=30% median task time improvement, compared against real baseline.
- No cross-tenant access and no critical/high unresolved security issues before sharing real-data access.
- Authorized import/export success, supported error/retry behavior, audit accuracy, and measured operational performance.
- Buyer-paid pilot or partner commitments **not currently present**.

## 12. Risks, decisions and dependencies

| Dependency / risk | Current state | Owner / resolution |
| --- | --- | --- |
| Product-market evidence | **0 interviews** | Product owner; issue #8, before commercial expansion |
| ISO process map | **0/3 real maps verified**, P0.05 waived for sequencing | Owner/operator; revisit before domain freeze or paid pilot |
| First-product claims | Hypotheses; no timed baseline | Prospect task testing / issue #8 |
| Pricing | **0/5** economic-buyer interviews | Owner; no published prices |
| Design partners | **0/2** | Owner; explicitly waived only for sandbox sequencing |
| Legal entity, initial markets, retention | Open | Owner + qualified reviewers before real data |
| Processor contracts/boarding API | Open | Owner/provider; never assume integration rights |
| Brand | “Zoho Clone” is **internal only** | Owner; choose original public brand before launch |
| Technical controls | Not yet implemented | P3/P4/P12 real tests before external data |
| P1.01 signoff | Pending | Product owner approves scoped PRD and release order |

## 13. P1 roadmap handoff

P1 consists of exactly ten requirement sub-phases per master v2.0:
P1.01 Master PRD (**ACTIVE**); P1.02 Functional SRS; P1.03 Nonfunctional SRS; P1.04 User Personas and Journeys; P1.05 Feature Hierarchy and Release Gates; P1.06 Permission and Sharing Matrix; P1.07 Domain Glossary and Sample Records; P1.08 API and Event Contract Specification; P1.09 Acceptance and Traceability Map; P1.10 Risk and Decision Register.

Do not advance P1.02 until P1.01's owner review. P1's final exit requires versioned PRD/SRS, traceability matrix, glossary and approved MVP backlog.

**P1.01 status: COMPLETE — OWNER APPROVED on 2026-11-13.** The P1.02 functional SRS is an unapproved follow-on draft, not implemented code.
