# ADR 0001 — Express modular monolith and engineering toolchain

Status: **OWNER APPROVED — STACK, PACKAGE MANAGER AND MODULAR MONOLITH ONLY** — 2026-11-17
Source: master PDF P3.01–P3.14 and Appendix I.

## Owner-approved architecture (2026-11-17)

The product owner explicitly approved:
- Frontend: Next.js + React + TypeScript.
- UI system: Tailwind CSS + shadcn/ui.
- Backend: Node.js + Express.js + TypeScript (not NestJS).
- Primary database / ORM: PostgreSQL + Prisma.
- Background job technology: Redis + BullMQ, added in its planned phase.
- Package manager / workspace tool: **npm workspaces**, retaining the committed npm lockfile.
- Application structure: **modular monolith**, with versioned REST contracts.

This is an architecture/technology choice, **not** approval of a specific cloud vendor, identity provider, final tenant key model, record permission rules, database residency, actual deployment or production release. The intended PostgreSQL RLS approach remains a prior design requirement awaiting verified implementation.

## Current delivery and deviation

Repository uses npm workspaces and a committed lockfile with `npm ci` CI.
The master PDF proposes pnpm + Turborepo for P3.02. On 2026-11-17 the
owner **explicitly approved npm workspaces as the permanent package-manager
choice for this baseline**, an intentional documented deviation from the PDF.
No migration to pnpm/Turborepo is planned without a later owner decision.
This resolves the package-manager choice, but P3.02 still needs its separate
install/build/typecheck and package-boundary acceptance evidence.

Source layout: `frontend/`, `backend/`, `shared/demo-contracts/`.
Future worker and reusable UI package boundary should be established
before BullMQ/shadcn expansion, not by duplicating auth and tenant logic.

## Extraction criteria

Extract services only if independent scaling, data/operational ownership,
or security boundaries justify their measured complexity. Use a
transactional outbox for reliable cross-module events in P7.

## Consequences and verification

Current frontend/backend builds and synthetic tests exist. Database and
authorization policies remain provisional. GitHub required-check enforcement,
actual staging deployment, security reviews, and approval of the other ADRs
are separate P3 gates. The owner-approved technology choices do not close
any of the 12 P1.10 open decisions unless separately and explicitly resolved.
