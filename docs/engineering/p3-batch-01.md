# P3 Batch 01 — Engineering implementation: P3.03–P3.07

**Owner request:** Complete five related subphases per development batch using the connected GitHub repository, with ChatGPT implementing actual code. This is a narrow internal development authorization, **not** an external/commercial release or approval of pending identity/tenant decisions.

**Base:** P3.02 read-only synthetic Express → Next.js demo integration. The original P3.02 branch/PR #27 is pending owner review; P3.01 #26 and P2.02 #25 remain open. Proposed code is on `feat/p3-batch-01` until CI and review.

## Implementation checklist

| Subphase | Real code implemented | Explicit exclusions |
|---|---|---|
| P3.03 — Dependency/build and local-network hardening | npm workspace dependency links for shared code; local-only outbound demo URL guard, safety unit tests; GitHub Actions reproducible `npm ci` after checked-in `package-lock.json` | Not an external production deployment, npm audit certification, dependency vulnerability closure or threat model |
| P3.04 — Shared API contract and runtime validation | `shared/demo-contracts` package used by Express and Next.js, exact fictional envelope/record match, fail-closed fallback, independent contract tests | Not the 67-operation production P1.08 OpenAPI contract, identity, tenant row/field protection, or database |
| P3.05 — Dashboard/navigation improvements | Breadcrumb labels, computed fictional workload, stage counts, percentage bars, accessible filter controls, responsive layout and analytics tests | Not final P2.02 route/role approval, business analytics or actual forecast |
| P3.06 — Synthetic CRM lead create/edit UI | Client-side lead workbench with search, stage filtering, explicit fictional input validation, in-memory add/edit and unit tests | No server-side CRM API writes, persistence, external users, real customers, imports/exports, or auth |
| P3.07 — Failure handling and verification | Local-only data guards, fixture mismatch rejection, error boundary, loading/unavailable states, HTTP safety tests, cross-workspace CI | No browser audit, real tenant security pen-test, KYC/KYB, processor compliance or commercial release |

## Commands

Node 22+. From the repository root:

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run dev:api  # terminal 1
npm run dev:web  # terminal 2
```

The frontend is on `http://localhost:3000/app` and demo API on `http://127.0.0.1:4000/api/v1/demo/leads`.
For the demo-only bridge, `API_INTERNAL_URL` must remain `http://127.0.0.1:4000` or `http://localhost:4000`. The UI falls back to its canonical fictional fixture whenever the API is unavailable or returns anything different.

**Do not enter actual personal/customer information** into the demo. New/edited leads exist in memory only, and refreshing the browser discards the changes. All demo endpoints remain unauthenticated because they serve static fictional records only; no real business API routes exist.

## Test evidence and open gates

GitHub CI checks are **not** the original P1.09 727 future acceptance cases. Do not count any new scaffold/contract tests toward 727. All 727 remain NOT RUN; all 14 evidence risks/gaps and 12 unresolved decisions remain OPEN. The 40 P2.02 paper-review tests are also NOT RUN. No real customer interview evidence, secure database tenant isolation, real onboarding, access control, production deployment, G-EXT or G-COM approval is implied.

The five subphases can be called **implemented and CI-verified** only if the CI typechecks, tests, builds and lockfile installation succeed. Owner signoff and broader security/product acceptance remain separate gates.
