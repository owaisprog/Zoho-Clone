# Zoho Clone

**Status:** P0.01-P0.03 approved/closed; P0.04 Customer Interview Playbook in progress.

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

- [docs/product/customer-interview-playbook.md](docs/product/customer-interview-playbook.md) - P0.04 interview protocol (draft, owner approval pending).
- [docs/product/interview-question-bank.md](docs/product/interview-question-bank.md) - interview questions and segment-specific probes.
- [docs/product/interview-execution-plan.md](docs/product/interview-execution-plan.md) - recruiting quotas, evidence handling and decision gates.

## Development approach

Follow the approved **Zoho Clone Complete AI Master Roadmap v2.0** (P0-P17 plus individual product tracks). Work on one sub-phase at a time, inspect the repository, implement and test the scoped change, record evidence, then advance after the required approval. Product discovery phases create documents; application scaffolding begins in P3.

## Important

This repository intentionally does not yet contain a working frontend or backend. Do not assume the project is deployable until its foundation, tests, infrastructure, and release gates are completed. Never commit passwords, API tokens, secrets, or actual customer payment data.
