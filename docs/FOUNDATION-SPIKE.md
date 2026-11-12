# P0 Engineering Spike — Application Foundation

**Status:** Technical work in a feature branch. P0 discovery is not complete; P2 exit conditions are NOT met.

## Scope delivered in this experiment
- npm workspace and Node 22 baseline.
- Next.js web app with accessible, responsive prototype landing workspace.
- NestJS API with one process liveness endpoint.
- A deterministic API payload unit test.
- Typecheck/build/test GitHub workflow.
- Environment sample files and local run instructions.

## Explicit limitations
- No authentication, database, business records or role enforcement.
- No user signup, tenant isolation or production service.
- No claims of successful local dependency installation unless verified.
- No real onboarding or merchant processing.
- API health reflects only the process, and says the database is not configured.
- This is safe-to-replace technical scaffolding, not commitment to the commercial wedge.

## Verify on GitHub Actions
1. Install dependencies and commit the resolved `package-lock.json` in a follow-up change.
2. Run `npm run typecheck`, `npm run test`, `npm run build`.
3. Run API and web locally, check the liveness indicator in the UI.
4. Record the actual check run URL and failures/fixes in this document.
5. Check keyboard access, narrow-screen layout, and no client-exposed secrets.
6. Do not request a Vercel deployment until the preview environment and API hosting boundary are agreed.

## Future gated milestone
P1 writes approved workflows/roles/API contracts. P2 turns this scaffold into a tested development baseline with lockfile, build checks, linting, CI, staging and environment setup. P3 adds real tenant-aware identity. No production launch before P12–P14 release gates.
