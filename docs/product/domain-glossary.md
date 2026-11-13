# P1.07 — Domain Glossary and Data-Classified Entity Catalog

**Project:** Zoho Clone (internal-only working name)
**Version:** 0.1 — owner review draft
**Prepared:** 2026-11-13
**Phase:** P1.07 Domain Glossary and Synthetic Sample Records
**GitHub issue:** https://github.com/owaisprog/Zoho-Clone/issues/20
**Prerequisites:** P1.01–P1.06 owner-approved specification baselines. **P1.06 permission rules are design requirements, NOT implemented security controls.**
**Status:** DRAFT prepared, **not a database schema, Prisma migration, API, test run, compliance certificate or validated real customer workflow**.

## 1. Product-domain decisions

R0 provides a multi-tenant shared identity/workspace/access foundation. R1 provides ordinary B2B sales CRM. R2 provides a narrow **internal merchant operations tracking** layer. A future provider event is **not** an internally authorized merchant approval. The complete long-term Zoho-like suite remains later separate modules/PRDs.

- **Tenant / Organization:** One business SaaS customer organization with strict isolation. An end merchant is a record in that organization's internal workflow, not automatically a SaaS customer or another tenant.
- **IdentityUser vs Membership:** One managed identity may join multiple organizations but receives authority only through an active membership/role/record policy in the selected organization.
- **Contact vs Merchant:** A CRM Contact is a business contact; a Merchant is a minimal business subject of internal onboarding. Neither represents verified KYC identity or card-processing eligibility.
- **Account vs provider account:** A CRM Account is a sales/company entity. It is **not** a provider MID, bank account, merchant settlement account or actual processor boarding result.
- **Lead → Deal → MerchantApplication:** A sales conversion may create a proposed internal handoff but does **not** prove an application was submitted, underwritten, approved, activated or allowed to collect payments.
- **Internal stage vs external status:** The coordinator controls only allowed internal status and next action. Actual external processor truth requires a separate contracted, authenticated provider integration, **not present in the MVP**.
- **Agent vs Agent login:** An Agent is a business directory record linked by assignment; external agent authentication/portal is deferred.
- **Checklist vs verification:** A checklist item represents a non-sensitive internal task. A checked box must never change provider approval, payment, or KYC status.
- **Audit vs Activity:** AuditEvent is a protected sanitized security/business control trail; Activity is an ordinary role-scoped CRM timeline item. Neither stores raw event/request bodies.
- **Field classification:** P0.06 approved PUBLIC, INTERNAL, CONFIDENTIAL, RESTRICTED, SPECIAL_REGULATED. The approved initial CRM must **reject** raw PAN/CVV, bank/routing, government identity/KYC/KYB documents, provider credentials/secrets in forms, data stores, imports, logs and prompts. A prohibited field definition in the dictionary is a **denial example, not a column to implement**.

All initial workflows are **design hypotheses**: 0 completed customer interviews, 0/3 real merchant process validations, 0 pricing buyer interviews and 0 design partner commitments. Owner waived the evidence gates for synthetic-only internal sequencing, NOT commercial claims.

## 2. Bounded context glossary (31 proposed entities)

### Identity and tenancy

| Entity | Release | Tenant scope | Meaning |
|---|---|---|---|
| `IdentityUser` | R0 | GLOBAL_IDENTITY | Global identity-provider user reference; managed authentication, not credentials in CRM |
| `Organization` | R0 | TENANT_ROOT | Primary tenant/workspace for a business paying for the SaaS |
| `Membership` | R0 | TENANT_SCOPED | Verified user's active relationship to a single organization |
| `Invitation` | R0 | TENANT_SCOPED | Time-limited invitation to a specific organization and allowlisted role |
| `Team` | R0 | TENANT_SCOPED | Sales, onboarding or agent-operations group within one organization |
| `TeamMembership` | R0 | TENANT_SCOPED | Current team-specific assignment used for record scoping |
| `RoleGrant` | R0 | TENANT_SCOPED | Approved role grant to a membership; no self-privilege escalation |

### Entitlements and audit

| Entity | Release | Tenant scope | Meaning |
|---|---|---|---|
| `AppEntitlement` | R0 | TENANT_SCOPED | Server-approved module access, plan limits and eligibility |
| `SubscriptionReference` | R0 | TENANT_SCOPED | Hosted-provider opaque billing metadata only; demo remains mock |
| `UsageCounter` | R0 | TENANT_SCOPED | Atomic usage quota accounting under a plan and tenant |
| `AuditEvent` | R0 | TENANT_SCOPED | Append-only sanitized security/business event metadata |

### Sales CRM

| Entity | Release | Tenant scope | Meaning |
|---|---|---|---|
| `Lead` | R1 | TENANT_SCOPED | Potential B2B/merchant-related sales opportunity before conversion |
| `Contact` | R1 | TENANT_SCOPED | CRM contact linked to an authorized account, not merchant KYC identity |
| `Account` | R1 | TENANT_SCOPED | CRM business account; distinct from a processor MID/payment account |
| `Pipeline` | R1 | TENANT_SCOPED | Organization-specific lead or deal sales process |
| `Stage` | R1 | TENANT_SCOPED | Configurable stage belonging to exactly one pipeline |
| `Deal` | R1 | TENANT_SCOPED | Sales opportunity with an internal sales stage, never external approval |
| `Task` | R1 | TENANT_SCOPED | Assigned follow-up with authorized parent lead/deal/internal application |
| `Activity` | R1 | TENANT_SCOPED | Permitted history/timeline entry for CRM work, no secret payload |

### Merchant operations

| Entity | Release | Tenant scope | Meaning |
|---|---|---|---|
| `Agent` | R2 | TENANT_SCOPED | Internal business agent/reseller reference, not an external login identity |
| `AgentAssignment` | R2 | TENANT_SCOPED | Historical and currently active agent-to-merchant association |
| `Merchant` | R2 | TENANT_SCOPED | Internal tracking reference to a merchant business, no raw onboarding docs |
| `MerchantLocation` | R2 | TENANT_SCOPED | Minimal fictional display location under a merchant |
| `MerchantApplication` | R2 | TENANT_SCOPED | Internal onboarding/tracking case with next action and owner |
| `ApplicationStageHistory` | R2 | TENANT_SCOPED | Append-only trail of authorized internal case stage changes |
| `ChecklistItem` | R2 | TENANT_SCOPED | Allowed non-sensitive internal onboarding action item |
| `ExternalStatusReference` | R2 | TENANT_SCOPED | Separate provenance/verification marker; synthetic in MVP |

### Workflow edges and deferred adapters

| Entity | Release | Tenant scope | Meaning |
|---|---|---|---|
| `ImportJob` | R1 | TENANT_SCOPED | Metadata for safe, validated synthetic CRM import workflow |
| `ExportJob` | R1 | TENANT_SCOPED | Metadata for scoped export with permission/expiry controls |
| `OutboxEvent` | R0-R2 | TENANT_SCOPED | Planned atomic business event metadata for later jobs |
| `ProviderEvent` | LATER | TENANT_SCOPED | DEFERRED signed/verified provider notification concept; no active connector |


## 3. Field inventory and restricted-by-default handling

[Machine-readable data dictionary](domain-dictionary.csv) contains **230 proposed field definitions** across 31 domain entities. For each field it records entity, release, tenant-scope, logical type, approved classification, required/prohibited status, access policy, and semantic note. Fields with `REJECT_DO_NOT_PERSIST` are **not allowed database columns**.

**Common tenant-scoped fields:** `id` (server-generated opaque key), `organization_id` (mandatory tenant scope), and `created_at` (server-controlled UTC). Domain-specific timestamps are UTC and displayed using an organization user's appropriate timezone; do not mix display time with audit ordering.

**Allowed field groups:** Short business labels, permitted CRM contact info and internal ownership/case metadata under field-level rules; safe audit IDs/outcomes without raw payloads. Restrict CONFIDENTIAL contact info to authorized row/field policies. RESTRICTED external/provider opaque refs require explicit read permissions.

**Disallowed field groups:** PAN/CVV/track, bank/routing numbers, identity/KYC/KYB images or full documents, raw passwords/tokens, processing secret keys, full processor underwriting files, unrestricted free-form attachments, and real MID/settlement account identifiers in ordinary CRM. Synthetic negative tests may use fake markers but should not persist them.

**Non-goals in P1.07:** Defining an external underwriting schema, universal US ISO stage names, production geographic residency, actual payroll/finance records, payment card capture, public agent self-service or a built Prisma schema. P1.08 will define versioned API contracts; P3/P4 implements and tests.

## 4. Canonical semantic invariants

1. Every tenant-scoped record's `organization_id` is immutable to normal business users; all tenant-scoped related records must match it.
2. Membership/team/agent scoping controls **rows**; class/field grants control **columns**, including aggregates, exports and errors. A visible parent is not permission to see all children.
3. `IdentityUser` has a global authenticated ID, but **cannot read any tenant record without an active Membership**. Bootstrap organization creation is separately authorized.
4. Lead/Contact/Account/Deal/Agent/Merchant/Application ownership references are verified active organization membership or same-org business relations. Cross-tenant IDs cannot be accepted silently.
5. An internal application stage history append requires an authorized transition with expected-version check; no ordinary user UPDATE/DELETE of history.
6. A won Deal does not automatically create processor authority. Internal `active_internal` state is **not** `charges_enabled`, boarding approved, terminal activated or a real provider decision.
7. A revoked member/agent assignment loses current record visibility on the **next protected server request**; history can remain for qualified auditors.
8. Duplicate idempotent creates/stage changes and concurrent stale writes must not generate duplicate history, orphan tasks or silent overwrites.
9. Export/import and worker jobs inherit the same verified organization, record and field allowlists as direct API operations; no system-worker wildcard tenant access.
10. Raw merchant financial and identity verification data are prohibited in the initial ordinary CRM even if a user has `ORG_OWNER` role; such controls are **hard design boundaries**.
11. Data retention/deletion, region, supplier agreements and real provider status mapping remain unresolved legal/commercial decisions before real data processing.
12. Each entity/field and schema in this document is a **proposal** pending owner approval and eventual running-system tests.

## 5. Candidate enums, not validated ISO process rules

| Domain | Suggested state examples | Caution |
|---|---|---|
| Membership | active, revoked, suspended | Active auth/tenant membership is checked per request |
| Invitation | pending, accepted, expired, revoked | No raw acceptance tokens in ordinary records |
| Sales lead | new, contacted, qualified, nurture, unqualified, converted | Per-org pipeline stages adjustable |
| Deal | open, discovery, proposal, negotiation, won, lost | Won does not mean approved merchant |
| Task | open, in_progress, blocked, done, cancelled | Reopen/late behavior defined later |
| Internal merchant application | draft, pending_more_info, pending_external, activation_pending, active_internal | **Provisional** only; external statuses separate |
| External status demo | DEMO_ONLY_PENDING, DEMO_ONLY_APPROVED_NOT_ACTIVATED, DEMO_ONLY_ACTIVE | **Synthetic labels only**, never provider proof |
| App entitlement | enabled, disabled, expired | Mock/approved server source of truth only |

**Critical unresolved detail:** P0.05 owner waived actual ISO/POS/PayFac workflow verification. These labels must stay configurable and should not be frozen into the database/API without later validation or explicit change control.

## 6. How sample records are organized

[domain-synthetic-records.json](domain-synthetic-records.json) provides an **illustrative domain sample**, built with two unrelated fictional tenants. It uses fake IDs (`org_demo_*`), fictional display labels and example.com addresses only. It includes relationships for R0 workspace/membership/roles, R1 contacts/accounts/deals/tasks and R2 merchant/agent/application/checklist/status history. The approval flag `processor_verified` is intentionally **absent**; all external demos use `synthetic_unverified` provenance.

- The JSON is not automatically consumable Prisma seed code and is not a real database.
- No passwords, API tokens, card numbers, bank details, government ID files, merchant IDs or provider customer records appear.
- [domain-validation-cases.csv](domain-validation-cases.csv) specifies future integrity/tenant/field tests as **NOT RUN**.
- [domain-relationships.md](domain-relationships.md) defines proposed cardinalities, tenant-join rules and deferred provider integration boundaries.

## 7. Planned implementation handoff

- **P1.08 API/event contract:** establish exact ID and datetime encodings, input/output field schemas, pagination, API error envelope, version fields, opaque status/source refs and event boundaries.
- **P1.09 acceptance traceability:** map UC/FR/NFR/FT/perms/glossary fields and synthetic cases into executable future tests.
- **P3/P4 schema and authorization:** create Prisma migrations/constraints and write real cross-tenant and prohibited-field tests, with a single approved synthetic dataset.
- **P8 merchant operations:** revisit state names with actual operators prior to irreversible boarding integration decisions.
- **P12/P14 safety:** real backup/restore, security review, privacy and separate owner G-EXT/G-COM authorization before customer deployment.

## 8. P1.07 owner gate

- [x] All 31 candidate domain entities and 230 field definitions classified and traced to current architecture.
- [x] Tenant/relationship invariants and provisional state terminology documented.
- [x] Synthetic examples and future validation cases prepared without real private records.
- [ ] Product owner approves glossary, field allowlists, synthetic record shapes and deferred/forbidden data scope as an internal planning baseline.
- [ ] Only then close P1.07 and open **P1.08 API and Event Contract Specification**.

**P1.07 remains IN PROGRESS; no executable schema, migrations, real data or running tests exist.**
