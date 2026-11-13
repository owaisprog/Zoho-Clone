# P0.06 — Data Sensitivity Inventory and Classification Matrix

**Project:** Zoho Clone
**Date:** 2026-11-13
**Phase:** P0.06 — Data Sensitivity Inventory
**Status:** OWNER-APPROVED DESIGN REQUIREMENTS (2026-11-13). Not implemented security controls, legal certification or audit evidence.
**Issue:** https://github.com/owaisprog/Zoho-Clone/issues/9
**Owner sequencing override:** P0.05 validation skipped at owner's direction with 0/3 real workflows validated, recorded at `p0-05-validation-waiver.md`.

## 1. Data classification levels

| Class | Meaning | Examples | Handling |
| --- | --- | --- | --- |
| **PUBLIC** | Published without restriction | public pricing/copy; published docs | Public read; edit controlled |
| **INTERNAL** | Non-customer operational metadata | feature flags; harmless system config | Employees/service roles only |
| **CONFIDENTIAL** | Tenant/business data with identifiers | contacts; merchant status; deals; user emails | Org/record-scoped; strict export |
| **RESTRICTED** | High-impact contractual; financial; employment or security records | signed contracts; residual statements; payroll; scoped access logs | Need-to-know roles; audit access; private storage |
| **SPECIAL_REGULATED** | Highly sensitive or regulated data requiring separate assessed system | PAN; CVV; bank details; government ID; KYC packages; biometric/special-category data | **Not in initial merchant CRM**; specialist review |

Classes are **proposed controls**, not a certification or a statement that all categories have the same statutory treatment in every jurisdiction. Some data may be elevated because of context (e.g., a benign note containing bank credentials). If two classes apply, use the stricter effective handling rules.

**Data-handling default for the initial merchant-operations CRM:** store organization-scoped sales and workflow metadata only. Do not ingest raw cardholder, sensitive authentication, banking, full identity/verification or privileged credential data. Use permitted provider-hosted collection and minimal references where needed.

## 2. Machine-readable field/category inventory

See [data-inventory.csv](data-inventory.csv): **36 candidate data categories**, each with sample fields, sensitivity class, source/owner, proposed storage, tenant boundary, allowed role, retention decision, export rule, explicit MVP restriction, future phase and provider boundary. This is a design inventory, not a scan of a running database.

### Important representative records

| Data category | Initial CRM policy | Why |
| --- | --- | --- |
| Lead/contact names and email | CONFIDENTIAL — allowed with access policy | Business contact data is personal data in many jurisdictions |
| Merchant/agent assignment and onboarding stages | CONFIDENTIAL — allowed; organization and record policy | It can reveal sensitive commercial relationships and status |
| Processor IDs, MID and external status metadata | RESTRICTED; minimize and contract-verify | Prevent leaks and misleading internal/external status |
| Residual reports, signed agreements | RESTRICTED; future module | Financial and contract review requirements |
| Full KYC/KYB documents/government IDs | SPECIAL_REGULATED; **excluded from CRM MVP** | Separate provider/consent/security assessment |
| Full bank details/settlement credentials | SPECIAL_REGULATED; **excluded** | PSP tokenization or hosted workflow instead |
| Card number/PAN, PIN, full track data and CVV | SPECIAL_REGULATED; **excluded from CRM** | Card data creates payment-security obligations; PCI SSC prohibits post-authorization storage of sensitive authentication data (including CVV) |
| API credentials, OAuth refresh tokens, encryption keys | High-risk secrets; **excluded from app tables, logs, source control** | Dedicated secrets store + least-privilege service access |
| AI prompt/response content | Inherits input class; no external AI in MVP by default | Model DPA/residency/minimization review required |

## 3. Business flows and boundaries

1. **Sales lead capture:** user's authorized input -> Express validation/policy -> tenant-scoped PostgreSQL record; no card/bank/ID collection. Public forms require consent/notice and abuse protection where applicable.
2. **Merchant onboarding:** internal case + checklist + assigned agent -> status history and tasks; sensitive identity/payment documents stay with authorized external processor/verification provider. Store a status reference only if contractually permitted.
3. **External processor webhook (future):** verified authenticated message -> mapped minimal status -> idempotent event store; reject unknown fields, suppress sensitive payloads in logs.
4. **Hosted billing (future):** redirect/hosted payment collection -> opaque billing customer/method token -> webhook verification -> subscription/entitlement. Never store full payment credentials in CRM.
5. **Files and exports:** deny broad uploads by default in MVP; later private storage, policy-scoped access, scan and short-lived signed URL. Export must respect caller's record access.
6. **AI and analytics:** do not transfer raw restricted tenant data to third-party models or analytics vendors without contractual review, purpose limitation, minimization and owner approval.
7. **Backups, audit, logs and telemetry:** inherit protection at least as strict as contained records; redaction occurs **before** they are emitted, not just when dashboards display them.

## 4. Access control / security architecture dependencies

- P3: Express middleware: identity, organization context, Zod request validation, central data classification decision points; do not trust tenant IDs from the browser.
- P4: strong organization membership/tenant ownership, RBAC plus record ABAC and appropriately designed PostgreSQL RLS; use both query scoping and authorization tests.
- P5/P8: sensitive field allowlists, server-side export authorization, stage history and audited approved actions.
- P6/P7: provider-hosted billing and delegated integration credentials; webhook verification.
- P10: LLM data review, opt-in or processing agreements where applicable, redaction and isolation.
- P12: threat model, privacy review, CI secret scans, cross-tenant leakage tests, log-leak tests, security reviews and incident response.
- P15+: reclassify and reevaluate every additional Zoho-like product (HR, finance, mail, eSign, IT, documents, IoT, etc.).

## 5. Retention, purpose, jurisdiction, and owner decisions

**No fixed retention period is approved.** For each nonpublic category identify collection purpose, applicable legal basis, data-subject geography, processor/controller roles, permitted sharing, retention trigger and deletion/export policy. The jurisdiction and legal entity are not decided. GDPR principles such as data minimization and storage limitation apply when legally applicable; do not describe GDPR as universally governing the SaaS.

### Required sign-offs

- [ ] Product owner confirms initial selling jurisdictions and which data types are in-scope for MVP.
- [x] Product owner approves **no raw bank/card/ID/KYC/credential data** in initial CRM; use approved hosted providers as a DESIGN requirement (2026-11-13).
- [ ] Qualified legal/privacy review defines controller/processor terms, notice, retention and subject-rights handling where applicable.
- [ ] Processor/partner contracts establish which status references and documents we may handle.
- [x] Owner approves five classification classes and proposed access restrictions **as design requirements** (2026-11-13).
- [ ] Architecture phase converts classification into enforceable schemas, field allowlists, integration interfaces and tests.

## 6. Evidence and verification

This phase's purpose is **to identify prohibited/sensitive fields before coding**. The present inventory is a design-level draft. There is no production database/schema/API to inspect and no automated security tests were executed. File restrictions, retention, logging rules and future engineering checks are recorded in related documents.

| Related deliverable | Link |
| --- | --- |
| Forbidden/sensitive fields | [prohibited-fields.md](prohibited-fields.md) |
| Safe file lifecycle | [file-handling-policy.md](file-handling-policy.md) |
| Threat/owner review and status | [p0-06-security-review.md](p0-06-security-review.md) |
| Machine-readable inventory | [data-inventory.csv](data-inventory.csv) |
| P0.05 exception | [p0-05-validation-waiver.md](p0-05-validation-waiver.md) |

## 7. Sources (external design guidance, not legal advice)

- PCI Security Standards Council, sensitive authentication data and CVV storage: https://www.pcisecuritystandards.org/faqs/1319/
- PCI Security Standards Council, retention: https://www.pcisecuritystandards.org/faqs/1318/
- European Commission, GDPR principles: https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/principles-gdpr_en
- OWASP, Logging Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet

**P0.06 acceptance:** Product owner approved proposed classifications and initial CRM high-risk data exclusions on 2026-11-13. P0.06 documentation phase is COMPLETE. Legal jurisdiction, provider contracts, retention and technical implementation/testing remain OPEN before live processing.
