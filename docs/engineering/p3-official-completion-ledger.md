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
| P3.05 | PostgreSQL and migrations | synthetic SQL, fixtures, disposable CI/Compose; real Neon dev project `small-river-48696124` with restricted reader, forced RLS; owner-reported Neon Prisma smoke PASS 2026-11-20 (PR #53) | **SYNTHETIC DEV MILESTONE VERIFIED**; overall PARTIAL: no approved staging DB, secure production roles, migration drift or backup/restore proof |
| P3.06 | ORM and SQL conventions | pinned Prisma 7; transaction-scoped RLS Prisma reads pass in CI and owner-reported actual Neon restricted-role Prisma CLI smoke PASS 2026-11-20 | **SYNTHETIC DEV MILESTONE VERIFIED**; overall PARTIAL: final key/ACL design not approved; no real staging migration, writes or production ORM use |
| P3.07 | Environment configuration | strict PORT/HOST, runtime local/CI profile deny, partial Auth0 fail-closed startup, Next.js NEXT_PUBLIC secret guard, tracked-source secret signatures + CI tests, environment/rotation runbook | PARTIAL: source safeguards added; no owner-approved staging secret store, credentials, provider region/cost, rotation or release policy |
| P3.08 | Developer stack (Neon-first owner deviation) | Real owner-reported Neon Prisma smoke PASS, Docker-free local preflight and npm scripts with CI negative tests; disposable Postgres and Redis remain in CI | PARTIAL: owner machine cold-boot of the complete frontend + backend + optional worker environment still not evidenced |
| P3.09 | CI pipeline | Node 22 typecheck, 121 automated tests, builds, synthetic SQL/Prisma isolation, limited secret scan, staging URL checks, Node-first local preflight; CI 4/4 PASS #44626354724 | PARTIAL: repository admin must enforce protected main/required checks; formal lint/format and dependency policy open |
| P3.10 | CD and staging | health+rollback runbook, manual gated staging workflow and HTTPS staging-host validator with negative tests; no production or customer data exposed | BLOCKED: missing owner-authorized staging domain/provider/budget/secrets and actual deploy+rollback acceptance |
| P3.11 | Observability | server-owned UUID request IDs and structured privacy-safe logs; in-process fixed-bucket status/method/latency metrics with no public endpoint; negative privacy tests | PARTIAL: owner error tracker, OTel exporter, private sink, alert proof and retention/region policy pending |
| P3.12 | Object storage design | provider-neutral private adapter (disabled by default); metadata MIME/size/filename/checksum candidate validator and security tests; storage/scan design and ADR 0006 | PARTIAL: provider/region/malware/retention review, owner approval and live scanning not performed |
| P3.13 | Identity provider selection | Auth0 owner-selected, owner-reported local login/session/identity-only token acceptance and logout; added issuer/forged-token tests and release checklist | PARTIAL: MFA, access-token revocation/refresh, quotas/region, invitations, real tenant permissions and staging acceptance still pending |
| P3.14 | Architecture decision records | ADR 0001–0006 now document modularity, tenancy, identity, Neon-first vs Docker, queues, observability, storage and reversibility; ADR 0001 approved | PARTIAL: ADR 0002–0006 and full P3 exit require owner review/approval |

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

## Owner development database choice (2026-11-17)

Owner explicitly prefers **Neon PostgreSQL** for their development database
instead of running local PostgreSQL in Docker. PR #53 includes TLS-constrained,
read-only Neon Prisma smoke code, a development environment example, restricted
role/SQL setup and [Neon setup runbook](p3-neon-development-setup.md). This
preserves **Auth0** as the chosen identity provider. Until the owner-controlled
Neon account and an isolated empty development database are inspected and
a live Neon smoke passes, a real Neon runtime connection is **NOT verified**.

GitHub Actions continues to use an isolated disposable local PostgreSQL
container for reliable synthetic negative tests; local developers do not
need Docker to connect to Neon. Actual Neon region, data residency, account
budget and credential lifecycle are subject to owner approval.

In [GitHub Actions run #44138900427](https://github.com/owaisprog/Zoho-Clone/actions/runs/44138900427),
**96 scaffold tests passed** (40 frontend, 51 backend, 5 shared) and
4/4 jobs passed. Those tests validate the Neon configuration guard, but do
not claim connected Neon cloud database acceptance.

## Connected Neon cloud setup and direct SQL acceptance (2026-11-19)

The connected Neon account changed relative to an earlier session: a previous
project named `zoho-clone-development` was **not visible** in the account
that this session could access (HTTP 404 for the prior project ID). Rather
than altering one of its four unrelated existing projects, a **new isolated
Neon development project** was created in the currently connected account:
[zoho-clone-development](https://console.neon.tech/app/projects/small-river-48696124),
project `small-river-48696124`, AWS Ohio `aws-us-east-2`, PostgreSQL 17,
`development` branch `br-curly-sky-beukwxf9`, database `zoho_clone_synthetic`.

An empty-database preflight passed. The exact SQL for
`backend/db/migrations/001_synthetic_foundation.sql` and
`backend/db/fixtures/001_synthetic_seed.sql` was applied in isolated
transactions. Four `synthetic` tables were created with RLS **enabled and
forced**; all four have their respective policies. Fictional seed data is
loaded. A Neon scoped `read_only` role `p3_neon_reader` was created for
the `synthetic` schema and specific database. Direct Neon SQL queries
confirmed: role is not a superuser, bypass-RLS role or neon_superuser member;
has SELECT and schema USAGE; cannot INSERT, UPDATE or DELETE.

Connected to Neon **as p3_neon_reader**, direct SQL verified:
default deny of all leads/organizations/memberships with no context;
Alice owner-scoped lead count = 1; Bob tenant-wide count = 2;
Carla in second tenant count = 1; inactive Eve count = 0;
cross-tenant actor count = 0; and after transaction scope, count
returns to zero. **These are live cloud SQL acceptance checks,
NOT a passing local Prisma CLI smoke.** The owner's
`backend/.env.neon.local` could not be updated through this integration;
the developer must point it at this specific new Neon project and
its restricted role, then rerun `npm run smoke:synthetic-neon -w backend`.
Neon authentication secrets were never committed to GitHub.
Account identity, cost limits, region approval, real tenant mapping, staging
and production remain open. Do not close P3 based on these synthetic tests.

## Owner-confirmed local Neon Prisma smoke PASS (2026-11-20)

On 2026-11-20 the owner ran
`npm run smoke:synthetic-neon -w backend` on their Mac and reported:

```text
P3.05/06 Neon synthetic Prisma read-only RLS smoke: PASS
```

This **supersedes the historical 'local smoke not yet passed' status** in the
2026-11-19 note above. The owner-reported CLI result, combined with actual
Neon role-based SQL checks and the CI synthetic tests, verifies the
P3.05/P3.06 **development synthetic read-only acceptance milestone**.
The user did not disclose credentials and no secret was committed.
It does **not** close the overall P3.05/P3.06 official gates (staging,
production credential handling, Auth0-to-membership mapping, approved
tenant/record permissions, migration/drift, writes, backup/restore and
original P1 acceptance cases). Continue with P3.07 environment and secrets
management without production deployment.

## P3.07 source boundary implementation (2026-11-20)

Development branch PR #53 implements P3.07 **source-level local/CI
environment controls**, not cloud staging secrets. The actual Express
startup enforces `P3_APP_ENV=local|ci` and rejects partial Auth0
configuration or secret-bearing `NEXT_PUBLIC_` keys. The Next.js build
also rejects secret-bearing public-prefixed environment values.
`scripts/check-tracked-secrets.mjs`, negative tests and GitHub Actions
provide a limited credential-pattern guard in addition to existing
tracked-path checks. See
[P3.07 environment & secrets management](p3-environment-secrets-management.md).
These controls never read or commit the owner's private Auth0/Neon URLs.
**Staging vault, credential lifecycle, incident rotation, GitHub branch
protection and owner-approved deployment are outstanding.** P3.07 remains
PARTIAL and does not close other original risks or test cases.

## P3.08–P3.14 implementation batch and CI evidence (2026-11-20)

The owner requested completion of all seven remaining P3 implementation
subphases in one batch. Source and documentation were committed to the
existing draft PR #53, without merging or exposing production resources.
See [P3.08–P3.14 detailed execution](p3-08-to-14-execution.md).

[GitHub Actions run #44626354724](https://github.com/owaisprog/Zoho-Clone/actions/runs/44626354724)
reported **4/4 jobs PASS**. Executed automated tests: **42 frontend +
66 backend + 5 shared + 8 Node safety/preflight = 121 tests PASS, 0 FAIL**.
The tracked-source limited secret scan and Docker-free CI preflight also
passed. Local Mac Neon Prisma PASS was previously owner reported.

**Official master P3 exit: NOT APPROVED.** Staging deployment+rollback,
real monitored exporter, owner cloud spend/region approval, protected
main/required CI, critical ADR signoff, Auth0 MFA/revocation/quotas, private
object-store provider and actual customer authorization gates remain open.
The official P3.10 CD/staging requirement is especially not complete;
P3.08–P3.14 code delivered must not be mislabeled as final phase closure.
All original 727 P1.09 acceptance cases remain NOT RUN.

## Explicit unchanged gates

All original 14 tracked risks, 12 unresolved decisions and 727
P1.09 acceptance/security cases remain OPEN / NOT RUN. They should not
be silently closed by P3 demo unit tests. P2.02 information architecture
owner approval remains pending. External and commercial gates remain
BLOCKED. **P3 is not fully exited.**

The expected PDF exit requires a running workspace, approved ADRs,
automated checks and a *tested staging path*. No live production data.
