# P3.08–P3.14 single-batch implementation and evidence

Date: 2026-11-20. Branch:
`chore/p3-master-roadmap-hardening-20261116`, PR #53 (draft).
Based on the **2026-11-13 Express.js master roadmap pages 24–29**.
Do not interpret "source implemented" as P3 phase exit approval.

## Source delivered in this batch

| Master ID | Executed code or document | Evidence / limit |
| --- | --- | --- |
| P3.08 | `scripts/p3-neon-first-preflight.mjs` and tests, npm `dev:check` / `dev:check:neon` | Checks Node 22+, repository baseline, local Neon file, optional Auth0 local file; no Docker required on Mac; `--verify-neon` reuses actual read-only Prisma smoke; CI uses offline `--ci` only |
| P3.09 | `.github/workflows/p3-scaffold.yml` runs workspace type checks, source tests, builds, schema and synthetic DB isolation, limited tracked-secret scan, Node script tests and Neon-first offline preflight | CI green required, but GitHub protected-main/status-check rules must be enabled by repository administrator; lint/format and supply-chain risk policy not yet owner accepted |
| P3.10 | `scripts/p3-staging-url.mjs` and tests, HTTPS hostname guard added to `scripts/verify-staging-health.sh` | Blocks production/localhost/sensitive URL formats. No cloud deployment, rollback execution, staging vault or budget approval; existing staging workflow is manual and gated |
| P3.11 | `SafeRequestMetrics` in `backend/src/platform/observability.ts`, optional internal-only collection on real Express request finish, negative privacy tests | Server UUID request ID and structured JSON logs preexist. No public metrics API or tracking vendor; provider pipeline and error alert verification pending |
| P3.12 | `validatePrivateUploadCandidate` and tests, existing `disabledStorage()` contract | Rejects traversal, active content and oversized candidates; no signed URL, bucket, malware scan or live file API |
| P3.13 | Auth0 config/forged bearer tests + `p3-auth0-release-checklist.md` | Auth0 already selected and locally identity-only tested; MFA, token revocation, quotas/region and authorization mapping require acceptance |
| P3.14 | ADR 0005 (Neon-first dev and CI), ADR 0006 (queues/telemetry/storage), with ADR 0001–0004 retained | Critical architecture choices documented, ADR 0002–0006 remain provisional until owner signoff |

## Local developer commands

From repository root, Node 22+:

```bash
git switch chore/p3-master-roadmap-hardening-20261116
git pull --ff-only
npm ci
npm run dev:check
npm run dev:check:neon
npm run typecheck
npm run test
npm run build
```

`backend/.env.neon.local` and `frontend/.env.local` contain credentials
and must stay **gitignored**. `dev:check` never displays their values,
`dev:check:neon` runs the TLS-restricted synthetic read-only Prisma
integration smoke only. Local Docker is not required. Running real
backend/frontend dev processes remains opt-in via `npm run dev:api`
and `npm run dev:web`.

## Full P3 exit still not yet achieved

P3.01–P3.14 source delivery and the 2026-11-20 Neon smoke do not replace
the master roadmap's requirements for **owner-approved code, real test logs,
no critical tenant/security defect and progress entry closed**. Specifically:

1. Owner approves P2.02 information architecture and ADR 0002–0006;
   confirms remaining OPEN-001/002/003 (actual tenant keys and permissions).
2. GitHub administrator enables protected `main` with required CI checks,
   disallows unsafe bypasses, and proves a failed check blocks merges.
3. Owner selects staging cloud hosting, domain, region, budget and secrets
   provider. Deploy isolated staging, then verify actual readiness,
   backup/restoration, repeatable deploy and rollback; do not reuse
   the synthetic smoke reader role as a commercial API role.
4. Owner reviews Auth0 MFA/recovery/session-revocation, region, quotas,
   cost, SCIM/invitations requirements before any live tenant data.
5. Select and review object storage vendor, malware scan and retention
   strategy; verify log retention, tracer exporter and alert delivery.
6. Execute applicable P1.09 acceptance/security mapping with user and
   repository review. All 727 originals remain **NOT RUN**.
7. Explicit owner signoff for P3 exit. No public commercial launch.

No production data, public file uploads, live merchant onboarding, or
billing are authorized by this P3 batch. All 14 original risks and 12
unresolved decisions remain OPEN; G-EXT and G-COM stay BLOCKED.
