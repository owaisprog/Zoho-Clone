# ADR 0001 — Express modular monolith and engineering toolchain

Status: **PROVISIONAL / OWNER REVIEW REQUIRED** — 2026-11-16
Source: master PDF P3.01–P3.14 and Appendix I.

## Decision already fixed by owner

Use Next.js + React + TypeScript + Tailwind/shadcn on web, Node.js +
Express 5 + TypeScript (NO NestJS) on API, PostgreSQL + Prisma with
reviewed RLS SQL, Redis/BullMQ when workers are needed. Use a modular
monolith with versioned REST contracts; avoid premature microservices.

## Current delivery and deviation

Repository currently uses npm workspaces and a committed lockfile with
`npm ci` CI. Master PDF proposes pnpm workspace and Turborepo. Changing
package managers without regenerating/verifying the lockfile would break
reproducible builds, so **npm remains the functioning interim toolchain**.
Decision: choose either an explicit owner-approved deviation (npm) or
perform a verified pnpm/Turbo migration with lockfile and tests.
Do not claim official P3.02 compliance from an unapproved substitution.

Source layout: `frontend/`, `backend/`, `shared/demo-contracts/`.
Future worker and reusable UI package boundary should be established
before BullMQ/shadcn expansion, not by duplicating auth and tenant logic.

## Extraction criteria

Extract services only if independent scaling, data/operational ownership,
or security boundaries justify their measured complexity. Use a
transactional outbox for reliable cross-module events in P7.

## Consequences and verification

Current frontend/backend builds and synthetic tests exist. Database and
authorization policies remain provisional. Branch rules and staging
environment require owner GitHub/cloud configuration.
