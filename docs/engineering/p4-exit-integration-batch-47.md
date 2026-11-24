# P4 Batch 47 — Signed persisted owner invitation directory

Date: 2026-11-24. Stacked on CI-verified Batch 46. Five engineering subphases:

1. Disposable PostgreSQL owner-scoped read-only SQL function, no SELECT grants to runtime, effective expiry computed without mutating the underlying record, exact fictional email search, status filter all/pending/accepted/revoked/expired and bounded 21-row sentinel for a fail-closed 20-record API.
2. CI-only typed backend service uses fresh verified-owner tenant context and restricted transaction role, returning only id, organizationId, recipientEmail, MEMBER, status, issuedAt, expiresAt and version. Never returns raw token, token hash, outbox ciphertext, provider sub or audit internals.
3. Unmounted signed Express GET invitation directory route, strict query keys/status, cache-control and nosniff, optional dependency in the R33 RSA test workflow.
4. Strict localhost-only typed frontend directory client and integrated owner interaction controller with issue/renew/cancel/get; state is refreshed from actual SQL after writes and cleared on denial rather than made up in browser memory. Frontend/backend regressions cover malicious fields, unsafe query, permissions and failed refresh.
5. Required CI SQL install, source-graph contract and real localhost RS256 fictional owner/recipient through Express and disposable PostgreSQL. End-to-end lifecycle validates pending, accepted, canceled, renewed and effective-expired records, owner/tenant denials, bounded >20 result rejection and context cleanup.

Limits: intentionally no cursor pagination or commercial PII retention, no real Auth0, MFA, JWKS, SMTP, KMS, owner Neon writes, staging or production deployment, and no normal public Next.js/Express mount. Provisional SQL SECURITY DEFINER semantics are only for disposable CI. P4 formal release decision remains NO_GO, original P1.09 acceptance 0/727 formally executed, all 10 release gates, 14 risks, 12 unresolved decisions and owner exit issue #61 OPEN. Do not merge or deploy.
