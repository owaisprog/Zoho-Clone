# P4 — Staging identity and tenant membership integration

Extends verified draft PR #146. Actual, read-only platform slice: fresh UUIDv4 identity, organization and membership schema; PostgreSQL forced RLS; separately provisioned non-login owner and lookup roles; restricted runtime login with no table access; fixed security-definer membership lookup. Prisma 7 uses bound parameters and attests the runtime login, database, role attributes, lack of memberships/direct grants and forced RLS on every lookup. Exact issuer/subject, verified active identity/user/org/membership and current revocation are required.

The Auth0 RS256 SDK middleware verifies access tokens before the additional client, scope, purpose and expiry checks. The Express membership router returns only organization ID, membership role and applicationAccess:false. The composition factory validates separate staging config and joins the SDK router with the Prisma reader. It is deliberately unmounted from the Vercel entrypoint and no live service is contacted. Signed-token staging verification, MFA/session/CSRF policy, provider separation and the frontend BFF membership route are still open. No CRM data access or writes, role changes, enrollment, owner transfer, or invitations.

Files:
- backend/db/staging/001_identity_membership.sql: reviewable initial migration; no legacy data copied, no passwords or automatic migration. Requires separately approved provisioned roles and DB, and a migration principal permitted to create schema, manage grants/policies, and transfer object ownership to the two NOLOGIN roles. Review actual Neon role capabilities before applying; no claim of provider-compatible migration execution.
- backend/db/p4-stage.prisma: dedicated model and generated client; never use Prisma db push to bypass SQL RLS.
- backend/src/platform/staging-membership-{db,auth,integration}.ts: DB adapter, router, composition.
- Disposable CI runs actual SQL with fixture-only roles and Prisma lookup across two organizations, denied cross-tenant access, direct reads/writes, revocation, and privilege drift. Unit checks cover preview configuration, token shape and missing bearer token (not live signature verification).

Future preview configuration uses VERCEL preview metadata plus P4_VERCEL_SYNTHETIC_PREVIEW and P4_STAGE_MEMBERSHIP_ENABLED; P4_STAGE_DATABASE_HOST must match the exact approved isolated Neon host and P4_STAGE_DATABASE_URL must use p4_stage_runtime, zoho_clone_staging, and sslmode=verify-full. Stage Auth0 domain/audience/client ID are separate P4_STAGE_AUTH0_* variables. These switches do not constitute approval. Never set them until authorized. No secrets in Git.

Next owner checkpoint: select isolated staging project/region/budget, review R10-C1–C5 and staged migration/role plan. Separately authorize resource creation, migration and deployment before live testing. All 10 release gates, 14 risks, 12 decisions and original formal cases remain open. Formal exit NO_GO.
