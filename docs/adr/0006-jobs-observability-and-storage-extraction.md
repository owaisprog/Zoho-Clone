# ADR 0006 — Queue, telemetry and private file foundation

Status: **PROVISIONAL / OWNER REVIEW REQUIRED**
Date: 2026-11-20
Master: P3.11–P3.12; P4 and P7 follow-on work.

## Decision: queues and caching

Use **Redis + BullMQ** when an approved asynchronous workload is ready
(P7); use PostgreSQL **transactional outbox** to guarantee that domain
writes and job intents are committed atomically. Jobs must carry opaque
organization, actor/operation identifiers only (no full customer objects);
enforce tenant permission again when executing. Idempotency keys and
per-tenant rate limits are required. Never run a live worker using
the P3 read-only Neon smoke credential.

Alternatives: database-backed jobs reduce infrastructure for small loads,
while direct Redis publishes are simpler but can lose writes when database
commit and publish disagree. Extraction trigger: high job volumes,
cross-service ownership, retry hotspots, security isolation or region
requirements, backed by measured metrics and a published migration plan.

## Decision: observability

Use server-generated UUID request IDs and low-cardinality HTTP method/status/
duration metrics only. Do not collect URL paths, query strings, IPs,
email addresses, tokens, tenant labels or payloads in shared telemetry.
The bounded in-process `SafeRequestMetrics` collector is development-only;
no public metrics endpoint. Select an OpenTelemetry/export sink and secure
admin-only access once hosting, retention, residency and cost are approved.
Degraded dependency readiness must fail closed. Extraction trigger:
distributed traces, regulated retention, multi-service debugging or
substantial request volume.

## Decision: private object storage

Keep the provider-neutral `PrivateObjectStorage` interface. Default provider
denies all upload/download/delete grants. Draft metadata validation limits
MIME and file size but does not verify malware, customer membership or object
contents. Future S3/R2 bucket must be private, scanned/quarantined and
record-scoped; signed grants short lived. Do not introduce real file upload
routes before P4.20/P4.21 and an explicit provider/region review.

## Reversibility and approval

Worker transport, telemetry exporter and file provider remain replaceable
behind interfaces. R2 versus S3, telemetry vendor, object retention and
malware scanner are pending owner cost/privacy decisions. No live customer
data or paid infrastructure authorized.
