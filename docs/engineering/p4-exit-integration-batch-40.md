# P4 Batch 40 — signed fictional identities to transactional member sales roles

Date: 2026-11-24. Stacked on Batch 39 development, no production authorization.

## Five engineering subphases

1. New **disposable CI-only** PostgreSQL candidate 025 creates separate tenant-scoped `SALES_REP`/`SALES_MANAGER` role state and append-only role events, independent of foundational `OWNER`/`MEMBER` membership. Both tables have FORCE RLS and no runtime table grants. Narrow `SECURITY DEFINER` functions explicitly enforce current verified owner, organization, active target membership, allowable roles and CAS revision.
2. `P4R40CiMemberRoles` uses a restricted `SET LOCAL ROLE`, trusted transaction-scoped actor and tenant GUCs, safe allowlisted member projections, atomic revision checks and opaque denied/conflict responses. No raw SQL from client body; server generates request IDs.
3. Test-only Express `GET /owner/:orgId/members` and `PATCH /owner/:orgId/members/:memberId/role` are optionally mounted under the existing RSA JWT + database subject mapper. Normal `backend/src/app.ts` and `server.ts` remain unmodified and **do not mount this API**.
4. Actual disposable PostgreSQL + signed RS256 test verifies true owner authorization, forged-header/signature/audience failures, member denial, cross-tenant denial, forbidden owner and invented roles, stale and concurrent write CAS, atomic two-event audit, privilege/RLS checks and context cleanup. Focused backend unit regressions cover CI-only fail-closed guards and strict input parsing.
5. Mandatory GitHub CI SQL installation, signed-role smoke and source-graph boundary contract, plus this engineering report. No green result is claimed until final commit checks pass.

## Limitations requiring owner approval

- `SECURITY DEFINER` functions are owned by disposable CI bootstrap; they are **not approved production privilege design** and must never run on actual Neon, staging, or production databases.
- This separately persisted sales role does not yet authorize CRM records, navigation, files, workers or real app endpoints. Formal P1.06 permission grants remain independent. The existing Batch 39 interactive UI stays browser-memory only and is not connected.
- Staging/JWKS/MFA, actual Auth0 users, email, KMS and customer data are untouched. Revoked-member state is denied at command time; a production-grade revocation/reactivation role-reset transaction still requires separate design/acceptance.
- Do not merge, deploy or advance release status. The original **727 formal P1.09 cases are still 0 executed**; Phase 4 `NO_GO`, all 10 gates, 14 original risks, 12 pending decisions, R10-C1–C5, and issue #61 remain OPEN.

CI must pass on the exact final head before this batch can be marked engineering-verified.
