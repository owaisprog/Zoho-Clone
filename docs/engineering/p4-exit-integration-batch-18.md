# P4 Batch 18 — CI-only route isolation and concurrent tenant-safety hardening

Date: 2026-11-23. Stacked on verified Batch 17 PR #67. This is internal synthetic-only safety engineering, not an audited deployment gate.

## Five implementation tasks

1. Implement `scripts/p4-ci-route-isolation.mjs`: recursively follow relative TypeScript imports starting from the actual Express production `app.ts` and `server.ts`, refuse direct and transitive imports of the internal P4 R8/R14/R15/R16/R17 IAM/audit test routers. Reject literal dynamic imports and re-exports as well; no user-controlled override.
2. Add six Node regression tests for real entrypoint isolation and simulated direct, indirect, dynamically imported and server-mounted test route leaks; ensure legitimate imports do not false-positive.
3. Strengthen the R17 internal test-only HTTP adapter to explicitly emit `Cache-Control: no-store, private`, `Pragma: no-cache` and `X-Content-Type-Options: nosniff` on both authorized and denied responses.
4. Extend real PostgreSQL + Prisma + HTTP smoke with 16 concurrent requests mixing Orchid/Cedar organization IDs and owner/reviewer/admin roles; assert exact tenant-scoped result IDs, forbidden-role denial, allowlisted output fields, no private payload and identical redacted denial shape for malformed query input.
5. Make the route import-graph guard a required verify-stage GitHub Actions check. Existing `scripts/*.test.mjs` runner executes the new Node tests; existing actual PostgreSQL R17 smoke executes extended concurrent security tests. Keep all four workflow jobs required.

## Acceptance and remaining risks

No test router is imported into production `backend/src/app.ts`. Unit/import graph checks are defense in depth, **not** a substitute for production SAST, signed tokens, threat model, least-privilege credentials or independent audit. The disposable CI DB uses synthetic superuser bootstrap and never owner Neon.

P4 formal exit #61, R10-C1–C5, 14 open original risks, 12 unresolved decisions, 727 originally unexecuted P1.09 cases, P2.02/P3 staging, real Auth0/MFA and production storage/scanner/retention remain OPEN. No main merge, staging/production deploy, live data, Neon migration or paid cloud actions.

CI verification pending at authoring; update the draft PR with actual results only after GitHub Actions completion.
