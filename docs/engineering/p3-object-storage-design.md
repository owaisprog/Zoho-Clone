# Master P3.12 — Private object storage design

**Status:** provider-neutral, design complete for owner review; NO provider connected.
**Scope:** future CRM attachments and file service; excludes cards, bank details,
government identification, KYC/KYB, employee/private records until approved gates.

## Flow and trust boundaries

1. Authenticated P4 member invokes a permission-checked file create request.
2. Server validates org membership, record ownership, specific file permission,
   upload category, MIME allowlist, size quota and per-tenant limits.
3. Server creates immutable metadata and random storage key (never customer
   filename or email in key). All objects are private, server-side encrypted.
4. Only a short-lived, single-object signed upload grant is returned after
   authorization (target 60 seconds; bound to size, method, content type).
5. Object remains QUARANTINED until malware scanning and content inspection
   succeed. No user receives download grant before clean scan.
6. On download, re-evaluate member, tenant, record/field rights and object
   state. Generate a fresh short-lived signed GET URL with no public ACL.
7. Deletion uses audited soft-delete, retention eligibility, and later
   asynchronous lifecycle purge; revoked grants must expire quickly.

## Proposed metadata (P4; not yet migrated)

`FileMetadata(id, org_id, record_type, record_id, object_key,
original_filename, declared_mime, detected_mime, size_bytes, sha256,
scan_status, uploaded_by, created_at, deleted_at, retention_until)`.
Composite tenant-scoped foreign keys; require safe record type link strategy.

## Provider selection

Cloudflare R2 or AWS S3 private bucket. No provider provisioned or
selected. Compare cost, hosting region, malware scanning, object lock,
retention, versioning and signed URL mechanism before P4.20/P4.21.

## Security review gates

- No public bucket/list/get; no client-supplied object key/path.
- Scan uploaded bytes; deny HTML/SVG/executable by default until policy.
- Idempotent event handling, tenant quota, rate limits and abuse monitoring.
- Cross-tenant IDOR negative tests for create, scan, download and delete.
- Revocation tests, expiry, time skew, version and deletion restoration.
- No log of URL signatures, content, client paths or credentials.
- An independent security review before non-fictional uploads.

Code interface: `backend/src/platform/storage.ts` uses deny-by-default.
**Cannot count as a functional file service or real storage connection.**
