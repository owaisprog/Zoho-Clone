# P4 Batch 16 — signed, time-limited audit paging (CI only)

Five actual implementation tasks:
1. HMAC-SHA256 domain-separated, versioned cursor containing only synthetic organization ID, actor ID, audit UUID, page limit, issue/expiry time. Constant-time tag check, canonical payload check, 5-minute validity, 1024-byte max.
2. CI-only paging orchestrator that validates signature before database access and re-runs restricted R15 Prisma+PostgreSQL membership, role and entitlement checks on every page.
3. New GET-only unmounted synthetic Express adapter `/:orgId/iam/signed-audit`, with strict parameter/role/identity checks and no export, mutation or real auth provider.
4. Seven Node unit cases for signatures, tampering, time drift/expiry, tenant and actor replay, wrong page size, invalid formats and signing-key constraints.
5. Actual GitHub Actions PostgreSQL/Prisma/HTTP smoke for signed cursor reuse, cross-org/actor denial and membership revocation.

All synthetic only; signing key in test fixtures is deliberately fake, not a reusable credential. Production key custody/rotation, live JWT validation, staging credentials, deployment and audit retention require separate approvals. No Neon migrations, main merge, customer data or paid cloud changes. P4 exit #61, R10-C1–C5, 14 risks, 12 decisions and 727 original unexecuted acceptance cases remain open.

CI verification: pending at implementation time; do not mark pass before checking GitHub Actions.
