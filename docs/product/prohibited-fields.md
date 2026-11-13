# P0.06 — Prohibited and Sensitive Fields Policy (Proposed)

**Status:** Design rule draft; not yet implemented in code.
**Scope:** Initial CRM and merchant-operations MVP; later modules require independent review.

## 1. Reject from initial CRM schema, forms and unstructured attachments

| Data / field | Example input | MVP treatment | Allowed alternative |
| --- | --- | --- | --- |
| PAN, full payment card number, track data | 16-digit account number; magnetic-stripe track | **Prohibit** all ordinary CRM collection/storage/logging | Approved PCI-compliant hosted processor |
| CVV/CVC/CID and PIN/PIN-block | 3-4 digit security code, PIN | **Prohibit**; PCI SSC prohibits storage after authorization even when encrypted | Payment processor handles authorization without returning secrets |
| Bank account and routing identifiers | Full IBAN, routing/account numbers | **Prohibit raw** | Provider-hosted bank verification; opaque reference/token |
| Government ID numbers/photos | National ID, passport, driver's license images | **Prohibit raw** | Provider-hosted KYC/KYB flow; minimal verification-status reference |
| Full underwriting/beneficial owner records | DOB, home address + ID, risk decision artifacts | **Prohibit in general CRM** | Restricted provider/verification workflow after separate assessment |
| Login credentials/secret keys | User password, API key, refresh token, private signing key | **Prohibit in business records, logs, imports or tickets** | Managed identity/secrets provider and token vault |
| Full merchant agreement uploads | MPA scans with hidden regulated fields | **No general-purpose uploads in MVP** | Approved eSign or secured reviewed document workflow later |
| Raw health/biometric and payroll/tax data | Medical record, fingerprint, employee tax IDs | **Prohibit in initial merchant CRM** | Separate future product assessments |

**Important:** These are *product-design prohibitions* to reduce exposure, not a legal statement that every such data type is universally illegal to store. A future specialized regulated product may be possible only after a separate compliance architecture and approval.

## 2. Prevent accidental collection via free text and imports

- Only documented Zod schemas and exact allowlisted field keys accepted by Express APIs. Reject unknown keys rather than indiscriminately spreading request bodies.
- Field-level permissions and organization checks required before persistence.
- General notes and web forms should discourage regulated submissions and apply context-aware detection/review; simple regex cannot guarantee detection.
- CSV import: approve column mapping only to allowlisted fields; reject prohibited columns, limit file size, antivirus scan, use quarantine and short-lived staging where supported.
- Emails, support tickets and image attachments require data-leak rules; **do not allow general file uploads in MVP** before scanning and classified storage are implemented.
- If prohibited data is unexpectedly received, follow an incident-handling/redaction/removal process; never print raw payloads for debugging.
- For AI workflows, redact or do not transmit restricted fields unless separately authorized for that processing purpose.

## 3. Acceptance tests to implement in later phases (not run)

| Test ID | Given | Expected |
| --- | --- | --- |
| SEC-DATA-001 | POST CRM contact with forbidden `card_number` key | 400 validation error; no persistence or value in logs |
| SEC-DATA-002 | POST merchant with `cvv`, `pin` or `bankAccountNumber` fields | 400 and redacted audit event |
| SEC-DATA-003 | CRM bulk import includes government ID columns | Import rejected before persistence, staging safely purged |
| SEC-DATA-004 | Unexpected processor webhook contains identity document | Ignore/reject disallowed field; no body logging |
| SEC-DATA-005 | Error handler receives bearer token or secret key | Redacted server telemetry and client response |
| SEC-DATA-006 | Unauthorized export of restricted financial data | 403 and audited refusal |
| SEC-DATA-007 | Cross-tenant contact or application ID in URL/body | 403/404 with no cross-tenant disclosure |
| SEC-DATA-008 | Generic attachment upload before file pipeline exists | 403/404/415 per specified API contract |
| SEC-DATA-009 | Data included in AI prompt with restricted policy | Transmission blocked unless separately allowed |
| SEC-DATA-010 | Database/backup/export deletion requested | Response follows approved retention / legal hold rules |

Tests must be run and reviewed when APIs exist. This document is not proof that controls work.

## 4. Review obligations

Classification owner: product owner and qualified security/legal reviewers where required.
Technical implementation owner: backend/frontend architecture and QA phases.
No "PCI/GDPR compliant" claim may be made from these written rules alone.
