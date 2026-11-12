# Phase-by-phase engineering delivery

**Decision:** The owner requested direct phased application development. Product discovery remains an open commercial workstream and does not prevent reversible platform scaffolding.

| Milestone | Meaning | Status | Gate |
|---|---|---|---|
| Phase 0: discovery | Buyer/merchant workflow validation | Open | Real interview evidence |
| Phase 1: foundation spike | Next.js app, NestJS API, CI | Complete on develop | GitHub Actions passed |
| Phase 2A: data foundation | PostgreSQL schema, restricted runtime role, SQL isolation tests | **Verified on feature branch** | GitHub Actions SQL checks green |
| Phase 2B: identity boundary | Registration/invites, sessions, MFA requirements, tenant membership validation | Planned | End-to-end denial tests |
| Phase 3: shared app shell | Navigation, responsive states, accessibility | Started; expand later | UI acceptance |
| Phase 4: first CRM flow | Accounts, contacts, pipeline, activity with secured APIs | Planned | Tenant-safe CRUD tests |
| Phase 5: merchant onboarding | Checklists, status, assignment, audit history | Planned | Workflow tests |
| Later phases | Reports, jobs, integrations, billing, QA, pilot and production | Planned | Roadmap release gates |

## Rules
- Work is committed to an isolated feature branch and proposed as a PR to `develop`.
- Do not merge to `main` or deploy to production without an explicit release approval.
- Business features must not be exposed until authentication, server-side tenant checks, authorization and tests are ready.
- The Phase 0 commercial wedge is a proposal pending external validation.
- A check is considered passed only with an actual run result linked from GitHub Actions.
- Database migration SQL includes an isolated, disposable CI test database; no managed production database is provisioned yet.

## Phase 2A acceptance
- [x] SQL schema applied successfully against PostgreSQL 16.
- [x] Runtime role has no direct access to global users table.
- [x] Missing tenant context denies all tenant rows.
- [x] Tenant A and B are isolated for SELECT/UPDATE/DELETE.
- [x] Cross-tenant INSERT fails.
- [x] Cross-tenant foreign-key reference fails.
- [x] GitHub Actions run green. [PostgreSQL isolation](https://github.com/owaisprog/Zoho-Clone/actions/runs/43251953486) and [application checks](https://github.com/owaisprog/Zoho-Clone/actions/runs/43251953395).

## Verification record — 2026-11-12
- Database isolation workflow **success** on commit `d7c83dd`; PostgreSQL 16 migration, restricted runtime role and two-tenant synthetic SQL tests passed.
- Application workflow **success** on commit `d7c83dd`; dependency installation, TypeScript, API unit tests and web/API builds passed.
- Not yet complete: auth-backed tenant selection, migration version tracking, lockfile, actual managed database, CRUD API permission gates, Vercel preview, customer validation.
