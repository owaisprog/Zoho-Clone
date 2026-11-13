# P3.01 — Early Real-Code Scaffold (in parallel with P2)

**Owner authorization:** 2026-11-14 request: start **actual Next.js frontend and Express.js backend coding** in GitHub \`owaisprog/Zoho-Clone\` before all P2 design subphases are completed, with synthetic data only.

**Issue:** [#26](https://github.com/owaisprog/Zoho-Clone/issues/26) — OPEN until owner reviews verified scaffold. **Actual GitHub Actions run #43493982182 SUCCEEDED** at commit `a6fb6c8b6391738f3bdddb01e11ed7bc6a7d208f`.
**Parallel design:** P2.02 IA [#25](https://github.com/owaisprog/Zoho-Clone/issues/25) remains OPEN (provisional).
**Boundary:** This is a bounded EARLY P3.01 exception to the original sequential roadmap, not a waiver of any safety or quality acceptance requirement.

## Real source currently targeted

| Area | Files | Actual delivered scope |
|---|---|---|
| Workspace | root \`package.json\`, \`.nvmrc\`, \`.gitignore\` | npm workspaces, Node.js >=22 |
| Frontend | \`frontend/package.json\`, \`frontend/src/app/\`, \`frontend/src/components/\` | Next.js 16 App Router + React/TypeScript, P2.01 token CSS, responsive demo workspace |
| Sample data | \`frontend/src/lib/synthetic-data.ts\` | Fully fictional five internal applications and four example.com leads, local display only |
| Backend | \`backend/src/app.ts\`, \`backend/src/server.ts\`, \`backend/src/config.ts\` | Express 5 process health only; JSON 404 errors, Helmet, restricted local bind |
| Scaffold tests | \`frontend/test/*.test.ts\`, \`backend/test/*.test.ts\` | Fixture integrity/search and health, forbidden endpoint/config checks, future CI |
| Workflow | \`.github/workflows/p3-scaffold.yml\` | Proposed GitHub Actions npm install/typecheck/test/build pipeline |

**Run instructions:** See root README and \`frontend/README.md\` and \`backend/README.md\`. Requires Node.js 22+, installation of npm packages and **two local terminals**. Frontend port 3000, API port 4000. Client does not send credentials; frontend's server fetch checks only process health. This does not implement an authenticated frontend-backend business integration.

**Security honesty:** \`/app\` and its synthetic subroutes are **public preview pages without authentication**. They are not production organization routes, secure member experiences or permitted customer-data screens. There is **NO** Prisma schema, PostgreSQL, membership, RBAC/ABAC, database isolation, processor webhook, KYC, payment, actual vendor billing or event worker. No real data is permitted. The health endpoint is a process liveness check only.

**Risk and QA:** **All 14** G-001–G-014 risks remain OPEN (implementation may advance mitigation, but evidence/owner closure needed). **All 12** unresolved P1.10 choices remain OPEN. **The original 727 P1.09 planned tests remain NOT_RUN_DOCUMENT_ONLY**; new P3 unit tests are separate evidence tracked by actual future run result. GitHub Action config/TS source presence does not prove it ran or passed.

**Environment:** Do not commit secrets, real data, .env files or generated node_modules. GitHub CI currently uses \`npm install\` because no checked-in lockfile exists. A lockfile + \`npm ci\` should be added once install is verified; dependency and security audit evidence remains open. No database is created or simulated as if implemented.

**P3.01 review gate:** Code committed. In [CI run #43493982182](https://github.com/owaisprog/Zoho-Clone/actions/runs/43493982182), installation, frontend/backend TypeScript checks, **9 frontend + 4 backend scaffold tests**, and both builds **all passed**. This is verified real CI evidence, not a claimed local run or manual browser test. **Owner review and acceptance of P3.01 are still pending; issue #26 stays OPEN.** P2.02 continues concurrently; no G-EXT/G-COM authorization follows.


## First CI attempt and fix

The first GitHub Actions run [#43493710723](https://github.com/owaisprog/Zoho-Clone/actions/runs/43493710723) failed at TypeScript TS5097 because two frontend test imports ended in \`.ts\`. The source imports were corrected (commit \`a6fb6c8b...\`). The rerun [#43493982182](https://github.com/owaisprog/Zoho-Clone/actions/runs/43493982182) **passed TypeScript, 13 executed scaffold tests and both builds**. No failures were silently reclassified as passes.

### Evidence boundaries

The 13 scaffold tests cover fictional data/search summaries, safe health adapter behavior,
process health/404/config. They do **not** exercise an authenticated browser, actual DB,
org/agent permissions, direct-IDOR, WCAG, failure restore, payment/KYC, or verified partner
workflow. Original 727 P1 tests remain NOT RUN and all 14 documented gaps OPEN. CI didn't
deploy any service.
