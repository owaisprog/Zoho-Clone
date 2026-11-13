# Backend - Zoho Clone

**Status:** Directory initialized during P0.01. Application scaffolding is scheduled for P3.

## Locked technology choices

- Node.js + Express.js + TypeScript (not NestJS)
- PostgreSQL with Prisma migrations and typed database access
- Modular monolith architecture
- REST APIs documented with OpenAPI
- Redis + BullMQ when background work is introduced
- Secure managed OIDC authentication; centralized RBAC/ABAC
- Tenant-aware authorization, PostgreSQL RLS where appropriate, audit logs, and background workers

## Planned module structure

At the architecture phase, create modules with independent routers, controllers, services, repositories, Zod schemas, policies, and tests.

Initial platform modules: identity, organizations, memberships, permissions, app registry, subscriptions, entitlements, audit, files, notifications, integrations.

Initial business modules: CRM leads, contacts, accounts, pipelines, deals and activities; merchant agents, merchant records and onboarding applications.

Later modules: marketing, finance, HR, projects, support, inventory, analytics, AI, automation, and each additional product from the master roadmap.

**Not yet created:** package.json, src/, Prisma schema, database, environment secrets, server runtime.

Every business query must be organization-scoped. Never trust tenant IDs or permissions supplied by the browser.
