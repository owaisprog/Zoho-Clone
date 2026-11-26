# P4 infrastructure simplification — owner direction, 2026-11-27

Owner directed the project to retain existing Neon and Auth0, prefer suitable Vercel-native services, skip Sentry activation and defer manual Mac verification. Additional monthly budget is $0. No provisioning, merge, deployment, live migrations, commercial activation or formal gate closure is authorized. This record supplements rather than replaces prior architecture and release evidence.

## Selected development path

- Keep Next.js and Express TypeScript in the existing separate Vercel project shells; no Git auto-deployment or secrets added.
- Retain current Neon development database and Auth0 development configuration unchanged. Isolated staging roles, database and identity must be independently authorized and tested.
- GitHub Actions remains the execution environment for disposable PostgreSQL, Redis/BullMQ, ClamAV and SeaweedFS. Preserve the verified implementations and their existing regression tests. Mac Docker verification is deferred, not recorded as passed.
- Prefer Vercel built-in runtime logs and existing redacted health metrics. Sentry cloud activation is skipped; its gated code remains disabled. No Observability Plus.
- Prefer Vercel Private Blob as a prospective hosted storage adapter; preserve SeaweedFS as an isolated local/CI alternative. No Blob store created or token generated. Private Blob alone does not enforce tenant access or malware policy. Keep quarantine, independent scanner verdict, digest binding, permission revocation and private download checks. Disable hosted upload/release until scanner and persistent metadata are verified.
- Prefer Vercel Queues as a prospective hosted wakeup transport, not a replacement for the database outbox. Queue delivery is at-least-once and messages expire; durable due-job recovery, authorization recheck, revision/idempotency and atomic audit remain in PostgreSQL. The existing BullMQ transport remains available. A direct bounded CI pump exercises the same restricted database function without relying on queue delivery; no new cloud adapter or external notification delivery is activated.
- Do not run a persistent Redis, SeaweedFS or scanner daemon on a hobby account. Vercel container/daemon services require separate capability, eligibility, budget, isolation and persistence review. No additional infrastructure service is needed to continue synthetic product development.

## Provider references (reviewed 2026-11-27)

- https://vercel.com/legal/terms and https://vercel.com/docs/limits/fair-use-guidelines : Hobby is restricted to personal non-commercial use; commercial SaaS development/hosting eligibility cannot be assumed. No hosted activation until eligibility and authorization are resolved.
- https://vercel.com/pricing and https://vercel.com/docs/vercel-blob/usage-and-pricing : advertised Hobby Blob allowance 1 GB storage, 10 GB transfer, 10,000 simple and 2,000 advanced operations; account usage and restrictions must be checked before any approved activation.
- https://vercel.com/docs/vercel-blob/private-storage : authenticated private storage; server-side credentials only.
- https://vercel.com/docs/queues : beta, all plans, at-least-once delivery and retention up to 24 hours per message. Pricing page advertises 1M operations/month included on Hobby; verify current account limits before activation.
- https://vercel.com/docs/plans/hobby : one hour runtime log retention. Not a replacement for immutable security audit or recovery evidence.

## Next product work (not authorized release)

1. P4 approved R10-C1–C5 role/team writes: port to reviewed staging UUID membership model, least-privilege writer, CAS/replay, audit, last-owner guard. Do not execute external DDL.
2. Integrate durable tenant-scoped outbox and file metadata, keep transport/provider replaceable; test revocation and recovery in disposable CI.
3. Reconcile original P4 acceptance inventory, execute authorized cases with evidence, and resolve remaining identity, migration, staging, operational and owner gates. Separate approval is required for live signed Auth0, external migrations or deployment.
4. P5 CRM product development follows the original roadmap: complete lead edit, assignment and source changes, contact/account lifecycle, duplicate review, configurable deals, tasks, reports and accessible browser flows. Synthetic engineering may proceed when explicitly scoped; no P5 release authorization is inferred.

PR #152 exact verified head 4bae5bf46d766fce0b509f3cbf0c4a88cb64f05a, run 45854459726, 4/4 passed. Prior official P4 decision NO_GO; 10 gates, 14 risks, 12 tracked decisions open; formal executed 0/727, P4-linked 108 with 43 partial engineering references and 65 unmapped. These counters and existing evidence remain unchanged. This is not a new formal phase or production-ready claim.
