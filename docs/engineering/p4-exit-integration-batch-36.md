# P4 Batch 36 — staging preparation and recovery rehearsal (no deployment)

Date: 2026-11-24. Stacked on verified Batch 35. Five work items:

1. **Explicit staging blueprint** (`docs/engineering/p4-r36-staging-blueprint.json`) has no cloud addresses, credentials or real tenant information. It marks staging UNPROVISIONED, public ingress DISABLED, dependencies NOT_CONNECTED, all approvals false, original acceptance 0/727, deploy and main merge forbidden. It requires snapshot, canary and restore verification before any owner-authorized staging change.
2. **Synthetic dependency health evaluator** (`backend/src/platform/p4-r36-ci-readiness-rehearsal.ts`) requires the exact disposable PostgreSQL GitHub CI environment; checks fictional identity/DB/delivery callbacks with safe fixed outputs, refuses live environments, hides thrown private errors and returns NO_GO even when all tests succeed.
3. **Synthetic rollback drill state machine** requires a simulated snapshot before canary, injection of a simulated failure before simulated restore, and records no real deployment. Rehearsal cannot change DNS, Postgres migrations, or cloud state.
4. **Unit and blueprint-tamper tests:** seven backend guard and rollback tests, five official-gate/manifest tests; CI script rejects changing any of the 10 P4 release gates to CLOSED, claiming original acceptance passed or marking staging active.
5. **Mandatory CI integration:** `node scripts/p4-r36-staging-preflight.mjs --ci` validates the official release gate inventory against the blueprint; `node_modules/.bin/tsx scripts/p4-r36-readiness-rehearsal.ts` exercises deterministic dependency failures and restore in disposable CI. `docs/engineering/p4-exit-integration-batch-36.md` records the limits and next actions.

## Actual owner approval steps still required

Before real staging: choose the environment/infrastructure, Auth0 tenant/application audience and verification policy, approved least-privilege database migration and rollback, an actual backup/restore drill, audited secrets and KMS, approved mail sending, abuse prevention and invitation retention, deterministic two-tenant UAT, and formal owner/security review. None were performed here. A synthetic canary is NOT a staging canary and a memory-only rollback is NOT database restore.

Original 727 P1.09 cases: zero formally executed. All 10 P4 release gates OPEN, P4 decision NO_GO, 14 original risks and 12 decisions open, R10-C1–C5 and exit issue #61 unresolved. No merge, Neon writes, live Auth0/JWKS, external email, real customer data or staging/production deployment.
