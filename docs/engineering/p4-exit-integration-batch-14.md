# Phase 4 — Batch 14: scoped organization & role metadata

Date: 2026-11-21 (Asia/Karachi). Stacked on Batch 13's synthetic-only branch. No production or owner Neon changes.

## Five implementation steps

1. Candidate 018 exposes CI-only organization metadata to authorized P1.06 roles. Owner/admin see minimal fictional org name and id; billing admin/reviewer can see only opaque org id.
2. Add **separate** role grant summary reader. Owner sees role names/counts, admin sees only assignable business role names/counts, reviewer sees only policy role names with counts redacted. No member ID, identity subject, secret, raw payload or indirect role privilege.
3. Enforce current membership, active role grant and platform entitlement on every SQL read; deny foreign tenants, no context, revoked members/roles, disabled platform.
4. Add restricted Prisma readers plus **unmounted**, CI-only Express GET endpoints at `/:orgId/iam/organization` and `/:orgId/iam/role-summaries`; never mount in default `app.ts`. Require injected synthetic verified identity mapping, reject all query/export/write requests, return 401/403 without resource existence details.
5. Add nine new backend unit tests, disposable PostgreSQL role/isolation/revocation/field tests and actual Prisma/HTTP two-organization smoke to the existing GitHub Actions workflow.

## Permissions and safety
Owner-approved P1.06 has a 13 role × 22 resource / 286-decision design. This batch enforces its `organization` and `role_grants` **read** subset only. Do not infer read permission for other resources. All services are synthetic-only.

CI-only `SECURITY DEFINER` functions depend on disposable bootstrap ownership; **never promote to production** without independent credential and privilege review. Auth0 claims used in the smoke are injected fictional evidence, not a real signed session. Never apply SQL candidates on owner's Neon.

## Verification
**CI pending** at code authoring. Only mark verified after final GitHub Actions result reports 4/4 successful jobs with typecheck, tests, builds, restricted PG and HTTP smoke.

## Gates still open
P4 exit #61, R10-C1–C5 role/team mutation approval, P2.02 design, P3 staging, real Auth0/JWKS/MFA/revocation, approved private object storage + scanner, region/provider/retention, 14 risks, 12 decisions, 727 original unexecuted P1.09 cases, production migration and formal owner signoff. No user data, paid cloud, main merge, staging or production deployment.
