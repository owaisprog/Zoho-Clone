# P0.06 — Security, Threat, and Owner Review

**Prepared:** 2026-11-13
**Status:** Review draft; legal jurisdiction and processor contracts undetermined. **No systems audited or deployed.**
**Authority:** Product owner chose to bypass P0.05 research validation; security/privacy requirements are **not waived**.

## 1. Main threats and controls to design

| Threat | Risk path | Required later control | Evidence to collect |
| --- | --- | --- | --- |
| Cross-organization data leak | Guess another tenant's merchant ID or search query | Server-side authorization, RLS and indirect relation checks | Automated cross-tenant tests in P4/P12 |
| Agent hierarchy leak | Unauthorized agent sees other reseller portfolio | RBAC/ABAC, assignment history, reassignment invalidation | Record-level access tests |
| Prohibited field ingestion | Web form/import/support note includes bank/card/ID | Allowlists, detection/quarantine, hosted provider handoff | Negative input tests |
| Free-text and log leakage | Request body, stack trace, error provider captures secrets | Redaction before logging; restrict telemetry, retention | Test simulated errors/trace exporters |
| Processor status spoof | Fake/out-of-order webhook implies merchant approval | Signature verification, idempotency, separate external state | Replay/ordering/verification tests |
| Credential compromise | Token stored in database/plain logs | Secrets manager, scoped service identity, rotation | Secret scan and access test |
| Insecure file download | Guessable signed URL, public bucket | Private storage, policy check, TTL and scan | Cross-tenant/file tests |
| AI data disclosure | Restricted contact/financial info sent to model | Default deny, scoped consent/DPA and redaction | Prompt policies, tool trace review |
| Public repo exposure | Developer commits actual research/merchant info | No sensitive files in GitHub, precommit secret scan | CI secret audit |
| Retention violations | Old data in backups and exports | Retention inventory and deletion/runbook | Verified retention and recovery tests |

## 2. Mandatory organization/business questions
- Intended first commercial operating **countries**, entity, customer contracting jurisdiction and applicable data-protection obligations?
- Which data types must ISO onboarding actually handle, based on **real validated** workflows when available?
- Which acquiring/processing, identity/KYB and billing providers authorize status APIs or document handling?
- What data processing agreements, subprocessor contracts, notice/consent, residency and export rights apply?
- Which personnel may see merchants/agents and financial documents? Is outside agent portal access needed in MVP?
- How long must merchant lead/application history, audit and finance records be retained? What legal holds apply?
- Does the owner accept **no raw card/ID/bank/KYC collection in the initial CRM**?
- Are uploads disallowed initially? If not, what approved file categories and scanner/cloud are available?
- What incident response, backup/restore, system data access and audit export requirements are necessary before customer pilots?

## 3. Source and applicability boundaries
- PCI Security Standards Council: CVV and other sensitive authentication data generally **cannot be stored post-authorization**, even encrypted. https://www.pcisecuritystandards.org/faqs/1319/ .
- PCI retention policies depend on necessity and data class; no single maximum retention duration applies to all cardholder data. https://www.pcisecuritystandards.org/faqs/1318/ .
- European Commission GDPR data minimisation and storage limits apply where GDPR legally governs that processing. https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/principles-gdpr_en .
- OWASP Logging Cheat Sheet advises excluding or masking secrets, session tokens, payment details and sensitive PII in logs. https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet .

These are design sources. Product decisions require review in actual customer/jurisdiction/processor context. No security audit, legal opinion, data processing agreement or external certification has been completed.

## 4. P0.06 acceptance checklist

- [x] P0.06 requirements checked in master roadmap: classify contact, bank, identity, card and credentials; no backend API in phase.
- [x] Candidate data classes and **36 categories** inventoried with permissions/store/retention decision columns.
- [x] Initial MVP high-risk exclusion policy and alternatives documented.
- [x] Private file policy and threat summary documented.
- [x] Proposed negative security tests mapped to later implementation phases.
- [ ] Product owner **approves** classification rules and no-raw-sensitive-data MVP exclusion.
- [ ] Identify target selling jurisdictions and accountable reviewers before production data handling.
- [ ] Processor contracts/actual P0.05 workflows revisited when available.
- [ ] Move to P0.07 after explicit P0.06 owner approval; legal/security clearance before production, not presumed from this documentation.

**P0.06 remains IN PROGRESS.**
