# ADR 0004 — Staging, telemetry and private storage

Status: **SEPARATE-ENVIRONMENT AND PRIVATE-STORAGE PATTERN OWNER APPROVED; CLOUD/PROVIDER/RETENTION OPEN** — 2026-11-20
Source: master PDF P3.07–P3.12.

- Never deploy synthetic preview as production or load real customer data.
- Stage Next.js separately from Node API; keep staging cloud account,
  secrets, buckets and DB isolated from production.
- Require explicit owner cloud budget and environment, CI and deploy
  approvals; all deploys must be reversible with health checks.
- Liveness only indicates process; readiness must include verified
  dependencies and fail closed. Readiness returns 503 without a probe.
- Generate server-owned request IDs; structured logs exclude paths,
  query, headers, bodies, IPs, secrets, tokens or customer data. Error
  tracking and OTel provider integration are pending selection.
- Store files only in private R2/S3 buckets behind signed grants,
  malware scan, record permission checks and retention policy.
- Redis is a local disposable developer service now; BullMQ workers and
  credential-bearing integrations are deferred to the planned phases.

See docs/engineering/p3-object-storage-design.md and
docs/engineering/p3-staging-runbook.md for acceptance criteria.


## Architecture v1.0 (2026-11-20)
Owner approved **separate development/staging/production boundaries** and a **provider-neutral private file service with quarantine and malware/content scanning** as the design. **Not approved:** hosting provider, paid cloud costs, exact region/residency, object store (S3/R2), scanner, retention schedule, real bucket, secrets, any staging deploy or production use. [ADR 0007](0007-architecture-v1-owner-approval.md).
