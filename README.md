# Business OS — Zoho Clone (development)

A modular, multi-tenant business operations suite being built in approved phases using ChatGPT and GitHub. The product and architecture are still subject to Phase 0 validation.

**Current stage:** P0 technical foundation spike. **Not a production product.** No sign-in, customer records, database or tenant isolation have been implemented.

## What exists in this branch

- `apps/web`: Next.js 16 responsive foundation-preview UI with explicit empty states.
- `apps/api`: NestJS 12 API with `GET /api/v1/health` (process liveness only).
- `docs`: product discovery plan, phase registry, architecture and decisions.
- `.github/workflows/checks.yml`: automated type checking, API test and builds.

## Requirements

- Node.js 22.12+ (use `nvm use` if available)
- npm 10+
- Network access to the npm registry for the initial install

## Local development

1. Run `npm install` in the repository root.
2. Terminal A: `npm run dev:api` (API at http://localhost:4000).
3. Terminal B: `npm run dev:web` (web at http://localhost:3000).
4. Check http://localhost:4000/api/v1/health for API liveness.

Default local ports work without environment files. To customize, copy `apps/api/.env.example` to `apps/api/.env` and `apps/web/.env.example` to `apps/web/.env.local`. The Nest API does **not** load `.env` automatically yet; export its variables in your shell if you need to change the defaults.

## Verification

- `npm run typecheck`
- `npm run test`
- `npm run build`

**Initial development note:** This first foundation commit has no lockfile because the authoring environment could not access the npm registry. GitHub Actions uses `npm install`; the lockfile should be generated and committed after dependency resolution is verified. Do not treat an unverified workflow as passing.

## Delivery

Changes move through feature branches and draft PRs into `develop`. `main` is preserved for approved releases. A Vercel web preview can be configured later; the Nest API needs its own hosting. Production requires separately approved authentication, database, authorization and operational controls.

## Docs
- [Phase roadmap](docs/ROADMAP.md)
- [Phase 0 validation checklist](docs/PHASE-0.md)
- [Provisional architecture](docs/ARCHITECTURE.md)
- [Requirements working draft](docs/P0-REQUIREMENTS-DRAFT.md)
- [Engineering spike notes](docs/FOUNDATION-SPIKE.md)
- [Decision log](docs/DECISIONS.md)
