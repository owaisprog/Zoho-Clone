# P0.06 — Data Sensitivity Inventory (PREWORK ONLY)

**Project:** Zoho Clone
**Prepared:** 2026-11-13
**Status:** PRELIMINARY / UNAPPROVED. This document does **not** mark P0.06 started or complete.
**Dependency:** P0.05 still open; three real merchant workflows have **not** been validated (0/3).
**Purpose:** Identify likely data types and minimum handling requirements to accelerate subsequent privacy/security design.

## 1. Proposed classification (requires owner / legal / security sign-off)

| Class | Definition | Examples | Handling default |
| --- | --- | --- | --- |
| PUBLIC | Published and intentionally shareable | Public feature pages, anonymized generic help text | Normal integrity/availability safeguards |
| INTERNAL | Ordinary operational configuration | Non-sensitive app settings, feature flags, service ownership | Authenticated business access; logs |
| CONFIDENTIAL | Customer business data and moderate-risk identifiers | Lead names/emails, merchant contacts, agent links, deal values, sales tasks, internal notes | Organization isolation, field/record policies, encrypted transport/storage, audit sensitive access |
| RESTRICTED | High-risk financial, employment and contract records | Merchant processing agreements, commission/residual amounts, legal agreements, invoice ledgers, support notes with PII, private authentication metadata | Least privilege, strong audit, retention and export policy, encryption/key management, review before production |
| SPECIAL_REGULATED | Cardholder data, bank credentials, verification/identity records, health/sensitive-category data depending on application | PAN/CVV, bank details, full KYC/KYB document packages, government IDs, payroll tax identifiers, secrets | **Do not ingest in general CRM/MVP**; use approved provider-hosted/tokenized references and separate formal compliance design if ever required |

These labels are proposed engineering classifications, **not a claim of PCI-DSS, GDPR, ISO 27001, SOC 2 or other certification**. Cross-border processing, jurisdiction and legitimate basis remain unknown until selected.

## 2. Candidate data inventory

| Domain / data | Proposed class | Likely stores | Tenant scope | Retention / legal decision |
| --- | --- | --- | --- | --- |
| Public product site marketing copy | PUBLIC | Next.js assets/CMS | Global/public | Marketing policy TBD |
| Organization name and plan | CONFIDENTIAL | PostgreSQL | Organization and platform-authorized | Account lifecycle and contracts TBD |
| User identity and membership | CONFIDENTIAL / RESTRICTED for security attributes | Managed OIDC + PostgreSQL memberships | User / organization | Provider DPA and deletion obligations TBD |
| CRM leads/contacts/accounts | CONFIDENTIAL | PostgreSQL | Organization + record RBAC/ABAC | Owner export/deletion policy TBD |
| CRM tasks, notes, communications | CONFIDENTIAL; elevate if sensitive attachments | PostgreSQL + private object storage | Organization + record policy | Channel, attachments, retention TBD |
| Agent/reseller hierarchy and assignment | CONFIDENTIAL | PostgreSQL | Organization | Assignment history and dispute hold TBD |
| Merchant legal name/location/application reference | CONFIDENTIAL | PostgreSQL | Organization | Data minimization and post-termination retention TBD |
| Internal application stage/checklist | CONFIDENTIAL | PostgreSQL | Organization + restricted role | Audit lifetime TBD |
| Processor external ID and status | CONFIDENTIAL, possibly RESTRICTED | PostgreSQL / integration token vault | Organization + integration policy | Partner terms and visibility TBD |
| Merchant e-sign files or contracts | RESTRICTED | Private object storage / approved e-sign provider | Organization + strict file ACL | Legal retention and consent TBD |
| Full underwriting/KYC/KYB documents | SPECIAL_REGULATED | **Not stored in CRM MVP** | Provider-hosted only if permitted | Compliance review mandatory |
| Bank details / settlement information | SPECIAL_REGULATED | **Not stored in CRM MVP** | Approved PSP token only if needed later | Legal review mandatory |
| PAN/CVV or sensitive payment-auth data | SPECIAL_REGULATED | **Not collected or stored** | External PCI-compliant provider | Formal PCI scope determination mandatory |
| Agent commissions and residual reports | RESTRICTED | Future finance / payouts module | Organization + financial role | Reconciliation and statutory retention TBD |
| Subscriptions, invoices and payment tokens | RESTRICTED | Managed billing provider + limited references | Organization + billing/admin role | Billing provider, tax jurisdiction TBD |
| HR and payroll / tax identifiers | RESTRICTED / SPECIAL_REGULATED | Future independent HR/payroll modules | Organization + strong functional policies | Employment jurisdiction TBD |
| API keys, OAuth refresh tokens, webhook secrets | RESTRICTED / SPECIAL_REGULATED secrets | Secret manager / encrypted credential vault, **not source control** | Scoped integration and service | Rotation/revocation required |
| Audit trail, security alerts, session metadata | RESTRICTED | Append-only audit store and monitoring | Organization + privileged review | Security retention and breach response TBD |
| Backups, exports and analytics datasets | Highest class of included records | Encrypted managed stores | Organization-bound export | Backup expiration, restore, tenant deletion TBD |

## 3. Design constraints for future engineering phases

- Managed authentication with verified organization memberships and server-side role/record policies.
- PostgreSQL tenant constraints and RLS-in-transaction design where appropriate; test cross-tenant reads, writes and indirect references.
- Encryption in transit, managed at-rest encryption, least-privilege cloud permissions and key rotation.
- Structured application logs must avoid raw PII, bank data, credentials or provider verification payloads.
- Object storage private by default; short-lived signed access, antivirus/file scanning where required, and content-type/size limits.
- Separate internal workflow status from external processor authorization evidence, with verified source timestamps and idempotency.
- Event/outbox payloads only contain minimum required references; secure consumers and audit reads.
- No production customer data in GitHub, public tickets, test fixtures or unmanaged LLM prompts.
- Subject access, consent/notice, export/deletion, backup purge and breach handling must be legally scoped before launch.
- Data residency, applicable regulators, controller/processor roles, service contracts and provider DPA are **open decisions**, not default assumptions.

## 4. Application expansion coverage

Because the long-term goal covers every Zoho-like product, the inventory must be revisited for each application:
- Finance/accounting/payouts; HR/recruiting/payroll; email/collaboration/drive; support/helpdesk; inventory/POS/ecommerce; documents/eSign; marketing/analytics; low-code/AI integrations; IoT/IT management and monitoring.
- Never presume the first CRM's processing basis and access policies extend automatically to payroll, health, finance or regulated verification data.
- Each new product track requires a data-flow diagram, classification, third-party processor inventory, tenant sharing analysis, retention rules and independent acceptance tests.

## 5. Open owner and research questions

- [ ] Intended initial customer selling countries and legal entity/contracting jurisdiction?
- [ ] Which payment processors and onboarding providers are permitted partners?
- [ ] Who controls KYC data: merchant, processor, ISO or another approved entity?
- [ ] What real customer workflow data fields are actually needed? (P0.05 validation pending.)
- [ ] Will the initial MVP accept document uploads, or only references to a secure provider portal?
- [ ] What are the specific legal/accounting retention requirements by geography?
- [ ] Where will database, files, audit logs and backups be hosted?
- [ ] Do any customer contracts require audit evidence, SSO or a security review before trial?
- [ ] Which third-party AI providers, if any, may process customer text?
- [ ] What exports, deletion operations and consent records are required?

## 6. Gate and limitations

**P0.06 is NOT approved or started.** This prework is useful only as an assumption log until P0.05 has three validated real-world workflows and the product owner authorizes advancing to P0.06. Final classifications require a jurisdiction/partner-specific security and legal review. The app, database, billing, and security controls are not implemented yet.
