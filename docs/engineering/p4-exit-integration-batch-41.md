# P4 Batch 41 — signed local frontend-to-PostgreSQL member roles

Date 2026-11-24. Stacked on Batch 40, draft only.

## Five subphases completed
1. Strict immutable `P4R41Member` response contract: allowlisted member user ID, SALES_REP or SALES_MANAGER, bounded revision, no unknown JSON fields, duplicate members or unsorted projections.
2. CI-only typed frontend HTTP client for owner member listing and optimistic revision role change. Strong loopback URL, CI environment, cache, redirect, JWT injection, response header, error-status and payload guards. No cookies, log, storage or live Auth0.
3. CI-only interaction controller with loading success/error states and mandatory stale-data clearing after denial. Not mounted in normal browser UI.
4. Real GitHub CI localhost HTTP signed RS256 token -> Express -> PostgreSQL R40 role read/update, stale write denial, wrong tenant, forged token, audit event integrity and transaction-local context.
5. Eight frontend regression tests, mandatory source-boundary checker, workflow addition and this report.

## Release gates and limitations
The existing P4 R39 fictional UI remains browser-memory only. R41 is a separate typed CI workflow, **not an authenticated website**. No real SMTP, Auth0 login/JWKS/MFA, managed KMS, customer data, owner Neon mutation, staging/production, merge or deployment. Original P1.09 acceptance `0/727`; P4 decision `NO_GO`; all 10 release gates, 14 original risks, 12 open decisions, R10-C1–C5 and issue #61 remain open. CI verification must be recorded at the final SHA before treating batch as engineering verified.
