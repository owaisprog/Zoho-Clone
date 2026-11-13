# Zoho Clone

**Status:** P0.01–P0.04 approved/closed; P0.05 skipped by owner with 0/3 real workflows validated; **P0.06 design rules owner-approved and closed; P0.07 MVP Value Proposition in progress**.

Zoho Clone is the working name of an original, AI-led, multi-tenant SaaS ecosystem designed to provide integrated business applications. The long-term scope is comparable in breadth to the Zoho ecosystem, but the software, code, branding, and user experience will be independently developed.

## Repository structure

- [frontend/](frontend/README.md) - Next.js, React, TypeScript, Tailwind CSS and shadcn/ui (scaffold scheduled for P3).
- [backend/](backend/README.md) - Node.js, Express.js, TypeScript, PostgreSQL, Prisma, Redis and BullMQ (scaffold scheduled for P3).
- [docs/product/vision.md](docs/product/vision.md) - P0.01 Business Vision Charter.
- [docs/product/decisions.md](docs/product/decisions.md) - Product and technical decisions.
- [docs/roadmap-progress.md](docs/roadmap-progress.md) - Active roadmap checkpoint.

- [docs/product/icp.md](docs/product/icp.md) - P0.02 Customer Segment Map (owner-approved initial segment ranking; customer validation later).

- [docs/product/competitive-capability-matrix.md](docs/product/competitive-capability-matrix.md) - P0.03 vendor capability comparison (owner-approved research baseline; prospect validation pending).
- [docs/product/competitive-evidence.md](docs/product/competitive-evidence.md) - Official vendor source register and evidence limitations.

- [docs/product/customer-interview-playbook.md](docs/product/customer-interview-playbook.md) - P0.04 interview protocol (owner-approved; 0 of 15-25 target interviews actually completed).
- [docs/product/interview-question-bank.md](docs/product/interview-question-bank.md) - interview questions and segment-specific probes.
- [docs/product/interview-execution-plan.md](docs/product/interview-execution-plan.md) - recruiting quotas, evidence handling and decision gates.

- [docs/product/p0-04-interview-shortfall.md](docs/product/p0-04-interview-shortfall.md) - explicit research shortfall and owner handoff.
- [docs/product/workflow-maps.md](docs/product/workflow-maps.md) - P0.05 draft ISO, POS and PayFac swimlanes (unvalidated).
- [docs/product/workflow-validation.md](docs/product/workflow-validation.md) - three real-world workflow validation gate.
- [docs/product/workflow-scenarios.csv](docs/product/workflow-scenarios.csv) - 20 synthetic future test scenarios.

- [docs/product/p0-06-data-sensitivity-prework.md](docs/product/p0-06-data-sensitivity-prework.md) - archived P0.06 preliminary notes; replaced by active draft inventory.

- [docs/product/p0-05-validation-waiver.md](docs/product/p0-05-validation-waiver.md) - owner-directed P0.05 skip (not completed).
- [docs/product/data_classification.md](docs/product/data_classification.md) - P0.06 owner-approved data classification design (not implemented certification).
- [docs/product/data-inventory.csv](docs/product/data-inventory.csv) - 36 candidate data categories.
- [docs/product/prohibited-fields.md](docs/product/prohibited-fields.md) - initial CRM sensitive-data exclusions.
- [docs/product/file-handling-policy.md](docs/product/file-handling-policy.md) - future private-file safety policy.
- [docs/product/p0-06-security-review.md](docs/product/p0-06-security-review.md) - P0.06 risk/design review; jurisdiction and security implementation remain open.

- [docs/product/positioning.md](docs/product/positioning.md) - P0.07 MVP positioning draft.
- [docs/product/landing-copy.md](docs/product/landing-copy.md) - P0.07 two landing copy concepts (not published).
- [docs/product/value-validation-plan.md](docs/product/value-validation-plan.md) - P0.07 measurable customer value test.
- [docs/product/value-claims.csv](docs/product/value-claims.csv) - proposed marketing claims and evidence restrictions.

## Development approach

Follow the approved **Zoho Clone Complete AI Master Roadmap v2.0** (P0-P17 plus individual product tracks). Work on one sub-phase at a time, inspect the repository, implement and test the scoped change, record evidence, then advance after the required approval. Product discovery phases create documents; application scaffolding begins in P3.

## Important

This repository intentionally does not yet contain a working frontend or backend. Do not assume the project is deployable until its foundation, tests, infrastructure, and release gates are completed. Never commit passwords, API tokens, secrets, or actual customer payment data.
