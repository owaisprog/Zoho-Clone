# ADR 0005 — Neon-first local development, isolated CI PostgreSQL

Status: **IMPLEMENTED FOR SYNTHETIC DEVELOPMENT / OWNER CLOUD REVIEW OPEN**
Date: 2026-11-20
Master: P3.05–P3.10.

## Decision

- PostgreSQL remains the primary database; Prisma 7 remains pinned.
- Use **Neon** for developer-connected PostgreSQL instead of requiring the
  user to run PostgreSQL in Docker on their Mac. Use only the dedicated
  `zoho_clone_synthetic` database, restricted `p3_neon_reader` role,
  validated TLS URL and fictional records in a private local env file.
- GitHub Actions still starts an isolated disposable PostgreSQL test service
  and local Compose fixtures for repeatable destructive, RLS and migration
  tests. This does not imply the owner must install Docker.
- Keep the Express runtime disconnected from the Neon smoke credential.
  Auth0 identity-only routes have no tenant/data entitlement.

## Tradeoffs and alternatives

Neon avoids Docker setup and allows real managed Postgres TLS verification,
but depends on network availability, quotas and account/region ownership.
CI disposable Postgres avoids cloud credentials and shared data corruption,
but requires maintaining seed/migration parity. Alternative local Docker-only
development remains possible as a CI path, not the owner default.

## Reversibility and extraction triggers

If cloud isolation/region/cost becomes unacceptable, use a disposable
PostgreSQL instance with the existing Prisma schema, reviewed forward
migrations, DB roles and identical synthetic acceptance tests. Do not
migrate customer data automatically. Reassess when multi-region residency,
tenant partitioning or growth requires a different topology.

## Approval boundary

Owner reported actual restricted Neon Prisma smoke PASS 2026-11-20;
this is development evidence only. Region, paid costs, staging, production
backups, data key strategy and security approval remain outstanding.


## Architecture v1.0 (2026-11-20)
The owner approved the shared PostgreSQL/Prisma tenant model but **did not authorize applying CI-only SQL candidates to Neon or connecting customer workloads**. The prior Neon development account stays synthetic-only with its existing restrictions. New UUIDv4 schema design needs separate reviewed migration/staging tests. [ADR 0007](0007-architecture-v1-owner-approval.md).


## P4 Prisma development isolation (2026-11-20)
The approved new CI Prisma client targets **only** `p4_v1_ci` in disposable `zoho_clone_synthetic_ci` on localhost with GitHub Actions environment checks; it is not the owner's existing Neon schema or development credential. Its signed-in user is a fixed fictional UUID fixture, not live Auth0. The original Neon read-only smoke setup remains untouched. [CI #44745186348](https://github.com/owaisprog/Zoho-Clone/actions/runs/44745186348) passed. Paid/staging/production provider and real migrations remain unapproved.
