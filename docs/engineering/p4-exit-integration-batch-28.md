# P4 Batch 28 — first transactional organization backend workflow

Date: 2026-11-23. Draft stacked on Batch 27. This is **actual database-backed functionality tested on a disposable local CI PostgreSQL database**, but **not live production Auth0 or tenant provisioning**.

## Five actual implementation deliverables

1. **Transactional service** (`backend/src/platform/p4-r28-ci-org-service.ts`): a real PostgreSQL transaction creates an organization with a unique `demo-` slug and a matching active owner membership. It checks the existing fictional user's verified provider mapping, executes queries as the `p4_synthetic_ci_runtime` RLS-limited role with transaction-local actor/tenant context, and commits both rows atomically. A failure rolls back both.
2. **Actual organization read API**: the service retrieves a newly persisted workspace only if the current actor has its active OWNER membership. Unknown or foreign IDs receive an identical sanitized access denial.
3. **Express HTTP adapter** (`backend/src/platform/p4-r28-ci-org-router.ts`): CI-only `POST /_p4_r28_ci/organizations` and `GET /_p4_r28_ci/organizations/:orgId`. Actor identity is injected from a trusted CI resolver, **never derived from browser role/user headers**; responses are private/no-store, reject malformed bodies and reveal no credentials or raw SQL errors. Adapter is **NOT mounted** in `backend/src/app.ts` or `server.ts` and refuses production environments.
4. **Real integration and regression tests**: `backend/src/scripts/p4-ci-r28-transactional-org-smoke.ts` proves HTTP creation persisted to PostgreSQL with exactly one owner row; authenticated read, foreign-owner denial, no-auth denial, input validation, uniqueness conflict, explicit simulated failure rollback, concurrent two-workspace creation and pooled session context cleanup. Six unit tests cover fail-closed validation, identity and environment guards. Four public-app Supertest checks prove production routes are unavailable.
5. **Required GitHub CI**: the existing disposable PostgreSQL job runs the new backend HTTP smoke after prior schema/role setup, and normal backend unit/typecheck/build checks cover new service and router source.

## What is and is not connected

Batch 27's Next.js workflow is still a **browser-memory demo** and intentionally **does not call this unmounted CI-only API**. This batch delivers an actual backend transaction and read API behind the existing synthetic CI-only guard, not a commercially accessible organization feature. The next step is owner-approved live provider identity and least-privilege DB credentials, safe transactional mutations for invitations, then connecting the frontend to a scoped authenticated API after staging security review. Do not copy the disposable CI superuser-to-role switch into production.

## Formal acceptance and release

The original 727 P1.09 acceptance cases remain **NOT_RUN_DOCUMENT_ONLY**, with 0 formally executed and release **NO_GO**: the test suite cannot be claimed equivalent to live Auth0, real org provision, or staging acceptance. All 10 release gates, 14 original risks, 12 unresolved decisions, R10-C1–C5, owner P4 exit #61, P2/P3 staging approval and production/staging infrastructure review remain open. No Neon change, main merge, paid cloud, real customer data or production deployment.

CI verification pending at initial authoring; the final GitHub Actions run and PR body will record the observed results.
