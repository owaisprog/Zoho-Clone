# P3 Batch 04 — Synthetic PostgreSQL + Managed Auth Boundaries (P3.18–P3.22)

**Scope:** Owner-directed implementation of remaining P3 foundation work to the extent allowed by the existing **synthetic-only** internal development approval. This does not approve production identity, DB residency, final identifier strategy or a live pilot.

| Slice | Deliverable | Remaining authorization / verification |
|---|---|---|
| **P3.18** Prisma model draft | Prisma 7 provider PostgreSQL schema with multi-schema mapping for Organization, Membership, Lead and idempotency; composite tenant keys | Final key type/vendor OPEN-002; no generated Prisma Client/runtime connection; no production migrations |
| **P3.19** Relational PostgreSQL foundation | Idempotent-free, one-time synthetic-only SQL schema, strict fictional-only checks, multi-tenant FK (org + owner), forced RLS and index, fictional seed file | Production tenant model / DB credentials / retention decisions still OPEN |
| **P3.20** Query/data-access boundary | Parameterized SQL lead read adapter and transaction-scoped tenant+actor context; apply scoped owner predicate before list/count/record read; no contact SELECT for read-only role | No installed DB driver or live connection in Express; no write adapter; transactional DB performance unmeasured |
| **P3.21** Managed identity provider seam | Provider-neutral server-injected verification contract with required signature-verified flag, issuer/audience/expiry validation, synthetic actor projection and negative tests | OPEN-001 provider not selected; actual JWKS/session revocation/CSRF not implemented or claimed |
| **P3.22** Integration/security checks | GitHub Actions isolated PostgreSQL service, schema+fixtures, RLS/relational negative assertions; pinned Prisma CLI syntax validation, existing test/typecheck/build | Does not run 727 original P1 tests or independent security audit, production load/backup/recovery |

## Why this is still not production-ready

Our normal Express server is limited to process health and fixed publicly readable synthetic fixtures. It does NOT mount the protected internal CRM routes from P3.16. The PostgreSQL adapter does not connect to real infrastructure: it is injectable and validated by offline tests plus isolated PostgreSQL CI assertions. The SQL migration intentionally has only fake-org and example.com constraints, unsuitable for real customer datasets. No user-provided credentials, card numbers, bank information, KYC/KYB files or legal identity data are accepted.

The Prisma file is a **candidate schema only**. CLI validation checks schema syntax, not actual application connectivity, schema drift, migrations in a real environment, final tenant policy or Prisma Client queries. Prisma 7 driver adapter setup is deferred until approval, and Prisma 8 upgrade is a separate future decision.

## CI and local verification

~~~bash
npm ci
npm run typecheck
npm test
npm run build
~~~

For isolated PostgreSQL 17 testing (never production), apply in a disposable local DB using psql:

~~~bash
psql -X -v ON_ERROR_STOP=1 -f backend/db/migrations/001_synthetic_foundation.sql
psql -X -v ON_ERROR_STOP=1 -f backend/db/fixtures/001_synthetic_seed.sql
psql -X -v ON_ERROR_STOP=1 -f backend/db/tests/001_synthetic_isolation.sql
~~~

The test SQL runs assertions as a restricted no-login role with enforced RLS. Connection is restricted by transaction-local app.tenant_id/actor_id; real service adapters MUST verify the session, membership, action/record/field rights and set GUCs only after that verification. Setting GUCs is **not authentication** and application code must prevent any user-controlled SQL or DB connections.

## P3 exit checklist (actual evidence still required)

- [x] Actual Next.js + Express scaffold, locked npm CI, synthetic demo screens and test-only protected services in source.
- [x] Typed repository + field policy contract and cross-org in-memory integration tests.
- [x] Candidate Prisma model and PostgreSQL synthetic migration/seed files authored.
- [x] PostgreSQL transaction-bound, parameterized read adapter authored with query tests.
- [x] Managed-auth provider verification boundary (no selected/connected vendor).
- [ ] Owner review of P2.02 IA, P3 UX/source and final architecture.
- [ ] Select/approve managed identity vendor, opaque IDs, tenant/record scope decisions (OPEN-001/002/003).
- [ ] Bind a real verified provider to session handling, robust revocation and rate/CSRF safeguards.
- [ ] Install, configure and connect approved Prisma/pg adapter to a protected DB, implement atomic tenant-safe CRUD with immutable audit/idempotency.
- [ ] Run full original P1 acceptance/security test plan as applicable with real DB/identity, independent pen test, access control and recovery evidence.
- [ ] Obtain explicit internal/full P3 signoff; G-EXT/G-COM are separate future gates.

**Do not mark P3 or 727 original tests complete merely because isolated CI passes.**

All **14 original risks**, **12 open decisions**, and **727 original unexecuted acceptance/security cases** remain as prior, as do 40 additional P2.02 IA design checks. No external or paid launch authorization.
