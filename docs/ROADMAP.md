# Zoho-Clone / Business OS — Development Roadmap

**Document version:** 0.1 | **Updated:** 2026-11-12 | **Implementation:** ChatGPT-led; product owner approves gates.

## Vision
Build a branded, modular, multi-tenant business software ecosystem, inspired by the breadth of integrated business suites, **not** a copy of Zoho's proprietary code, UI or branding.

The initial **proposed** commercial wedge is a MerchantOps CRM and operations platform sold to payment-industry companies (ISOs, PayFacs, POS providers and merchant services firms), not directly to their merchants. This wedge remains subject to Phase 0 validation.

## Delivery phase registry

| Phase | Focus | Current status | Exit gate |
|---|---|---|---|
| P0 | Customer discovery and MVP validation | **In progress** | Evidence-backed proceed/narrow/pivot decision |
| P1 | PRD, workflows and acceptance criteria | Not started | Approved requirements baseline |
| P2 | Repo, environment, CI and application foundation | Not started | Green build/test pipeline and preview |
| P3 | Identity, organizations, tenant boundaries and RBAC | Not started | Verified access controls and isolation tests |
| P4 | Design system, navigation and shared shell | Not started | Accessible responsive app shell |
| P5 | CRM core: companies, contacts, pipeline, activities | Not started | End-to-end tested core workflows |
| P6 | Merchant onboarding and operations | Not started | Approved application/review workflow |
| P7 | Automation, tasks and notifications | Not started | Auditable, retry-safe jobs |
| P8 | Integrations, APIs and webhooks | Not started | Authenticated, idempotent integrations |
| P9 | Reporting, exports and dashboards | Not started | Correctness and permission tests |
| P10 | Billing, plans, entitlements and subscriptions | Not started | Verified subscription lifecycle |
| P11 | Admin, audit logs, tenant management | Not started | Auditable operational controls |
| P12 | QA, security, reliability and performance | Not started | Release readiness checklist |
| P13 | Pilot rollout, feedback and product iteration | Not started | Approved pilot metrics |
| P14 | Production launch and operations | Not started | Deployment/rollback/runbook verified |
| P15 | Expand adjacent apps: support, projects, marketing | Not started | Module-level release gates |
| P16 | Broader suite: finance, people and analytics | Not started | Domain controls and integrations |
| P17 | Enterprise platform, AI and extensibility | Not started | Enterprise/security gates |

Phase numbers are planning identifiers. Exact scope can change by an approved decision entry and versioned change record. The next phase may involve planning activities before code; **approval to start does not imply permission to deploy to production**.

## First milestones
1. P0: interview qualified buyers, verify workflows and willingness to pilot; record evidence and decision.
2. P1: convert validated problem into user stories, permissions, data model and acceptance checks.
3. P2: scaffold Next.js web, NestJS API, PostgreSQL, shared packages, testing and CI in a monorepo.
4. P3–P6: implement secure identity/tenancy and first usable MerchantOps flows.
5. Subsequent phases: integrations, billing, ops and production hardening; expand suite iteratively.

## Accountability
- **Product owner (user):** commercial direction, account authorization, sensitive decisions and go/no-go approvals.
- **ChatGPT:** documentation, code changes, tests and reviews executed in active sessions using available connected tools.
- **External verification:** independent security/compliance assessment recommended before real sensitive or regulated data goes live.

Only mark a phase complete after recording verification evidence and owner acceptance. No claims of tests, pushes, previews or deployments without links/logs.
