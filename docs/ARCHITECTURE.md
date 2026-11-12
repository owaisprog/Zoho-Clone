# Proposed Technical Architecture (Decision Pending)

This describes a **provisional** engineering direction for a modular Business OS. Changes require an architecture decision record before foundational implementation.

## Recommended foundation
- Monorepo with TypeScript across web, API and shared packages.
- Web: Next.js App Router, React, Tailwind CSS and an accessible component system.
- API: NestJS modular monolith, versioned REST endpoints and OpenAPI contracts.
- Database: PostgreSQL with explicit tenant identifiers and defense-in-depth tenant isolation; consider RLS with disciplined session scoping.
- ORM/migrations: select and approve after a proof of concept for tenancy and migration workflows.
- Background jobs: outbox-backed queue and idempotent workers.
- Object storage: private buckets, signed URLs, retention policies and scanning where appropriate.
- Auth: centrally managed identity, organization membership, MFA/SSO roadmap and least-privilege roles.
- Monitoring: structured logs, traces, metrics and audit trail separated by purpose.

## Planned repository structure (not yet created)
```
apps/
  web/         # Next.js dashboard
  api/         # NestJS API
  worker/      # async jobs
packages/
  ui/
  config/
  contracts/
  database/
docs/
infra/
```

## Tenancy invariants
1. Every tenant-owned resource has a tenant scope and server-enforced ownership checks.
2. Never rely on a browser-supplied tenant ID alone for authorization.
3. Integration keys are scoped, rotated and stored in a secret manager.
4. Migrations and background workers are tested for cross-tenant access.
5. All sensitive operations generate a structured audit event.
6. Verify tenant isolation with automated negative tests before pilot access.

## Deployment boundaries
- Vercel is a candidate for the Next.js web preview and frontend.
- NestJS API, worker and managed PostgreSQL require separate suitable hosting unless a validated alternate design is chosen.
- Development/staging/prod environments must use separate secrets, datasets and deployment gates.
- No production deployment until security, backup/restore, observability and rollback checks are recorded.

## Important exclusions
- Avoid hosting raw card details, CVV, or payment credentials. Use approved payment provider integrations when necessary.
- Do not claim PCI, SOC 2, GDPR or other compliance status without completed assessment and evidence.
