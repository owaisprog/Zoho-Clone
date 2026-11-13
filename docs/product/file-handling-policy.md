# P0.06 — File Handling and Storage Policy (Design Draft)

**Status:** Proposed; no storage or scanner deployed.

## 1. Default rule
Initial merchant-operations MVP should not offer open-ended uploads of processing agreements, identity records, card data, bank documents or other high-risk materials. Use approved external provider-hosted collection where needed. Reference a permitted external status or document ID only after reviewing contracts.

## 2. Later optional private-file flow
1. Owner and security reviewer approve allowed file classes, purpose, maximum size, formats and user roles.
2. Express issues a short-lived scoped upload grant for a specific organization, record and allowlisted file purpose.
3. File enters a private quarantine bucket; content length and server-side MIME/file signature validated; malware scanning and document classification required before release.
4. A successful scan allows promotion to private protected storage. Scanner failure, timeout and prohibited content are **fail-closed**.
5. Store a minimal database record: `org_id`, opaque object key, file category, hash, size, uploader actor, associated record, scan status, sensitivity and retention marker.
6. Never expose raw bucket paths as authorization. Download uses server-side tenant + record + entitlement checks, then a short-lived signed link.
7. Audit file creation/read/download/export/deletion; avoid logging filenames that contain personal/financial data.
8. Retention and legal holds must be contract/jurisdiction-specific; enforce deletion/expiry across object versions, exports and backups as feasible and appropriately documented.
9. Encryption at rest, TLS in transit, KMS/secret access boundaries and anti-malware signatures updated under operations.
10. Enforce rate limits, storage quotas, size limits and archive/unzip-bomb protections.

## 3. Unsafe patterns to reject
- Public bucket, globally reusable signed URL, guessable key, or frontend-only access check.
- User-controlled path or URL accepted as authorization.
- Persisting upload before a scan completes or silently allowing on scanner failure.
- Copying confidential bytes into errors, issue tracker, analytics, AI prompts or webhook payloads.
- Cross-tenant file IDs, document preview without content security, executable HTML/SVG without sanitization and preview isolation.
- Assuming uploaded documents do not contain PAN/CVV or personal verification data without appropriate controls.

## 4. Data classification and file purpose
- Public marketing assets: controlled publication separate from private tenant files.
- Sales proposals: CONFIDENTIAL, scoped record access.
- Merchant contracts: RESTRICTED, after specialist approval and strict file policy.
- KYC identity images/bank evidence: **out of scope for initial MVP**; use regulated provider flow.
- HR/payroll documents: separate future HR product with independent assessment.
- Support attachments: separate future Help Desk product with its own permitted data classes.

## 5. Tests and operations to define later
Verify organization isolation, role restrictions, signed URL expiry, scan timeout, quarantined object access denial, file signature mismatch, revocation, large files, policy-bound download, deletion and restore tests. Run only when file implementation exists.

**External design reference:** OWASP Logging Cheat Sheet https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet ; relevant cloud object-storage and malware-scanning platform guidance to be selected in P3.
