# Official master PDF P3.01–P3.14 reconciliation (2026-11-16)

This tracker is anchored to the **225-page 2026-11-13 Express.js master
roadmap** pages 24–29; it supersedes use of P3.01–P3.22 labels as
official sub-phase IDs. Those labels previously represented implementation
batches rather than the PDF's requirements.

Legend: `IMPLEMENTED` = source present; `PARTIAL` = source/design exists
but acceptance unverified; `BLOCKED` = owner/external action necessary.
Do not mark original P3 exit complete unless all mandated gates pass.

| Master ID | Item | Current evidence | Gate |
| --- | --- | --- | --- |
| P3.01 | GitHub repo baseline | README, CONTRIBUTING, CODEOWNERS and PR CI | PARTIAL: owner must enable protected main + required checks and clean clone test |
| P3.02 | Monorepo workspace | npm workspace with reproducible lockfile, Next/Express/shared; owner approved npm instead of PDF pnpm/Turbo on 2026-11-17 | PARTIAL: package-manager decision APPROVED; remaining module/package boundaries and clean build acceptance need review |
| P3.03 | Next.js foundation | App Router synthetic preview, themes and build CI | PARTIAL: owner P2 IA + UI review and smoke evidence |
| P3.04 | Modular Express backend | health/live, health/ready (fail closed), structured 404, existing internal seams | PARTIAL: status verified only after CI; no real dependency readiness |
| P3.05 | PostgreSQL and migrations | synthetic SQL, fixtures, disposable CI/Compose, read-only restricted PostgreSQL login and live local Prisma smoke (PR #53) | PARTIAL: no approved staging DB, secure production roles, migration drift or backup/restore proof |
| P3.06 | ORM and SQL conventions | pinned Prisma 7 client/adapter generated at build; actual transaction-scoped RLS Prisma reads and negative isolation pass in disposable Compose CI | PARTIAL: final key/ACL design not approved; no real staged migration drift, writes or production ORM use |
| P3.07 | Environment configuration | strict PORT/HOST and secret-free source, .env.p3.example | PARTIAL: secret manager and approved production env not configured |
| P3.08 | Docker local developer stack | disposable local-only PostgreSQL + Redis with fictional seed and read-only Prisma smoke pass in GitHub CI | PARTIAL: owner-machine cold boot still not evidenced |
| P3.09 | CI pipeline | node typecheck, test, build, isolated PG test and Prisma validation | PARTIAL: owner must configure required status checks; lint/supply-chain policy pending |
| P3.10 | CD and staging | local smoke and staging/rollback scripts, runbook | BLOCKED: no staging cloud account, credentials or verified deployment |
| P3.11 | Observability | server-owned request ID, structured redacted finish log | PARTIAL: owner error tracker, OTel and managed log sink pending |
| P3.12 | Object storage design | private adapter contract and policy, deny-by-default | PARTIAL: requires design review; live object storage intentionally disabled |
| P3.13 | Identity provider selection | Owner selected Auth0 on 2026-11-17; owner-reported local login, Next.js session, Express JWT acceptance and post-logout `unauthenticated` check passed; CI source tests in PR #53 | PARTIAL: positive identity and session-logout paths verified locally; MFA, expiry/revocation, quotas/region, invitations, tenant permissions and staging acceptance pending |
| P3.14 | Architecture decision records | ADR 0001–0004 cover modularity, tenancy, identity, ops/storage; ADR 0001 stack/workspaces choice approved 2026-11-17 | PARTIAL: ADR 0002–0004 and overall P3 acceptance still require owner review |

## Owner decision recorded (2026-11-17)

Owner approved Next.js/React/TypeScript, Tailwind/shadcn, Node/Express/TypeScript,
PostgreSQL/Prisma, Redis/BullMQ when required, a modular monolith, and **npm
workspaces instead of pnpm/Turbo**. This accepts the documented P3.02 toolchain
deviation; it does **not** approve identity vendor, real database/tenant keys,
row/field permissions, hosting region, cloud spend, staging or production.
For evidence and scope see [ADR 0001](../adr/0001-platform-and-tooling.md).

## Identity vendor approval (2026-11-17)

Owner explicitly approved **Auth0** (not Clerk) as the P3.13 managed
identity provider. Owner subsequently configured a development tenant and
reported successful local login and authenticated JWT acceptance through the
Next.js-to-Express identity-only endpoint on 2026-11-17. This does NOT
verify organization/permission enforcement, account costs/region, MFA,
revocation, invite acceptance, staging or external release authorization. See [ADR 0003](../adr/0003-managed-identity.md) and the
[owner-facing Auth0 setup](p3-auth0-setup.md).

## P3.05/P3.06 synthetic runtime evidence (2026-11-17)

PR #53 added `@prisma/client`, `@prisma/adapter-pg`, `pg`, pinned
Prisma 7 generator and reproducible npm lockfile. Only a **local-only CLI**
uses a restricted `p3_preview_runtime` role; normal Express endpoints are
unchanged. In [GitHub Actions run #44135572204](https://github.com/owaisprog/Zoho-Clone/actions/runs/44135572204), **93 unit tests passed** (40 frontend, 48 backend, 5 shared), and all **4/4 jobs** passed, including disposable PostgreSQL RLS/Prisma transaction smoke. The Prisma smoke checked default-deny, cross-tenant and revoked-membership results, owner scoping and transaction cleanup. These are not real-data or original P1 acceptance tests. See [synthetic Prisma runbook](p3-synthetic-prisma-runtime.md).

## Explicit unchanged gates

All original 14 tracked risks, 12 unresolved decisions and 727
P1.09 acceptance/security cases remain OPEN / NOT RUN. They should not
be silently closed by P3 demo unit tests. P2.02 information architecture
owner approval remains pending. External and commercial gates remain
BLOCKED. **P3 is not fully exited.**

The expected PDF exit requires a running workspace, approved ADRs,
automated checks and a *tested staging path*. No live production data.
