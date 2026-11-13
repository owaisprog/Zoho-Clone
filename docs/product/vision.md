# P0.01 - Business Vision Charter

**Project:** Zoho Clone  
**Version:** 0.1 (draft for owner approval)  
**Created:** 2026-11-13  
**Status:** DRAFT - NOT YET APPROVED  
**Roadmap:** Zoho Clone Complete AI Master Roadmap v2.0, P0.01

## 1. Mission

Build an original, modular, multi-tenant SaaS ecosystem where a company can sign up once, manage employees and permissions centrally, and subscribe to individual or bundled business applications. The long-term functional catalog targets every identified major Zoho product area, including smaller applications and IT/developer products. Exact parity with every proprietary Zoho implementation is not presumed.

The platform uses original code, information architecture, branding, and business rules. `Zoho Clone` is a working repository/project label, **not** approved market-facing branding or an assertion of affiliation with Zoho Corporation.

## 2. Business problem

Businesses often use disconnected software for leads, agents, operations, support, accounting, personnel, marketing and analysis. Fragmented data creates duplicate work, inconsistent permissions, manual handoffs and poor visibility. Customers should be able to adopt only the modules they need while preserving a common identity, organization, subscription and audit foundation.

For the first release, payment-service organizations may face especially costly workflows around lead handoffs, agent relationships, merchant onboarding status and operational reporting. This focused first market is a **strategic hypothesis requiring validation**, not an assertion that the niche lacks competitors.

## 3. Long-term product vision

- One identity and organization account across all applications.
- Strong tenant isolation, record-level authorization, and controlled shared data.
- Application launcher, central administration, billing, subscriptions, entitlements and usage metering.
- Individual applications and bundles, including free/trial/paid/enterprise options when commercially validated.
- Integrated CRM, sales, marketing, finance, accounting, billing, payments, HR, projects, customer support, communications, collaboration, analytics, AI, automation, inventory, procurement, websites/e-commerce, low-code/developer tools, security, and IT management.
- Specialized vertical products, including agent/reseller and merchant operations.
- Well-defined APIs, events, webhooks, external integrations and partner/marketplace infrastructure.
- Scalable architecture that allows selected modules to evolve independently.

**Scope rule:** Every identified product and major feature remains on the *long-term roadmap*. This does not make all functionality part of the first release.

## 4. First commercially usable product (proposed)

**Working product:** Merchant Operations CRM.

**Initial users:** Merchant-services organizations, ISOs, POS providers/resellers, and related payment-industry B2B operators.

**Core initial workflow:**
1. A company signs up and creates its tenant organization.
2. An administrator invites employees, assigns roles and selects a plan.
3. Salespeople capture and qualify leads, manage companies/contacts and progress deals.
4. Operations staff manage agent/reseller and merchant records.
5. Staff create merchant onboarding applications, assign reviews, change permitted stages, and track tasks.
6. Managers monitor pipeline and onboarding progress; permitted users import/export records.
7. Users receive notifications and are restricted by subscription entitlements and record permissions.

**Out of initial scope:** Native card processing, production underwriting, payout execution, full residual calculation, accounting general ledger, payroll, native mail hosting, full app builder, marketplace, and autonomous AI agents.

## 5. Target customers and buying jobs (hypotheses)

| Segment | Primary buyer | Job to be done | Initial priority |
| --- | --- | --- | --- |
| ISO / merchant services provider | CEO, COO, Head of Operations | Centralize agent, merchant and onboarding activity | Proposed #1 |
| POS reseller / payments partner | Founder, Operations Manager | Track merchant acquisition and deployment status | Proposed #2 |
| PayFac / payment software provider | Operations/Product leader | Integrate specialized operational workflows | Proposed #3 |
| General small/medium business | Founder, Sales/Ops manager | Manage CRM and later multiple business apps | Expansion market |
| Enterprise departments | IT/Product/Ops leadership | Govern many applications, security and data flows | Long-term |

P0.02 must test and rank these segments with real evidence.

## 6. Differentiation hypotheses

- A focused, easy-to-learn workflow for the initial industry, rather than a generic CRM setup.
- Faster visibility into agents, merchants and application bottlenecks.
- Affordable modular adoption: customers subscribe only to the applications they use.
- Reusable cross-application identities, data links, automations and dashboards.
- Original interfaces and open integration surfaces, with transparent usage limits.

These advantages must be measured against NMI Merchant Central and other incumbents rather than assumed.

## 7. Commercial model (proposal, not validated pricing)

- Organizations, not individual merchants, are the initial direct SaaS customers.
- Application-specific subscriptions and suite bundles.
- Trial periods, internal-user seats, external portal seats, feature entitlements and usage-based add-ons where appropriate.
- Proposed merchant-operations price experiments from the prior roadmap: Starter $149, Growth $399, Scale from $999 per organization per month, subject to discovery, real cost structure and customer validation.
- Explicit contracts, renewal terms, cancellation handling and export policies.

No billing price, payment provider, country of incorporation or merchant-facing branding is finalized by this charter.

## 8. Non-negotiable engineering principles

1. **Chosen stack:** Next.js + React + TypeScript + Tailwind CSS + shadcn/ui frontend; Node.js + Express.js + TypeScript backend; PostgreSQL + Prisma; Redis/BullMQ as needed.
2. **Architecture:** A modular monolith initially, with explicit bounded contexts, shared contracts and an event/outbox approach.
3. **Isolation:** Each business record belongs to an authenticated/authorized organization. Tenant isolation and record permissions are checked on the server and tested.
4. **Security:** No production data or secrets in source control; risk-appropriate data classification, logs, backups, recovery tests and compliance review.
5. **Quality:** Every feature has acceptance criteria, automated tests, responsive/error states and observable production behavior.
6. **Development order:** Preserve the master roadmap P0-P17 and the separate product tracks; each sub-phase is completed with verifiable evidence before closure.
7. **Maintainability:** No premature microservices/Kubernetes. Evolve infrastructure based on measured needs.
8. **Originality:** Do not copy Zoho code, visual assets, brand identifiers, or proprietary content.

## 9. AI-led development and owner responsibilities

**ChatGPT role:** Research and planning; architecture proposals; code and tests; repository edits when connected and authorized; review/debugging; documentation; deployment instructions and permitted actions; verification of available results.

**Product owner role:** Approve product scope, positioning and branding; provide customer evidence; own GitHub/cloud/billing accounts; configure external provider access and securely manage credentials; approve commercial spending, legal terms, sensitive-data handling and production releases.

AI can execute available tools during an active session. It cannot guarantee unsupervised background maintenance or replace independent security/compliance evidence when required.

## 10. Proposed measurable success criteria

### P0 validation criteria - proposal pending owner approval
- 15-25 interviews across relevant decision-makers (first target, not a guaranteed outcome).
- 5 qualified design partners who validate the chosen workflow problem.
- 2 potential paid pilots or comparable documented commercial intent.
- Approved ranking of customer segments, measurable pain statements and a build/no-build decision.

### First commercial release - planning criteria
- At least one tenant completes registration, team onboarding, CRM and merchant-application workflows end-to-end.
- Automated cross-tenant, authorization, billing and critical-path E2E tests pass.
- No open critical/high security findings; tested backup restoration.
- Real pilot users complete prioritized workflows; measured time-to-value and adoption.
- First paid organization and repeatable onboarding process.

### Long-term success measures
- Applications adopted per customer, retention, churn, incident rate, support burden, gross margin, cost per tenant, and partner/developer adoption.
- Each new application has its own customer validation and independent release gate.

## 11. Dependencies and delivery sequence

P0 market and vision validation -> P1 product requirements -> P2 UX -> P3 architecture/scaffolding -> P4 identity/tenancy/permissions -> P5 CRM -> P6 billing -> P7 integrations -> P8 merchant operations -> P9 shared data -> P10 AI -> P11 analytics -> P12 security/QA -> P13 production -> P14 operations -> P15-P17 expansion. Parallel work is allowed only after dependency and security review.

## 12. Open decisions requiring owner confirmation

- [ ] Approve or revise this mission and long-term breadth.
- [ ] Confirm the first customer segment and whether merchant operations is the initial product.
- [ ] Confirm target selling regions and legal/commercial operating jurisdiction.
- [ ] Confirm owner-approved positioning and market-facing brand (working repo name may remain Zoho Clone).
- [ ] Confirm the proposed P0 validation success criteria.
- [ ] Approve P0.01 closure and authorize beginning P0.02.

## 13. Acceptance and sign-off

**P0.01 completion requires:** The charter defines vision, target customers, app scope, constraints and measurable product objectives; contradictions are reviewed; the decision log is updated; and the product owner explicitly approves the charter.

**Current state:** Draft complete and stored in GitHub. **Owner approval pending.** P0.01 must not be marked complete until approval is received.
